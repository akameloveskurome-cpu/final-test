#!/usr/bin/env python3
"""Bake the picture named by app-logo-pic/latest.json into the Android launcher icon.

Run by the APK job after `npx cap add android`, before `npx cap sync android`:

    python3 scripts/apply-app-logo.py [--repo .] [--res android/app/src/main/res]
                                      [--manifest android/app/src/main/AndroidManifest.xml]

What it writes (all inside --res):
  mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png         square legacy icon (Android 7 and older)
  mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_round.png   round legacy icon
  mipmap-{m,h,xh,xxh,xxxh}dpi/lf_logo_fg.png          adaptive foreground (the picture, filling the whole icon; BUG-162)
  mipmap-{m,h,xh,xxh,xxxh}dpi/lf_logo_bg.png          adaptive background (plain dark; the picture is never shrunk or framed; BUG-162)
  mipmap-anydpi-v26/ic_launcher.xml, ic_launcher_round.xml   adaptive icons (Android 8+)
and it sets android:icon / android:roundIcon on the <application> tag of the manifest.

The picture is chosen exactly the way the app fingerprint chooses it (scripts/app-fingerprint.py):
app-logo-pic/latest.json -> "name". No latest.json means no logo.

Exit codes
  0  launcher icon written
  3  no logo to bake in. Nothing was changed; the workflow then falls back to
     scripts/no-launcher-icon.py. No latest.json is the normal "nothing uploaded" case; a
     picture that is missing, unreadable or of an unsupported type prints a ::warning:: line
     saying why, so a bad picture is never silently ignored.
  2  the Android project is unusable (res folder / manifest missing, Pillow missing)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageChops, ImageDraw, ImageOps
except ImportError:  # pragma: no cover - the workflow installs Pillow before calling this
    print('::error::apply-app-logo: Pillow is not installed, so the launcher icon cannot be built.')
    sys.exit(2)

EXTS = {'.gif', '.png', '.jpg', '.jpeg', '.webp', '.bmp'}
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTIVE_VISIBLE = 72 / 108   # v208+ (owner's order): Android shows only the middle 72 dp of the 108 dp adaptive icon, so the picture is fitted into that part: nothing of it is cut by the phone's icon mask (the old full-size layout cut the outer third)
ADAPTIVE = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
DARK = (14, 14, 18, 255)  # adaptive background behind transparent pictures
MASTER = 1024
LANCZOS = getattr(Image, 'Resampling', Image).LANCZOS
TRANSPOSE = getattr(Image, 'Transpose', Image)   # BUG #20: Image.Transpose exists only from Pillow 9.1; older Pillow has the same names on Image itself
Image.MAX_IMAGE_PIXELS = 100_000_000

ADAPTIVE_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@mipmap/lf_logo_bg"/>\n'
    '    <foreground android:drawable="@mipmap/lf_logo_fg"/>\n'
    '</adaptive-icon>\n'
)


class NoLogo(Exception):
    """No logo was uploaded (the caller falls back to the generic icon)."""


class BadLogo(NoLogo):
    """A logo is there but cannot be used: this is reported loudly, never silently."""


class BuildError(Exception):
    """The Android project itself is not in the shape this script expects."""


def selected_logo(repo: Path) -> Path:
    manifest = repo / 'app-logo-pic' / 'latest.json'
    if not manifest.is_file():
        raise NoLogo('app-logo-pic/latest.json does not exist (no logo uploaded)')
    try:
        name = json.loads(manifest.read_text(encoding='utf-8')).get('name')
    except (OSError, ValueError, AttributeError) as exc:
        raise BadLogo(f'app-logo-pic/latest.json is unreadable: {exc}')
    if not isinstance(name, str) or not name or '/' in name or '\\' in name or name.startswith('.'):
        raise BadLogo(f'app-logo-pic/latest.json names an invalid file: {name!r}')
    if Path(name).suffix.lower() not in EXTS:
        raise BadLogo(f'{name} is not a supported picture type (use PNG, JPG, JPEG, WEBP, BMP or GIF)')
    path = repo / 'app-logo-pic' / name
    if not path.is_file():
        raise BadLogo(f'app-logo-pic/latest.json names {name}, but that file is not in the folder')
    return path


def _uniform(frame: Image.Image) -> bool:
    return all(lo == hi for lo, hi in frame.getextrema())


def load_picture(path: Path) -> Image.Image:
    """EXIF-rotated RGBA. Animated GIF / WebP: the first frame with real content (a first frame that is
    one flat colour, e.g. a fade-in from black or an empty transparent frame, is skipped)."""
    try:
        im = Image.open(path)
        frames = max(1, int(getattr(im, 'n_frames', 1)))
        if frames == 1:
            im = ImageOps.exif_transpose(im)
            im.load()
            return im.convert('RGBA')
        seen = []
        orient = im.getexif().get(0x0112, 1)   # BUG-273: EXIF orientation applies to every frame
        flips = {2: TRANSPOSE.FLIP_LEFT_RIGHT, 3: TRANSPOSE.ROTATE_180, 4: TRANSPOSE.FLIP_TOP_BOTTOM, 5: TRANSPOSE.TRANSPOSE, 6: TRANSPOSE.ROTATE_270, 7: TRANSPOSE.TRANSVERSE, 8: TRANSPOSE.ROTATE_90}
        for index in range(min(frames, 40)):
            im.seek(index)
            frame = im.convert('RGBA')
            if orient in flips: frame = frame.transpose(flips[orient])
            if not _uniform(frame):
                return frame.copy()
            seen.append(frame.copy())
        # every frame is one flat colour: prefer one that is not fully transparent
        return next((f for f in seen if f.getchannel('A').getextrema()[1] > 0), seen[0])
    except Exception as exc:  # corrupt, truncated, decompression bomb, ...
        raise BadLogo(f'{path.name} could not be read as a picture: {exc}')


def has_alpha(im: Image.Image) -> bool:
    a = im.getchannel('A')
    return sum(a.histogram()[:250]) > a.size[0] * a.size[1] * 0.01   # BUG-161: more than 1% of pixels clearly see-through


def contain(im: Image.Image, box: int) -> Image.Image:
    w, h = im.size
    scale = box / max(w, h)
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), LANCZOS)


def blurred_cover(im: Image.Image, size: int) -> Image.Image:
    return ImageOps.fit(im.convert('RGB'), (size, size), LANCZOS).filter(
        ImageFilter.GaussianBlur(size / 14)).convert('RGBA')


def solid(size: int) -> Image.Image:
    return Image.new('RGBA', (size, size), DARK)


def master_square(im: Image.Image) -> Image.Image:
    """The legacy icon: opaque square pictures are used as they are; others are never cropped."""
    w, h = im.size
    if has_alpha(im):
        canvas = blurred_cover(im, MASTER).convert('RGBA')   # BUG-160: same blurred backdrop as the adaptive icon, not a see-through square
        small = contain(im, MASTER)
        canvas.paste(small, ((MASTER - small.width) // 2, (MASTER - small.height) // 2), small)
        return canvas
    if abs(w / h - 1) <= 0.12:
        return ImageOps.fit(im, (MASTER, MASTER), LANCZOS)
    canvas = blurred_cover(im, MASTER)
    small = contain(im, MASTER)
    canvas.paste(small, ((MASTER - small.width) // 2, (MASTER - small.height) // 2))
    return canvas


def circle(im: Image.Image) -> Image.Image:
    size = im.width
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), LANCZOS)
    out = im.copy()
    out.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return out


def adaptive_layers(im: Image.Image, size: int) -> tuple[Image.Image, Image.Image]:
    background = solid(size)   # BUG-162: no blurred frame any more; the picture fills the icon
    foreground = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    small = contain(im, round(size * ADAPTIVE_VISIBLE))   # v208+: the whole picture fits the visible part of the icon (BUG-162's full-size fill cut the outer third on Android 8+)
    foreground.paste(small, ((size - small.width) // 2, (size - small.height) // 2), small)
    return foreground, background


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'PNG', optimize=True)


def clear_other_formats(res: Path) -> None:
    """A template icon in another format (.webp) next to our .png would be a duplicate resource."""
    for folder in res.glob('mipmap-*'):
        for stem in ('ic_launcher', 'ic_launcher_round', 'lf_logo_fg', 'lf_logo_bg'):
            for old in folder.glob(stem + '.*'):
                if old.suffix.lower() != '.png':
                    old.unlink()


def set_manifest_icons(manifest: Path) -> None:
    src = manifest.read_text(encoding='utf-8')
    masked = re.sub(r'<!--.*?-->', lambda m: ' ' * len(m.group(0)), src, flags=re.DOTALL)
    found = re.search(r'<application\b[^>]*>', masked, re.IGNORECASE | re.DOTALL)
    if not found:
        raise BuildError(f'<application> not found in {manifest}')
    tag = src[found.start():found.end()]
    tag = re.sub(r'\s+android:(?:icon|roundIcon)\s*=\s*(["\']).*?\1', '', tag, flags=re.DOTALL)
    tag = re.sub(r'<application\b', '<application android:icon="@mipmap/ic_launcher"'
                 ' android:roundIcon="@mipmap/ic_launcher_round"', tag, count=1, flags=re.IGNORECASE)
    manifest.write_text(src[:found.start()] + tag + src[found.end():], encoding='utf-8')


def apply(repo: Path, res: Path, manifest: Path) -> str:
    logo = selected_logo(repo)
    picture = load_picture(logo)
    if not res.is_dir():
        raise BuildError(f'res folder not found: {res} (run `npx cap add android` first)')
    if not manifest.is_file():
        raise BuildError(f'manifest not found: {manifest}')
    square = master_square(picture)
    clear_other_formats(res)
    for density, px in LEGACY.items():
        folder = res / f'mipmap-{density}'
        save_png(square.resize((px, px), LANCZOS), folder / 'ic_launcher.png')
        save_png(circle(square.resize((px, px), LANCZOS)), folder / 'ic_launcher_round.png')
    for density, px in ADAPTIVE.items():
        foreground, background = adaptive_layers(picture, px)
        folder = res / f'mipmap-{density}'
        save_png(foreground, folder / 'lf_logo_fg.png')
        save_png(background, folder / 'lf_logo_bg.png')
    anydpi = res / 'mipmap-anydpi-v26'
    anydpi.mkdir(parents=True, exist_ok=True)
    for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        (anydpi / name).write_text(ADAPTIVE_XML, encoding='utf-8')
    set_manifest_icons(manifest)
    return logo.name


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--repo', default='.')
    parser.add_argument('--res', default='android/app/src/main/res')
    parser.add_argument('--manifest', default='android/app/src/main/AndroidManifest.xml')
    args = parser.parse_args(argv)
    try:
        name = apply(Path(args.repo), Path(args.res), Path(args.manifest))
    except BadLogo as why:
        print(f'::warning::apply-app-logo: {why}. The launcher icon was NOT changed (generic Android icon).')
        return 3
    except NoLogo as why:
        print(f'apply-app-logo: {why}; the launcher icon stays the generic Android icon.')
        return 3
    except BuildError as why:
        print(f'::error::apply-app-logo: {why}')
        return 2
    print(f'apply-app-logo: launcher icon built from app-logo-pic/{name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

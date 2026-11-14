#!/usr/bin/env python3
# NOTE (BUG-164): .github/workflows/android.yml, signing/ and .gitattributes are NOT part of this fingerprint.
# Changing only those files does not give installed apps a new APK.
"""Print the stable SHA-256 app-source identity used by the updater.

Included inputs are the files that change the installed application.
Server-delivered artwork is deliberately excluded: notification-popup-gif-pic/, update-popup-gif-pic/,
splash-pic/, credit-gif-pic/, background-allow-gif-pic/ and stats-banner-gif-pic/ are polled live and do not require an APK
install. The app logo IS included, because scripts/apply-app-logo.py bakes it into the APK as the
launcher icon: app-logo-pic/latest.json (a new upload or a "resend" gets a new stamp) AND the exact
picture it names (the bytes that really go into the icon). Other pictures in the folder are ignored.
The About logo itself is also checked live every second.

Run from the repository root in a checked-out Git worktree.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

INPUTS = (
    "src",
    "native-android",
    "scripts",
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "capacitor.config.json",
    "index.html",
    "app-logo-pic/latest.json",
)

LOGO_DIR = "app-logo-pic"
LOGO_EXTS = {".gif", ".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def selected_logo(tracked: set[str]) -> str | None:
    """The tracked picture named by app-logo-pic/latest.json (same rule as scripts/apply-app-logo.py)."""
    manifest = Path(LOGO_DIR) / "latest.json"
    if manifest.as_posix() not in tracked or not manifest.is_file():
        return None
    try:
        name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
    except (OSError, ValueError, AttributeError):
        return None
    if not isinstance(name, str) or not name or "/" in name or "\\" in name or name.startswith("."):
        return None
    if Path(name).suffix.lower() not in LOGO_EXTS:
        return None
    path = f"{LOGO_DIR}/{name}"
    return path if path in tracked else None


def main() -> int:
    try:
        raw = subprocess.check_output(["git", "ls-files", "-z", "--", *INPUTS])
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"app fingerprint: cannot list tracked build inputs: {exc}", file=sys.stderr)
        return 2

    tracked = {p.decode("utf-8") for p in raw.split(b"\0") if p}
    try:
        listing = subprocess.check_output(["git", "ls-files", "-z", "--", LOGO_DIR])
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"app fingerprint: cannot list the logo folder: {exc}", file=sys.stderr)
        return 2
    logo = selected_logo({p.decode("utf-8") for p in listing.split(b"\0") if p})
    if logo:
        tracked.add(logo)
    paths = sorted(Path(p) for p in tracked)
    digest = hashlib.sha256()
    used = 0
    for path in paths:
        if not path.is_file():
            print('warning: tracked file missing on disk, skipped: ' + str(path), file=sys.stderr)
            continue
        relative = path.as_posix().encode("utf-8")
        data = path.read_bytes()
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
        used += 1

    if used == 0:
        print("app fingerprint: no tracked build inputs found", file=sys.stderr)
        return 2
    # Twelve hex characters preserve the manifest/release-note format while
    # identifying the complete SHA-256 input stream deterministically.
    print(digest.hexdigest()[:12])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

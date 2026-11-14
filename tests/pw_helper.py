"""BUG-233: browser lookup for the Playwright probes, with no machine-specific path.
Order: $LF_CHROMIUM (full path to a chrome binary) -> a chromium-* folder inside $PLAYWRIGHT_BROWSERS_PATH -> None (Playwright's own default browser, `npx playwright install chromium` / `python -m playwright install chromium`).
Output files of the probes go to $LF_OUT or tests/out/ (see out_dir()), never to an absolute path."""
import os, pathlib

def chromium_exe():
    p = os.environ.get('LF_CHROMIUM')
    if p and pathlib.Path(p).exists():
        return pathlib.Path(p)
    root = os.environ.get('PLAYWRIGHT_BROWSERS_PATH')
    if root and root != '0':
        found = sorted(pathlib.Path(root).glob('chromium-*/chrome-linux*/chrome'))
        if found:
            return found[0]
    return None

def out_dir():
    d = pathlib.Path(os.environ.get('LF_OUT') or (pathlib.Path(__file__).resolve().parent / 'out'))
    d.mkdir(parents=True, exist_ok=True)
    return d

# App logo uploads

The newest picture in this folder is the **app logo**. It does two things:

- **Launcher icon (needs the update):** the GitHub build bakes the picture into the APK as the home-screen / app-drawer icon (square, round and Android 8+ adaptive). Every new upload (or `resend`) changes `latest.json` and the picture's bytes, which changes the app fingerprint, so GitHub builds a new APK and phones are offered the update. After the user installs it, the new icon is on the home screen. The build prints which picture it used in the run summary, and fails the check step if the finished APK has no icon when one was uploaded.
- **Live logo in Settings > About (within seconds):** the app checks `app-logo-pic/latest.json` about once a second while open and shows the newest picture, no update needed.

Upload the picture directly into this folder: PNG, JPG, JPEG, WEBP, BMP or GIF (any file name). Square pictures work best; other shapes are never cropped (on Android 8+ they sit on a dark background, on older Android on a blurred copy of themselves), transparent PNGs get a dark background behind them, and a GIF uses its first frame that has real content. The workflow maintains `latest.json`; do not edit it by hand.

With the folder empty there is no logo: Android shows its own generic icon and nothing appears in About. If a picture is there but cannot be used (corrupt, wrong type), the build still finishes with the generic icon and shows a yellow warning in the Actions run saying why.

To send the same picture again: create `resend.txt` here, upload the picture under a different name, or use **Actions > Liquid Dark build > Run workflow** and tick **Send the app logo again to everybody**.

The opening splash picture is separate (`splash-pic/`).

## Shape of the launcher icon (BUG-162, fixed)

The picture fills the whole icon, the same size as the other icons on the launcher. It is **not** shrunk into a small safe zone (the old "about 61 %" size is gone), and there is no blurred frame around it on Android 8+. This is already built into the project, so a new repository needs no extra setting.

- **Android 8+ (adaptive icon):** the picture's longest side is scaled to the full icon on a plain dark background. The phone's icon mask (circle, squircle, rounded square) trims only the outer edge. A non-square picture is never cropped; the free space is plain dark.
- **Older Android (7 and below):** an almost square picture fills the square and round icons. Other shapes sit on a blurred copy of themselves.
- **Keep the subject away from the very edge.** Round masks cut the corners of a square picture, so put anything that must stay visible (a face, a letter) in the middle roughly 80 % of the picture.

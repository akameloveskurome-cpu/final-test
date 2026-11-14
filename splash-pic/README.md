# splash-pic/

Put ONE picture here (png, jpg, jpeg, webp or bmp, any file name). GIFs are not accepted for the splash and are ignored. It is shown for 1 second each time the app opens, centered in the middle of the screen at medium size (about 300 dp). Any picture size works (even 4000 x 4000): it is scaled to fit, never cropped or stretched.

- The newest picture in this folder wins. Older ones stay on GitHub but are not used.
- It is live: no new APK is needed. The app checks this folder every second (1000 ms) and keeps the newest picture, which shows the next time the app opens.
- To send the same picture again, add a file named `resend.txt` here (the workflow deletes it again).
- Any file size works: the picture is saved on the phone whatever its size. Smaller files download faster.


## This is not the app icon

`splash-pic/` controls only the **opening splash picture** shown briefly when Liquid Dark starts. It remains live: the newest upload is checked on the existing 1000 ms cadence and does not require an APK install.

The **app logo** is different. `app-logo-pic/` controls the Android home-screen/app-drawer icon (baked into the APK, so it changes after the new APK is installed) and the Settings > About logo (the same picture, also shown live within seconds). Neither folder reads from, writes to, or replaces the other. The Android 12+ system startup animation also has its own built-in vector asset.

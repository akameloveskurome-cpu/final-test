# update-popup-gif-pic/

Put ONE picture or GIF here (gif, png, jpg, jpeg, webp or bmp, any file name). It is shown on the **Update available / Update ready / Allow the install** popups, in the same full-screen look as the notification popup.

- The newest picture in this folder wins. Older ones stay on GitHub but are not used.
- No picture here = the update popup is the plain small one, as before.
- It is live: no new APK is needed to change it. The app looks at this folder **every second (1000 ms)**, from the moment a new build is found until the update popup is closed. A new picture replaces the old one even while the popup is open, and the popup opens already showing the picture.
- Delete every picture from the folder and the update popup goes back to the plain small one.
- This folder is separate from `notification-popup-gif-pic/` (the notification picture) and `app-logo-pic/` (the logo and home-screen icon).
- **Any size works** (the picture is scaled to fit the screen, never cropped). Phones download it once per upload, so smaller is just faster.
- **Order:** upload the picture here first, then upload the new zip to the repo root. When the build finishes, people get *Update available* with your picture. (Picture after the zip also works: it replaces the old one live.)
- The repository is public, so do not upload anything private. Keep the file small (a few hundred KB).
- **Send the same picture again:** drop a file named `resend.txt` (any name starting with `resend`, not a picture) into this folder, or tick *resend_update_popup* under Actions > Run workflow. The marker is removed by the workflow.

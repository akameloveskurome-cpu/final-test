# background-allow-gif-pic/

Put ONE picture or GIF here (gif, png, jpg, jpeg, webp or bmp, any file name). It opens a full-screen popup in the app that takes the person straight to Android's **Battery usage > Allow background activity** page for Liquid Dark (so music and listening stats keep working in the background).

- It shows **every time you upload a new picture**, even for people who already allowed background activity before.
- Each upload shows once per phone. Uploading the same picture again does nothing, unless you add a file named `resend.txt` here (the workflow deletes it again) or use Run workflow with "Send the background-allow picture again" ticked.
- The newest picture in this folder wins. No picture here = no popup (first install still asks once, with plain text).
- Live: no new APK is needed. The app looks at this folder **every second (1000 ms)** while it is open.
- Keep the file small. The repository is public, so do not upload anything private.

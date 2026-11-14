# Notification popup uploads

Upload GIF, PNG, JPG, JPEG, WEBP or BMP images directly into **this folder**. Pictures dropped on the repository's main page are ignored. The workflow maintains `latest.json`; Liquid Dark checks it every second while the app is open and shows a new picture in its in-app popup, once per phone.

## Send the same picture again

GitHub makes **no commit** when you upload a file that is identical to the one already there (same name, same picture), so nothing can start the workflow. Three ways to send it again anyway. Each one counts as a brand-new send:

1. **Drop a resend file (easiest).** In this folder choose **Add file > Create new file**, name it `resend.txt`, type any character in it and commit. The workflow sends the newest picture again and deletes `resend.txt` by itself, so you can create it again next time.
2. **Upload the picture under a different name**, for example `character-2.png`.
3. **Actions > Liquid Dark build > Run workflow**, tick "Show the popup picture again to everybody".

Deleting the newest picture does not send the older one again.

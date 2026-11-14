# Signing key (NOT stored in this repo)

Every Android app must be signed with a key. The build signs the APK with your key, so each new build installs over the old one. The key is never in the code or in the zip. This zip contains no key at all: you make your own once (below) and store it only in GitHub secrets.

## The rules

1. **Make the key once.** Keep the `liquid-dark.keystore` file and its password safe (a backup somewhere outside GitHub).
2. **Never make a new key for a new version.** A new version is only a new zip. The key and the two secrets stay exactly the same.
3. **A new key is only for when the old one is lost.** Then every phone must uninstall the app once before installing the new build.

## Where the key lives

Only in two GitHub secrets. Nothing in this folder changes when you upload a new version.

| Secret name | What goes in it |
|---|---|
| `KEYSTORE_BASE64` | the one-line text made from `liquid-dark.keystore` |
| `KEYSTORE_PASSWORD` | the same password you typed when making the key |

Add them: repo > Settings > Secrets and variables > Actions > New repository secret. Names are case sensitive. The alias `liquid dark` is already set in the project, you never type it.

## How to make the key (once only)

Replace `YOURPASSWORD` both times with the same password (letters and numbers only):

```bash
keytool -genkeypair -keystore liquid-dark.keystore -storetype PKCS12 -alias "liquid dark" \
  -keyalg RSA -keysize 2048 -validity 36500 -storepass YOURPASSWORD -keypass YOURPASSWORD \
  -dname "CN=AiHoshino, OU=AiHoshino, O=AiHoshino, L=AiHoshino, ST=AiHoshino, C=JP"
```

Check that the key opens with your password:

```bash
keytool -list -keystore liquid-dark.keystore -storetype PKCS12 -storepass YOURPASSWORD
```

Make the one-line text for the secret `KEYSTORE_BASE64`:

```bash
base64 -w0 liquid-dark.keystore > key.txt
```

Never commit `key.txt`, `KEYSTORE_BASE64.txt`, `KEYSTORE_PASSWORD.txt` or the `.keystore` file to the repo. `.gitignore` blocks them for git, and the workflow's first step stops the run if one is uploaded anyway through the GitHub web page. If that ever happens in a public repo, treat the key as exposed.

## How to check it worked

After a build, open the run, tap the `apk` job, and open the step **Show and verify signing certificate**. Look for `CN=AiHoshino` (or `CN=Liquid Dark` if you made the key with the older command). If either secret is missing or misspelled, the build does not get that far: the step **Restore signing key** stops the `apk` job with an error naming `KEYSTORE_BASE64` or `KEYSTORE_PASSWORD`, so an APK signed with `CN=Android Debug` is never produced by CI.

This README is documentation only. The build does not read it.


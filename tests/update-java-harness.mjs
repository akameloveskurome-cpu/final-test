// BUG-394 helper (not a test): compiles the REAL native-android/UpdateSupport.java and UpdateGeneration.java against tiny Android stubs and runs a Java driver.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const hasJava = spawnSync('java', ['-version']).status === 0;
const STUBS = {
  'android/content/SharedPreferences.java': 'package android.content; public interface SharedPreferences { String getString(String k,String d); long getLong(String k,long d); int getInt(String k,int d); Editor edit(); interface Editor { Editor putString(String k,String v); Editor putLong(String k,long v); Editor putInt(String k,int v); boolean commit(); void apply(); } }',
  'android/content/Context.java': 'package android.content; public abstract class Context { public static final int MODE_PRIVATE=0; public abstract java.io.File getFilesDir(); public abstract SharedPreferences getSharedPreferences(String n,int m); public abstract android.content.pm.PackageManager getPackageManager(); public abstract String getPackageName(); }',
  'android/content/pm/Signature.java': 'package android.content.pm; public class Signature { String t=""; public Signature(){} public Signature(String t){this.t=t;} public String toCharsString(){return t;} }',
  'android/content/pm/SigningInfo.java': 'package android.content.pm; public class SigningInfo { public boolean hasMultipleSigners(){return false;} public Signature[] getApkContentsSigners(){return null;} public Signature[] history; public Signature[] getSigningCertificateHistory(){return history;} }',
  'android/content/pm/PackageInfo.java': 'package android.content.pm; public class PackageInfo { public String packageName; public int versionCode; public Signature[] signatures; public SigningInfo signingInfo; public long getLongVersionCode(){return versionCode;} }',
  'android/content/pm/PackageManager.java': 'package android.content.pm; public abstract class PackageManager { public static final int GET_SIGNATURES=64, GET_SIGNING_CERTIFICATES=134217728; public static class PackageInfoFlags { public static PackageInfoFlags of(long f){return new PackageInfoFlags();} } public abstract PackageInfo getPackageInfo(String p,int f) throws Exception; public abstract PackageInfo getPackageInfo(String p,PackageInfoFlags f) throws Exception; public abstract PackageInfo getPackageArchiveInfo(String p,int f); public abstract PackageInfo getPackageArchiveInfo(String p,PackageInfoFlags f); }',
  'android/os/Build.java': 'package android.os; public class Build { public static class VERSION { public static int SDK_INT = 26; } }',
};
const DRIVER = `package com.liquid.flacplayer;
import android.content.*; import android.content.pm.*; import java.io.*; import java.util.*;
public class Driver {
  static class Prefs implements SharedPreferences { final Map<String,Object> m = new HashMap<>();
    public String getString(String k,String d){ Object v=m.get(k); return v==null?d:(String)v; } public long getLong(String k,long d){ Object v=m.get(k); return v==null?d:(Long)v; } public int getInt(String k,int d){ Object v=m.get(k); return v==null?d:(Integer)v; }
    public Editor edit(){ return new Editor(){ public Editor putString(String k,String v){m.put(k,v);return this;} public Editor putLong(String k,long v){m.put(k,v);return this;} public Editor putInt(String k,int v){m.put(k,v);return this;} public boolean commit(){return true;} public void apply(){} }; } }
  static class Pm extends PackageManager { long installed, archive; String instSig = "none", archSig = "none", instOld = "none", archOld = "none";
    PackageInfo sg(PackageInfo p,String t,int f,String old){ if(f==64){ if(!old.equals("none")) p.signatures=new Signature[]{new Signature(old)}; return p; } if(!t.equals("none")){ p.signingInfo=new SigningInfo(); p.signingInfo.history=new Signature[]{new Signature(t)}; } return p; } String archivePkg = "com.liquid.flacplayer";
    PackageInfo pi(String pkg,long v){ PackageInfo p=new PackageInfo(); p.packageName=pkg; p.versionCode=(int)v; p.signatures=new Signature[0]; return p; }
    public PackageInfo getPackageInfo(String p,int f){ return sg(pi(p,installed),instSig,f,instOld); } public PackageInfo getPackageInfo(String p,PackageInfoFlags f){ return pi(p,installed); }
    public PackageInfo getPackageArchiveInfo(String p,int f){ return sg(pi(archivePkg,archive),archSig,f,archOld); } public PackageInfo getPackageArchiveInfo(String p,PackageInfoFlags f){ return pi(archivePkg,archive); } }
  static class Ctx extends Context { final File dir; final Prefs prefs=new Prefs(); final Pm pm=new Pm(); Ctx(File d){dir=d;}
    public File getFilesDir(){return dir;} public SharedPreferences getSharedPreferences(String n,int m){return prefs;} public PackageManager getPackageManager(){return pm;} public String getPackageName(){return "com.liquid.flacplayer";} }
  public static void main(String[] a) throws Exception {
    String cmd = a[0]; File dir = new File(a[1]); Ctx c = new Ctx(dir);
    if (cmd.equals("key")) { long b = Long.parseLong(a[2]); String s = a[3];
      System.out.println(UpdateSupport.apkFile(c,b,s).getName()); System.out.println(UpdateSupport.partFile(c,b,s).getName()); System.out.println(UpdateSupport.identity(b,s)); }
    else if (cmd.equals("valid")) { System.out.println(UpdateSupport.validTarget(Long.parseLong(a[2]), a[3])); }
    else if (cmd.equals("verify")) { // verify <dir> <build> <sha> <archiveBuild> <installedBuild> <fileMode: none|small|big>
      long b = Long.parseLong(a[2]); String s = a[3]; c.pm.archive = Long.parseLong(a[4]); c.pm.installed = Long.parseLong(a[5]);
      File apk = UpdateSupport.apkFile(c,b,s);
      if (!a[6].equals("none")) { try (FileOutputStream o = new FileOutputStream(apk)) { byte[] z = new byte[a[6].equals("big") ? 1_100_000 : 100]; o.write(z); } }
      System.out.println("-");
      String r = UpdateSupport.verifyApk(c,b,s); System.out.println(r == null ? "OK" : r); }
    else if (cmd.equals("verify28")) { // verify28 <dir> <build> <sha> <archiveBuild> <installedBuild> <installedCert|none> <apkCert|none> [installedOldCert|none apkOldCert|none]: Android 9+, big file (the optional pair answers the OLD GET_SIGNATURES flag)
      android.os.Build.VERSION.SDK_INT = 28;
      long b = Long.parseLong(a[2]); String s = a[3]; c.pm.archive = Long.parseLong(a[4]); c.pm.installed = Long.parseLong(a[5]); c.pm.instSig = a[6]; c.pm.archSig = a[7]; if (a.length > 9) { c.pm.instOld = a[8]; c.pm.archOld = a[9]; }
      File apk = UpdateSupport.apkFile(c,b,s);
      try (FileOutputStream o = new FileOutputStream(apk)) { o.write(new byte[1_100_000]); }
      System.out.println("-");
      String r = UpdateSupport.verifyApk(c,b,s); System.out.println(r == null ? "OK" : r); }
    else if (cmd.equals("state")) { // markFailed only affects the saved target
      long b = Long.parseLong(a[2]); String s = a[3]; String id = UpdateSupport.identity(b,s);
      UpdateSupport.saveTarget(c,id,b,s,"https://x/y.apk",UpdateSupport.STATUS_DOWNLOADING,"",50);
      UpdateSupport.markFailed(c,"some-other-id","boom"); System.out.println(UpdateSupport.state(c));
      UpdateSupport.markFailed(c,id,"boom"); System.out.println(UpdateSupport.state(c)); }
    else if (cmd.equals("gen")) { UpdateGeneration g = new UpdateGeneration();
      long t1 = g.begin("A"); System.out.println(t1>0 && g.current(t1,"A") && g.isRunning());
      System.out.println(g.begin("A") == -1);                       // repeat start of the running update
      long t2 = g.begin("B"); System.out.println(t2>t1 && g.current(t2,"B") && !g.current(t1,"A") && !g.current(t1,"B")); // newer update replaces the old one
      System.out.println(!g.finish(t1,"A") && g.isRunning());        // an old generation cannot clear the state
      System.out.println(g.finish(t2,"B") && !g.isRunning() && !g.current(t2,"B")); // the current one can
      long t3 = g.begin("B"); System.out.println(t3>t2 && g.isActive("B") && !g.isActive("A")); }
  }
}
`;
let built = null;
export function build() {
  if (built) return built;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf394-')), src = path.join(tmp, 'src'), out = path.join(tmp, 'out');
  const put = (p, s) => { const f = path.join(src, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
  for (const [p, s] of Object.entries(STUBS)) put(p, s);
  for (const n of ['UpdateSupport', 'UpdateGeneration']) put(`com/liquid/flacplayer/${n}.java`, fs.readFileSync(path.join(root, 'native-android', n + '.java'), 'utf8'));
  put('com/liquid/flacplayer/Driver.java', DRIVER);
  const files = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name)))); walk(src);
  const r = spawnSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '-d', out, ...files], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Java compile failed:\n' + r.stdout + r.stderr);
  return (built = { out, tmp });
}
export function run(...args) {
  const { out, tmp } = build(), dir = fs.mkdtempSync(path.join(tmp, 'files-'));
  const r = spawnSync('java', ['-cp', out, 'com.liquid.flacplayer.Driver', args[0], dir, ...args.slice(1).map(String)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim().split('\n');
}

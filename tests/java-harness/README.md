# Java harness (bug #22, #23, #27)

Runs the pure helpers of the native code on the JVM, against the real Android API stubs.

Needs: a JDK (javac), and an `android.jar` with the real Android API (e.g. Sable/android-platforms, android-34/android.jar).
Set `AJ=/path/to/android.jar`, then from this folder:

    java -m jdk.compiler/com.sun.tools.javac.Main -proc:none -cp "$AJ" -sourcepath stubs:../../native-android -d out stubs/com/liquid/flacplayer/R.java stubs/com/liquid/flacplayer/MainActivity.java ../../native-android/ListenDb.java ../../native-android/LiquidTiles.java ../../native-android/StatsWidgets.java shadow/android/os/Looper.java shadow/android/os/Handler.java Probe.java Lossy.java
    java -cp "out:$AJ" Probe
    java -cp "out:$AJ" Lossy

- `shadow/` replaces Looper and Handler with no-op classes (StatsWidgets creates a Handler in a static initializer).
- `stubs/` gives the generated R class (resource ids are only ints here) and a minimal MainActivity.
- `Lossy.java` holds the exact `lossyLabel` source copied from LiquidNative.java (lines 656-663). Re-copy it if that method changes.

Expected: Probe prints `Daft Punk (Remix)` kept whole; `keyOf("  Daft Punk ")` = `daftpunk`. Lossy prints ALAC, Opus, Vorbis, and MP3/AAC by extension when the MIME is empty.
Not covered: LiquidNative, PlaybackService, UpdateDownloadService (they need Capacitor or Media3 classes that are not in this folder).

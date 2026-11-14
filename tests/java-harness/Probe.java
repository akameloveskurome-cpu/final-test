import java.lang.reflect.*;
import java.util.*;
public class Probe {
  public static void main(String[] a) throws Exception {
    Class<?> c = Class.forName("com.liquid.flacplayer.StatsWidgets");
    Field kk = c.getDeclaredField("knownKeys"); kk.setAccessible(true);
    Field ks = c.getDeclaredField("knownSmart"); ks.setAccessible(true);
    Field kp = c.getDeclaredField("knownProtect"); kp.setAccessible(true);
    kk.set(null, new HashSet<>(Arrays.asList("daft punk", "alice")));
    ks.set(null, true);
    kp.set(null, new HashSet<String>());
    Method split = c.getDeclaredMethod("splitKnown", String.class); split.setAccessible(true);
    Method key = c.getDeclaredMethod("keyOf", String.class); key.setAccessible(true);
    for (String s : new String[]{"Daft Punk (Remix)", "Alice (feat. Bob)", "Alice & Bob", "Unknown Artist", "Alice"})
      System.out.println("splitKnown[" + s + "] = " + split.invoke(null, s));
    System.out.println("keyOf[  Daft Punk ] = [" + key.invoke(null, "  Daft Punk ") + "]");
    System.out.println("keyOf[] = [" + key.invoke(null, "") + "]");
  }
}

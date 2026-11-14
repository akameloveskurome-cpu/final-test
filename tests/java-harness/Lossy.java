import java.util.Locale;
public class Lossy {
  static String lossyLabel(String fileName, String mime) {
    if (mime.equals("audio/mpeg")) return "MP3";
    if (mime.equals("audio/mp4a-latm")) return "AAC";
    if (mime.equals("audio/alac")) return "ALAC";   // BUG #27: file-info path is not gated by readLossy, so name the real codec instead of "AAC"
    if (mime.equals("audio/opus")) return "Opus";
    if (mime.equals("audio/vorbis")) return "Vorbis";
    return fileName.toLowerCase(Locale.ROOT).endsWith(".mp3") ? "MP3" : "AAC";
  }
  public static void main(String[] a) {
    String[][] cases = {{"x.mp3","audio/mpeg"},{"x.m4a","audio/mp4a-latm"},{"x.m4a","audio/alac"},{"x.opus","audio/opus"},{"x.ogg","audio/vorbis"},{"x.MP3",""},{"x.m4a",""}};
    for (String[] c : cases) System.out.println(c[0]+" / "+c[1]+" -> "+lossyLabel(c[0], c[1]));
  }
}

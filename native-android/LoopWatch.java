package com.liquid.flacplayer;

/**
 * Pure rules (no Android) that decide when playback has LOOPED, so ListenTracker can close the finished pass and start a new play.
 * Before this, a loop was only noticed through Player.onMediaItemTransition(REPEAT). A repeat that did not raise it (repeat-all with one song, a seek back to 0 at the end, the A-B loop,
 * which is a plain seek inside one song) became ONE endless play: the listening time was kept, but the play was counted once. tests/loopwatch.test.mjs compiles and runs this class.
 */
final class LoopWatch {
  private LoopWatch() { }

  static final long QUALIFY_MS = 10_000;     // same rule as ListenTracker / listenstats.js: 10 s of listening or half the song / loop
  static final long END_ZONE_MS = 2_500;     // a jump back that starts this close to the end of the song is a repeat
  static final long START_ZONE_MS = 3_000;   // ... and lands this close to the start
  static final long MIN_BACK_MS = 1_000;     // a backward jump smaller than this is a nudge on the scrubber, not a loop
  static final long DEBOUNCE_MS = 400;       // two signals for the same wrap (discontinuity + transition + heartbeat) count once

  /** Wrap at the end of a song: it jumped back close to the start from close to the end. `dur` <= 0 (unknown length) never matches. */
  static boolean endWrap(long prevPos, long newPos, long dur) {
    return dur > 0 && prevPos >= 0 && newPos >= 0 && prevPos >= dur - END_ZONE_MS && newPos <= START_ZONE_MS && newPos < prevPos - MIN_BACK_MS;
  }

  /** Heartbeat check: since the last look (`elapsed` ms of real playing) the song must have reached its end, and the position now is where a restart would put it. Needs no callback. */
  static boolean passedEnd(long prevPos, long newPos, long elapsed, long dur) {
    return dur > 0 && prevPos >= 0 && prevPos <= dur + END_ZONE_MS && newPos >= 0 && elapsed > 0 && newPos < prevPos - MIN_BACK_MS && prevPos + elapsed >= dur - END_ZONE_MS && newPos <= prevPos + elapsed - dur + END_ZONE_MS + START_ZONE_MS;
  }

  /** The A-B loop jumped back (the page tagged that seek as a loop jump). The length of the pass is how far back it went. */
  static boolean abWrap(long prevPos, long newPos) {
    return prevPos >= 0 && newPos >= 0 && prevPos - newPos >= MIN_BACK_MS;
  }

  /** Length of the loop region for a wrap (the whole song for a song repeat, the A-B span for an A-B loop). 0 = unknown. */
  static long region(boolean ab, long prevPos, long newPos, long dur) {
    return ab ? Math.max(0, prevPos - newPos) : Math.max(0, dur);
  }

  /** Listening needed for a play: 10 s, or half the song (half the loop span inside an A-B loop) when that is shorter. `base` <= 0 = length unknown -> 10 s. */
  static long threshold(long base) {
    return base > 0 ? Math.min(QUALIFY_MS, base / 2) : QUALIFY_MS;
  }

  /** True when a wrap signal arrives too soon after the previous one (the same wrap reported twice). */
  static boolean duplicate(long nowMono, long lastWrapMono) {
    return lastWrapMono > 0 && nowMono - lastWrapMono < DEBOUNCE_MS;
  }
}

package com.liquid.flacplayer;

/** BUG-277: the scan worker count as a pure function (extracted unchanged from LiquidNative.scanThreads) so it can be tested without Android. */
final class ScanSizing {
  private ScanSizing() { }

  /** BUG-052: worst case of ONE scan worker, in MB (see LiquidNative.SCAN_WORKER_MB). */
  static final long WORKER_MB = 20;

  /** 4 workers per core, never more than the heap allows (heapMb / WORKER_MB), never fewer than 1. */
  static int threads(long cores, long heapMb) {
    return (int) Math.max(1L, Math.min(cores * 4L, heapMb / WORKER_MB));
  }
}

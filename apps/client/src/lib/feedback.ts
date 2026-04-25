/**
 * VeilChat feedback bus.
 *
 * Couples sound + haptics into a single semantic call so UI code never
 * has to reach into either module directly. Each "moment" plays the
 * matched audio motif and the matched haptic pattern in lockstep so the
 * two senses agree — that's the perceptual trick that makes an app
 * feel alive instead of just animated.
 */

import {
  playErrorTone,
  playReceiveTone,
  playSendTone,
  playSuccessTone,
  playTapTone,
} from "./sound";
import {
  hapticError,
  hapticReceive,
  hapticSoft,
  hapticSuccess,
  hapticTap,
} from "./haptics";
import { isFocusActiveNow } from "./focusMode";

export const feedback = {
  /** A normal UI tap (button, list row, toggle). */
  tap(): void {
    hapticTap();
    playTapTone();
  },
  /** A confirm-style tap (primary action, send button itself). */
  press(): void {
    hapticSoft();
    playTapTone();
  },
  /** Outgoing message left the device. */
  send(): void {
    hapticSuccess();
    playSendTone();
  },
  /**
   * Incoming message landed (only fired if it actually appended).
   * `packKey` lets the caller pick a per-contact sound pack — see
   * `chatPersonality.SOUND_PACKS`. Falls back to the global VeilChat
   * receive motif when omitted.
   *
   * Focus Mode (Principle #4) silences this entire path — the
   * message still appends to the UI, we just refuse to interrupt
   * the user with a sound or vibration.
   */
  receive(packKey?: string): void {
    if (isFocusActiveNow()) return;
    hapticReceive();
    playReceiveTone(packKey);
  },
  /** Generic success ack (pinned, muted, copied, etc). */
  success(): void {
    hapticSoft();
    playSuccessTone();
  },
  /** Action failed. */
  error(): void {
    hapticError();
    playErrorTone();
  },
};

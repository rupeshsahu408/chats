/**
 * Veil feedback bus.
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
  /** Incoming message landed (only fired if it actually appended). */
  receive(): void {
    hapticReceive();
    playReceiveTone();
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

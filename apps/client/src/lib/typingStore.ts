import { create } from "zustand";

/**
 * Tracks "who is currently typing/recording/picking-a-photo" so the
 * chat list (and any other surface) can render a live activity hint
 * on a peer's row before the user opens the conversation.
 *
 * Server emits `typing` events as ephemeral pings — `typing: true`
 * arrives every few keystrokes and `typing: false` arrives when the
 * peer pauses. We mirror that into a per-peer entry that auto-expires
 * after a safety TTL, so a dropped "stop" message never leaves a
 * stale "typing…" frozen on the chat list.
 */

export type TypingKind = "text" | "voice" | "photo";

interface TypingEntry {
  kind: TypingKind;
  /** Epoch ms when this state should be auto-cleared. */
  expiresAt: number;
}

interface TypingState {
  byPeer: Record<string, TypingEntry | undefined>;
  setTyping: (peerId: string, typing: boolean, kind?: TypingKind) => void;
  clearTyping: (peerId: string) => void;
  /** Convenience: returns the kind if the peer is actively typing now. */
  activeKind: (peerId: string) => TypingKind | null;
}

const SAFETY_TTL_MS = 6_000;

export const useTypingStore = create<TypingState>((set, get) => ({
  byPeer: {},
  setTyping: (peerId, typing, kind = "text") => {
    set((s) => {
      const next = { ...s.byPeer };
      if (typing) {
        next[peerId] = { kind, expiresAt: Date.now() + SAFETY_TTL_MS };
      } else {
        delete next[peerId];
      }
      return { byPeer: next };
    });
  },
  clearTyping: (peerId) => {
    set((s) => {
      if (!s.byPeer[peerId]) return s;
      const next = { ...s.byPeer };
      delete next[peerId];
      return { byPeer: next };
    });
  },
  activeKind: (peerId) => {
    const entry = get().byPeer[peerId];
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null;
    return entry.kind;
  },
}));

/**
 * Periodically prune entries whose safety TTL has elapsed. One module-
 * level interval is enough — the chat list re-renders on store updates
 * and reads `activeKind` which double-checks the timestamp anyway.
 */
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const { byPeer } = useTypingStore.getState();
    let dirty = false;
    const next: Record<string, TypingEntry | undefined> = { ...byPeer };
    for (const [peerId, entry] of Object.entries(byPeer)) {
      if (entry && entry.expiresAt < now) {
        delete next[peerId];
        dirty = true;
      }
    }
    if (dirty) useTypingStore.setState({ byPeer: next });
  }, 1_500);
}

/** Human label for the chat-list subtitle / inline hint. */
export function typingLabel(kind: TypingKind): string {
  if (kind === "voice") return "🎤 recording…";
  if (kind === "photo") return "📷 sharing a photo…";
  return "typing…";
}

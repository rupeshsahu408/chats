import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

/**
 * Slide-to-verify bot challenge.
 *
 * Asks the server for a puzzle (background SVG with a hole + matching
 * piece SVG), lets the user drag the piece horizontally to align it
 * with the hole, then posts the final X to the server and bubbles up
 * the resulting one-shot token via `onSolved`.
 */
export function SlidePuzzle({
  onSolved,
}: {
  onSolved: (token: string) => void;
}) {
  const issue = trpc.auth.issueBotChallenge.useMutation();
  const verify = trpc.auth.verifyBotChallenge.useMutation();

  const [puzzle, setPuzzle] = useState<Awaited<
    ReturnType<typeof issue.mutateAsync>
  > | null>(null);
  const [pieceX, setPieceX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "fail" | "ok">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startPieceXRef = useRef(0);
  // True once the pointer has actually travelled — prevents a no-op
  // tap on the piece from burning a server-issued challenge.
  const movedRef = useRef(false);

  async function loadPuzzle() {
    setErr(null);
    setStatus("idle");
    setPieceX(0);
    try {
      const p = await issue.mutateAsync();
      setPuzzle(p);
    } catch (e) {
      setErr((e as Error).message ?? "Could not load puzzle.");
    }
  }

  useEffect(() => {
    void loadPuzzle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clientX(e: PointerEvent | React.PointerEvent): number {
    return "clientX" in e ? e.clientX : 0;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!puzzle || status === "checking" || status === "ok") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    startXRef.current = clientX(e);
    startPieceXRef.current = pieceX;
    movedRef.current = false;
    setStatus("idle");
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !puzzle) return;
    const dx = clientX(e) - startXRef.current;
    if (Math.abs(dx) > 2) movedRef.current = true;
    const max = puzzle.puzzleWidth - puzzle.pieceWidth;
    const next = Math.min(max, Math.max(0, startPieceXRef.current + dx));
    setPieceX(next);
  }

  async function onPointerUp() {
    if (!dragging || !puzzle) return;
    setDragging(false);
    // No movement = no attempt. Don't burn a fresh challenge on a
    // misclick or someone exploring the page.
    if (!movedRef.current) return;
    setStatus("checking");
    try {
      const r = await verify.mutateAsync({
        challengeId: puzzle.challengeId,
        guessX: Math.round(pieceX),
      });
      if (r.ok && r.token) {
        setStatus("ok");
        onSolved(r.token);
      } else {
        setStatus("fail");
        // Auto-load a fresh puzzle after a short pause.
        setTimeout(() => {
          void loadPuzzle();
        }, 700);
      }
    } catch (e) {
      setStatus("fail");
      setErr((e as Error).message ?? "Verification failed.");
      setTimeout(() => {
        void loadPuzzle();
      }, 700);
    }
  }

  if (!puzzle) {
    return (
      <div className="w-full rounded-xl bg-surface border border-line p-6 text-center text-sm text-text-muted">
        Loading puzzle…
      </div>
    );
  }

  const ringColour =
    status === "ok"
      ? "ring-2 ring-wa-green"
      : status === "fail"
        ? "ring-2 ring-red-500"
        : "ring-1 ring-line";

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        ref={trackRef}
        className={`relative rounded-xl overflow-hidden ${ringColour} bg-surface select-none touch-none`}
        style={{
          width: "100%",
          aspectRatio: `${puzzle.puzzleWidth} / ${puzzle.puzzleHeight}`,
          maxWidth: puzzle.puzzleWidth,
        }}
      >
        <img
          src={puzzle.background}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <img
          src={puzzle.piece}
          alt=""
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute pointer-events-auto cursor-grab ${
            dragging ? "cursor-grabbing" : ""
          }`}
          style={{
            left: `${(pieceX / puzzle.puzzleWidth) * 100}%`,
            top: `${(puzzle.pieceY / puzzle.puzzleHeight) * 100}%`,
            width: `${(puzzle.pieceWidth / puzzle.puzzleWidth) * 100}%`,
            height: `${(puzzle.pieceHeight / puzzle.puzzleHeight) * 100}%`,
            transition: dragging ? "none" : "left 200ms ease",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
          }}
        />
      </div>

      <p className="text-center text-xs text-text-muted">
        {status === "ok"
          ? "Verified ✓"
          : status === "checking"
            ? "Checking…"
            : status === "fail"
              ? "Not quite — try again"
              : "Drag the piece into the matching hole"}
      </p>

      {err && <p className="text-center text-xs text-red-500">{err}</p>}
    </div>
  );
}

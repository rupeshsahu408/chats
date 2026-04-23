import { useEffect, useState } from "react";
import { wsClient } from "../lib/wsClient";

/**
 * Tiny header indicator for the live realtime channel.
 *
 * Shown to every user but labelled "pulse" — intentionally opaque so
 * only the owner knows it tracks WebSocket health. Green = WS open,
 * grey = closed/connecting/reconnecting.
 */
export function WsHealthDot() {
  const [open, setOpen] = useState<boolean>(() => wsClient.isOpen());

  useEffect(() => {
    const tick = () => setOpen(wsClient.isOpen());
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-oncolor/70 select-none"
      title={open ? "pulse: live" : "pulse: offline"}
      aria-label={open ? "pulse: live" : "pulse: offline"}
    >
      <span
        className={
          "inline-block w-1.5 h-1.5 rounded-full " +
          (open
            ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]"
            : "bg-zinc-400/70")
        }
      />
      <span className="opacity-80">pulse</span>
    </span>
  );
}

/**
 * AppErrorBoundary — last line of defence for unhandled render errors.
 *
 * Replaces React's default white-screen-of-death with a polished,
 * branded recovery card: clear explanation, big "Reload" button, soft
 * "Go to chats" escape hatch, and a collapsible technical detail panel
 * for power users. We also surface a toast so the user gets immediate
 * feedback the moment the boundary fires (in case the fallback UI is
 * scrolled out of view inside a nested boundary).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { humanizeError } from "../lib/humanizeError";
import { toast } from "../lib/toast";

type Props = { children: ReactNode };
type State = { error: Error | null; details?: string };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort console — useful for the user's devtools.
    // eslint-disable-next-line no-console
    console.error("[VeilChat] Render error caught by boundary:", error, info);
    this.setState({ details: info.componentStack ?? undefined });
    try {
      const friendly = humanizeError(error);
      toast.error(error, {
        title: friendly.title,
        message: friendly.message,
      });
    } catch {
      /* Toast subsystem may itself be the source — best-effort only. */
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    // Use full navigation so even a crashed router state is replaced.
    window.location.href = "/chats";
  };

  render() {
    if (!this.state.error) return this.props.children;
    const friendly = humanizeError(this.state.error);
    return (
      <main className="min-h-full flex items-center justify-center bg-bg text-text px-6 py-10">
        <div
          role="alert"
          className={
            "w-full max-w-md rounded-2xl border border-red-500/25 " +
            "bg-surface/95 [backdrop-filter:saturate(180%)_blur(12px)] " +
            "[box-shadow:0_10px_30px_rgb(11_20_26/0.18),0_2px_8px_rgb(11_20_26/0.10)] " +
            "p-6 flex flex-col gap-5"
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                "shrink-0 size-12 rounded-2xl grid place-items-center " +
                "bg-red-500/12 text-red-600 dark:text-red-300 ring-1 ring-red-500/25"
              }
              aria-hidden
            >
              <svg
                viewBox="0 0 24 24"
                width={22}
                height={22}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 4 2.5 20h19L12 4z" />
                <path d="M12 10v4" />
                <path d="M12 17.25v.01" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-[18px] tracking-tight text-text leading-tight">
                {friendly.title}
              </h1>
              <p className="text-[14px] text-text-muted mt-1 leading-snug">
                {friendly.message}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleReload}
              className={
                "w-full h-11 rounded-full px-5 font-semibold text-[14.5px] tracking-tight " +
                "text-text-oncolor bg-gradient-to-b from-wa-green to-wa-green-dark " +
                "hover:[box-shadow:0_8px_24px_rgba(0,168,132,0.28)] " +
                "transition-[box-shadow] duration-150 wa-tap"
              }
            >
              Reload the app
            </button>
            <button
              onClick={this.handleHome}
              className={
                "w-full h-11 rounded-full px-5 font-semibold text-[14.5px] tracking-tight " +
                "border border-line/80 bg-surface/60 hover:bg-surface text-text " +
                "transition-colors duration-150 wa-tap"
              }
            >
              Go to chats
            </button>
          </div>

          {(this.state.error?.message || this.state.details) && (
            <details className="group">
              <summary
                className={
                  "cursor-pointer text-[12px] uppercase tracking-[0.08em] " +
                  "text-text-faint hover:text-text-muted transition-colors " +
                  "list-none flex items-center gap-1.5 select-none"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  width={12}
                  height={12}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-150 group-open:rotate-90"
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                Technical details
              </summary>
              <pre
                className={
                  "mt-2 max-h-48 overflow-auto rounded-lg border border-line/60 " +
                  "bg-elevated/60 p-3 text-[11.5px] leading-snug text-text-muted " +
                  "whitespace-pre-wrap break-words"
                }
              >
                {(this.state.error?.message ?? "") +
                  (this.state.details ? "\n" + this.state.details : "")}
              </pre>
            </details>
          )}
        </div>
      </main>
    );
  }
}

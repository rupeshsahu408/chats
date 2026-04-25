import { Link } from "react-router-dom";
import {
  ChatIcon,
  Logo,
  PeopleIcon,
  SettingsIcon,
} from "./Layout";

/**
 * Desktop-only left side rail. Hidden below the lg breakpoint.
 *
 * Visual model: a slim vertical column (240px) with the brand mark
 * at the top and a stack of large, comfortable nav items. The
 * active item gets a soft accent-tinted "pill" background so it
 * reads as the current section without being loud.
 *
 * Extracted from MainShell so the desktop two-pane chat shell can
 * reuse the exact same nav without duplicating markup.
 */
export function SideRail({
  active,
}: {
  active: "chats" | "people" | "settings";
}) {
  const items = [
    {
      id: "chats" as const,
      label: "Chats",
      to: "/chats",
      icon: <ChatIcon />,
      hint: "Conversations",
    },
    {
      id: "people" as const,
      label: "People",
      to: "/connections",
      icon: <PeopleIcon />,
      hint: "Connections",
    },
    {
      id: "settings" as const,
      label: "Settings",
      to: "/settings",
      icon: <SettingsIcon />,
      hint: "Preferences",
    },
  ];
  return (
    <aside
      aria-label="Primary navigation"
      className={
        "hidden lg:flex shrink-0 " +
        "w-[240px] xl:w-[260px] " +
        "h-screen sticky top-0 " +
        "flex-col " +
        "bg-panel border-r border-line/60 " +
        "[box-shadow:1px_0_0_rgba(11,20,26,0.04)]"
      }
    >
      {/* Brand block */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-line/60">
        <Logo size={32} />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-text">
            Veil
          </div>
          <div className="text-[11px] text-text-muted">
            End-to-end encrypted
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <Link
              key={it.id}
              to={it.to}
              aria-current={isActive ? "page" : undefined}
              className={
                "group relative flex items-center gap-3 " +
                "px-3 py-2.5 rounded-xl " +
                "text-[14px] font-semibold tracking-tight " +
                "transition-colors duration-150 ease-veil-soft wa-tap " +
                (isActive
                  ? "bg-wa-green-soft text-wa-green-dark"
                  : "text-text-muted hover:text-text hover:bg-surface/70")
              }
            >
              <span
                className={
                  "shrink-0 grid place-items-center w-7 h-7 rounded-lg " +
                  (isActive
                    ? "text-wa-green-dark"
                    : "text-text-muted group-hover:text-text")
                }
              >
                {it.icon}
              </span>
              <span className="flex-1 truncate">{it.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className={
                    "absolute left-0 top-1/2 -translate-y-1/2 " +
                    "h-6 w-[3px] rounded-r-full bg-wa-green " +
                    "[box-shadow:0_0_10px_rgb(0_168_132/0.45)]"
                  }
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="px-5 py-4 border-t border-line/60">
        <div className="text-[11px] text-text-muted leading-snug">
          Your messages are end-to-end encrypted. Only you and the
          person you're chatting with can read them.
        </div>
      </div>
    </aside>
  );
}

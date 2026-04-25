import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AppBar,
  ChatIcon,
  Logo,
  PeopleIcon,
  SettingsIcon,
} from "./Layout";
import { WsHealthDot } from "./WsHealthDot";
import { HeaderMenu } from "./HeaderMenu";

/**
 * Shared shell for the three primary tabs: Chats, People, Settings.
 *
 * Responsive behaviour:
 *   - Mobile (< lg): top app bar + below-bar tab strip + full-width
 *     content. WhatsApp Android style.
 *   - Tablet (md-lg): same as mobile, with content centered and a
 *     comfortable max-width applied per page.
 *   - Desktop (≥ lg): a left side rail with the three primary tabs
 *     (logo at the top, Chats/People/Settings, premium "active pill")
 *     replaces the top tab strip. The app bar still sits above the
 *     content area for the page title and right-side actions.
 *
 * Nothing is removed — the same three tabs simply morph from a
 * horizontal strip into a vertical rail at desktop widths.
 */
export function MainShell({
  active,
  children,
  rightActions,
  title = "Veil",
}: {
  active: "chats" | "people" | "settings";
  children: ReactNode;
  rightActions?: ReactNode;
  title?: string;
}) {
  return (
    <main className="min-h-full flex bg-bg text-text">
      {/* ─── Desktop side rail (lg+) ─── */}
      <SideRail active={active} />

      {/* ─── Main column (everything to the right of the rail on desktop) ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AppBar
          title={title}
          right={
            <>
              <WsHealthDot />
              {rightActions ?? <HeaderMenu />}
            </>
          }
        />
        {/* Mobile / tablet: top tab strip. Hidden on desktop because
            the side rail covers the same nav. */}
        <TabStrip active={active} className="lg:hidden" />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </main>
  );
}

/**
 * Premium tab strip.
 *
 * Sits on a neutral panel surface (rather than the brand bar) so the
 * navigation reads as elegant and content-first instead of bold and
 * branded. The active tab uses the accent color for both icon and
 * label, with a smooth pill-shaped underline that animates between
 * tabs. Inactive tabs are muted text with a quiet hover wash.
 */
function TabStrip({
  active,
  className,
}: {
  active: "chats" | "people" | "settings";
  className?: string;
}) {
  const tabs = [
    { id: "chats" as const, label: "Chats", to: "/chats", icon: <ChatIcon /> },
    {
      id: "people" as const,
      label: "People",
      to: "/connections",
      icon: <PeopleIcon />,
    },
    {
      id: "settings" as const,
      label: "Settings",
      to: "/settings",
      icon: <SettingsIcon />,
    },
  ];
  return (
    <nav
      className={
        "bg-panel text-text flex sticky top-14 z-10 " +
        "border-b border-line/60 " +
        "[box-shadow:0_1px_0_rgba(11,20,26,0.04)] " +
        (className ?? "")
      }
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            to={t.to}
            className={
              "flex-1 h-12 flex items-center justify-center gap-2 wa-tap " +
              "text-[12.5px] font-semibold tracking-tight " +
              "transition-colors duration-150 ease-veil-soft relative " +
              (isActive
                ? "text-wa-green"
                : "text-text-muted hover:text-text hover:bg-surface/60")
            }
            aria-current={isActive ? "page" : undefined}
          >
            <span className={isActive ? "opacity-100" : "opacity-90"}>
              {t.icon}
            </span>
            <span className="hidden sm:inline">{t.label}</span>
            {isActive && (
              <span
                className={
                  "absolute bottom-0 left-1/2 -translate-x-1/2 " +
                  "h-[3px] w-10 rounded-t-full bg-wa-green " +
                  "[box-shadow:0_0_12px_rgb(0_168_132/0.45)] " +
                  "animate-fade-in"
                }
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Desktop-only left side rail. Hidden below the lg breakpoint.
 *
 * Visual model: a slim vertical column (240px) with the brand mark
 * at the top and a stack of large, comfortable nav items. The
 * active item gets a soft accent-tinted "pill" background so it
 * reads as the current section without being loud.
 */
function SideRail({
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

/** Used by the invite redeem page that sits "between" pages. */
export function useTabFromPath(): "chats" | "people" | "settings" | null {
  const loc = useLocation();
  if (loc.pathname.startsWith("/chats")) return "chats";
  if (loc.pathname.startsWith("/connections")) return "people";
  if (loc.pathname.startsWith("/settings")) return "settings";
  return null;
}

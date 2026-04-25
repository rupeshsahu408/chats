import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AppBar,
  ChatIcon,
  PeopleIcon,
  SettingsIcon,
} from "./Layout";
import { WsHealthDot } from "./WsHealthDot";
import { HeaderMenu } from "./HeaderMenu";
import { SideRail } from "./SideRail";

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

/** Used by the invite redeem page that sits "between" pages. */
export function useTabFromPath(): "chats" | "people" | "settings" | null {
  const loc = useLocation();
  if (loc.pathname.startsWith("/chats")) return "chats";
  if (loc.pathname.startsWith("/connections")) return "people";
  if (loc.pathname.startsWith("/settings")) return "settings";
  return null;
}

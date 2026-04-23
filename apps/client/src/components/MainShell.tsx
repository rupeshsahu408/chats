import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AppBar,
  IconButton,
  MoreVerticalIcon,
  ChatIcon,
  PeopleIcon,
  SettingsIcon,
} from "./Layout";
import { WsHealthDot } from "./WsHealthDot";

/**
 * Shared shell for the three primary tabs: Chats, People, Settings.
 * Top app bar + below-bar tab strip (WhatsApp Android style).
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
    <main className="min-h-full flex flex-col bg-bg text-text">
      <AppBar
        title={title}
        right={
          <>
            <WsHealthDot />
            {rightActions ?? (
              <IconButton label="Menu" className="text-text-oncolor">
                <MoreVerticalIcon />
              </IconButton>
            )}
          </>
        }
      />
      <TabStrip active={active} />
      <div className="flex-1 flex flex-col">{children}</div>
    </main>
  );
}

function TabStrip({ active }: { active: "chats" | "people" | "settings" }) {
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
    <nav className="bg-bar text-text-oncolor flex shadow-bar sticky top-14 z-10">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            to={t.to}
            className={
              "flex-1 h-12 flex items-center justify-center gap-2 wa-tap text-sm font-medium uppercase tracking-wide transition relative " +
              (isActive
                ? "text-text-oncolor"
                : "text-text-oncolor/70 hover:text-text-oncolor")
            }
          >
            <span className="opacity-90">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-text-oncolor rounded-t" />
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

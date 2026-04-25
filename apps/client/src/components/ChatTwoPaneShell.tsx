import type { ReactNode } from "react";
import { SideRail } from "./SideRail";
import { InboxListPane, GroupListPane } from "./ChatListPane";

/**
 * Desktop two-pane chat shell — WhatsApp-Web style.
 *
 * On lg+ screens this renders a three-column layout:
 *   [SideRail (240px)] [ChatList (320–360px)] [Open thread (children)]
 *
 * On mobile/tablet (< lg) the SideRail and the list pane both
 * collapse out, so the open thread fills the entire viewport
 * exactly as before — preserving the mobile-first UX without any
 * extra navigation chrome on small screens.
 *
 * Used by ChatThreadPage (kind="direct") and GroupChatPage
 * (kind="group") to wrap their existing AppBar + scroll + composer
 * stack. The wrapped children should use `flex flex-col flex-1
 * min-h-0` so the inner column behaves correctly inside the flex
 * row at desktop widths.
 */
export function ChatTwoPaneShell({
  kind,
  activeId,
  children,
}: {
  kind: "direct" | "group";
  activeId?: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full flex bg-bg text-text">
      <SideRail active="chats" />
      {kind === "direct" ? (
        <InboxListPane currentPeerId={activeId} className="hidden lg:flex" />
      ) : (
        <GroupListPane currentGroupId={activeId} className="hidden lg:flex" />
      )}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

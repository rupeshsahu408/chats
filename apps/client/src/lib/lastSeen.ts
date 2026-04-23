/** Format an ISO timestamp into a human-friendly "last seen" label. */
export function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(dayStart.getTime() - 86_400_000);
  const weekStart = new Date(dayStart.getTime() - 6 * 86_400_000);

  if (date >= dayStart) {
    return `today at ${timeStr}`;
  }
  if (date >= yesterdayStart) {
    return `yesterday at ${timeStr}`;
  }
  if (date >= weekStart) {
    const day = date.toLocaleDateString([], { weekday: "long" });
    return `${day} at ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return `${dateStr} at ${timeStr}`;
}

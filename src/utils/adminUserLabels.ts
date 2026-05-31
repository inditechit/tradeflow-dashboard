import { API_BASE } from "@/config/api";

export type UserLabelEntry = {
  label?: string;
  tags: string[];
};

export function parseUserLabels(user: {
  admin_label?: unknown;
  admin_tags?: unknown;
}): UserLabelEntry {
  const label = user.admin_label != null ? String(user.admin_label).trim() : "";
  let tags: string[] = [];
  const raw = user.admin_tags;

  if (Array.isArray(raw)) {
    tags = raw.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        tags = parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      tags = [];
    }
  }

  return { label, tags };
}

export async function saveUserLabels(
  userId: number | string,
  entry: UserLabelEntry,
): Promise<UserLabelEntry> {
  const tags = entry.tags.map((t) => t.trim()).filter(Boolean);
  const label = entry.label?.trim() ?? "";

  const res = await fetch(`${API_BASE}/admin/users/${userId}/labels`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, tags }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to save labels");
  }

  return {
    label: data.label ?? "",
    tags: Array.isArray(data.tags) ? data.tags : tags,
  };
}

export async function fetchAllUsedTags(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/user-tags`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.tags)) return [];
    return data.tags;
  } catch {
    return [];
  }
}

export function collectAllTagsFromUsers(
  users: Array<{ admin_label?: unknown; admin_tags?: unknown }>,
): string[] {
  const set = new Set<string>();
  users.forEach((u) => {
    parseUserLabels(u).tags.forEach((t) => set.add(t));
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const PRESET_TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
];

export function tagColorClass(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRESET_TAG_COLORS[Math.abs(hash) % PRESET_TAG_COLORS.length];
}

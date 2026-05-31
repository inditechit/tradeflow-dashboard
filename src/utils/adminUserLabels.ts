const STORAGE_KEY = "admin_user_labels_v1";

export type UserLabelEntry = {
  label?: string;
  tags: string[];
};

export type UserLabelsMap = Record<string, UserLabelEntry>;

function readAll(): UserLabelsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UserLabelsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: UserLabelsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getUserLabels(userId: number | string): UserLabelEntry {
  const map = readAll();
  const entry = map[String(userId)];
  return {
    label: entry?.label ?? "",
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
  };
}

export function setUserLabels(userId: number | string, entry: UserLabelEntry) {
  const map = readAll();
  const tags = entry.tags.map((t) => t.trim()).filter(Boolean);
  const label = entry.label?.trim() ?? "";
  if (!label && tags.length === 0) {
    delete map[String(userId)];
  } else {
    map[String(userId)] = { label, tags };
  }
  writeAll(map);
}

export function getAllUsedTags(): string[] {
  const map = readAll();
  const set = new Set<string>();
  Object.values(map).forEach((entry) => {
    entry.tags?.forEach((t) => {
      const trimmed = t.trim();
      if (trimmed) set.add(trimmed);
    });
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

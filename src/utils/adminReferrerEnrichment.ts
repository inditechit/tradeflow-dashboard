import { API_BASE } from "@/config/api";

export type ReferrerFields = {
  referrer_id?: number | null;
  referrer_name?: string | null;
  referrer_telegram?: string | null;
  referrer_email?: string | null;
};

/** Load referrer info for all users (paginated). Works even when /admin/users omits referrer columns. */
export async function fetchReferrerByUserIdMap(
  apiBase: string = API_BASE,
): Promise<Record<number, ReferrerFields>> {
  const limit = 1000;
  let offset = 0;
  let total = Infinity;
  const map: Record<number, ReferrerFields> = {};

  while (offset < total) {
    const res = await fetch(`${apiBase}/admin/referrals?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) break;

    for (const row of data.data) {
      const uid = Number(row.id);
      if (!uid) continue;
      map[uid] = {
        referrer_id: row.referrer_id != null ? Number(row.referrer_id) : null,
        referrer_name: row.referrer_name ?? null,
        referrer_telegram: row.referrer_telegram ?? null,
        referrer_email: row.referrer_email ?? null,
      };
    }

    total = Number(data.total ?? offset + data.data.length);
    offset += data.data.length;
    if (data.data.length === 0) break;
  }

  return map;
}

export function mergeUserReferrerFields<T extends Record<string, unknown>>(
  users: T[],
  referrerMap: Record<number, ReferrerFields>,
): T[] {
  return users.map((user) => {
    if (user.referrer_id != null || user.referrer_name) return user;
    const uid = Number(user.id);
    const ref = referrerMap[uid];
    return ref ? { ...user, ...ref } : user;
  });
}

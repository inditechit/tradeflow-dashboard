import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicMarketingChrome } from "@/components/marketing/PublicMarketingChrome";
import { API_BASE } from "@/config/api";
import { usePageMeta } from "@/hooks/usePageMeta";

type BlogListItem = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export default function BlogsPage() {
  usePageMeta(
    "Blog",
    "Guides and updates from Copy Trade Engine on gold copy trading, risk, and platform features.",
  );

  const [posts, setPosts] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/blogs?limit=50`);
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to load");
        if (!cancelled) setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicMarketingChrome>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-slate-900">Blog</h1>
        <p className="mt-3 max-w-xl text-lg text-slate-600">
          Product notes, market context, and how Copy Trade Engine thinks about risk.
        </p>

        {loading ? <p className="mt-12 text-slate-500">Loading…</p> : null}
        {error ? <p className="mt-12 text-red-700">{error}</p> : null}
        {!loading && !error && posts.length === 0 ? (
          <p className="mt-12 text-slate-500">No posts published yet. Check back soon.</p>
        ) : null}

        {posts.length > 0 ? (
          <ul className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {posts.map((post) => {
              const date = formatDate(post.published_at);
              return (
                <li key={post.id}>
                  <Link
                    to={`/blogs/${post.slug}`}
                    className="group flex flex-col gap-2 py-6 transition hover:bg-slate-50/80 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 group-hover:text-amber-900">
                        {post.title}
                      </h2>
                      {post.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>
                      ) : null}
                    </div>
                    {date ? (
                      <time className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {date}
                      </time>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </PublicMarketingChrome>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicMarketingChrome } from "@/components/marketing/PublicMarketingChrome";
import { API_BASE } from "@/config/api";
import { usePageMeta } from "@/hooks/usePageMeta";
import { markdownToHtml } from "@/lib/markdown";

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body_md: string;
  published_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageMeta(
    post?.title || "Blog post",
    post?.excerpt || "Copy Trade Engine blog",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/public/blogs/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || "Not found");
        if (!cancelled) setPost(data.post ?? null);
      } catch (err) {
        if (!cancelled) {
          setPost(null);
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <PublicMarketingChrome>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link to="/blogs" className="text-sm font-semibold text-amber-800 hover:underline">
          ← All posts
        </Link>

        {loading ? <p className="mt-10 text-slate-500">Loading…</p> : null}
        {error && !loading ? (
          <div className="mt-10">
            <h1 className="text-3xl font-bold text-slate-900">Post not found</h1>
            <p className="mt-2 text-slate-600">{error}</p>
          </div>
        ) : null}

        {post && !loading ? (
          <>
            <header className="mt-6">
              <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
                {post.title}
              </h1>
              {formatDate(post.published_at) ? (
                <time className="mt-3 block text-sm font-medium text-slate-500">
                  {formatDate(post.published_at)}
                </time>
              ) : null}
              {post.excerpt ? (
                <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p>
              ) : null}
            </header>
            {post.cover_image_url ? (
              <img
                src={post.cover_image_url}
                alt=""
                className="mt-8 w-full rounded-2xl object-cover"
              />
            ) : null}
            <div
              className="prose prose-slate mt-10 max-w-none prose-a:text-amber-800 prose-headings:text-slate-900"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(post.body_md || "") }}
            />
          </>
        ) : null}
      </article>
    </PublicMarketingChrome>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_url: string | null;
  status: string;
  published_at: string | null;
  updated_at?: string;
};

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  body_md: "",
  cover_image_url: "",
  status: "draft" as "draft" | "published",
};

export default function AdminBlogsPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/blogs?limit=100`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Failed to load");
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load blogs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (p: BlogPost) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || "",
      body_md: p.body_md || "",
      cover_image_url: p.cover_image_url || "",
      status: p.status === "published" ? "published" : "draft",
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        body_md: form.body_md,
        cover_image_url: form.cover_image_url.trim() || null,
        status: form.status,
      };
      const res = await fetch(
        editingId ? `${API_BASE}/admin/blogs/${editingId}` : `${API_BASE}/admin/blogs`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Save failed");
      toast({ title: editingId ? "Post updated" : "Post created" });
      startNew();
      await load();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this blog post?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/blogs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Delete failed");
      toast({ title: "Deleted" });
      if (editingId === id) startNew();
      await load();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Blogs</h1>
          <p className="text-sm text-slate-500">
            Publish posts for the public site (/blogs). Drafts stay private.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={startNew} className="bg-yellow-900 text-white hover:bg-yellow-800">
            <Plus className="mr-1.5 h-4 w-4" /> New post
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-800">
            {editingId ? `Edit #${editingId}` : "New post"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Slug (optional)</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="auto-from-title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Excerpt</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Cover image URL</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.cover_image_url}
                onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Body (Markdown)</label>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                rows={12}
                value={form.body_md}
                onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-500">Status</label>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value === "published" ? "published" : "draft",
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="bg-yellow-900 text-white hover:bg-yellow-800"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
            All posts ({posts.length})
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : posts.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No posts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {posts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 px-4 py-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => startEdit(p)}>
                    <p className="truncate font-semibold text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      <span
                        className={cn(
                          "mr-2 rounded px-1.5 py-0.5 font-semibold",
                          p.status === "published"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {p.status}
                      </span>
                      /blogs/{p.slug}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => void remove(p.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

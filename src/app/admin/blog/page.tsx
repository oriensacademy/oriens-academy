"use client";

import { useState, useEffect, useCallback } from "react";
import { BlogModal } from "@/components/admin/BlogModal";
import type { BlogPostRow, BlogPostStatus } from "@/lib/admin/blog";
import { listAdminBlogPosts, updateAdminBlogPost, deleteAdminBlogPost } from "@/lib/admin/blog";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import {
  Newspaper,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  Inbox,
  Archive,
  Eye,
  EyeOff,
} from "lucide-react";

import { useConfirmationDialog } from "@/hooks/use-confirmation-dialog";

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşivlendi",
};

const STATUS_STYLE: Record<BlogPostStatus, string> = {
  draft: "bg-muted border-border text-muted-foreground",
  published: "bg-emerald-50 border-emerald-200 text-emerald-800",
  archived: "bg-amber-50 border-amber-200 text-amber-800",
};

export default function AdminBlogPage() {
  return <BlogContent />;
}

function BlogContent() {
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPostRow | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminBlogPosts();
    setLoading(false);
    if (error) setErrorMsg(error);
    else setPosts(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminBlogPosts().then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) setErrorMsg(error);
          else setPosts(data);
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleStatusChange = async (post: BlogPostRow, status: BlogPostStatus) => {
    setStatusChangingId(post.id);
    const { success, error } = await updateAdminBlogPost(post.id, { status });
    setStatusChangingId(null);
    if (error) setErrorMsg(error);
    else if (success) fetchPosts();
  };

  const handleDelete = (post: BlogPostRow) => {
    requestConfirmation({
      title: "Blog yazısını sil",
      description: `"${post.title}" başlıklı yazı kalıcı olarak silinecek.`,
      action: async () => {
        setDeletingId(post.id);
        const { success, error } = await deleteAdminBlogPost(post.id);
        setDeletingId(null);
        if (error) setErrorMsg(error);
        else if (success) await fetchPosts();
      },
    });
  };

  return (
    <div className="space-y-6">
      {confirmationDialog}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">Blog Yönetimi</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            TR/EN blog yazılarını oluşturun, düzenleyin ve yayınlayın.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPosts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
          >
            {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>Yeni Yazı Ekle</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={fetchPosts} className="font-semibold underline hover:text-red-950">
            Tekrar Deneyin
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Blog yazıları yükleniyor…" className="text-xs text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMsg && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-white p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-foreground">Henüz Blog Yazısı Bulunmuyor</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            &quot;Yeni Yazı Ekle&quot; butonunu kullanarak ilk blog yazınızı oluşturabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
          >
            <Plus className="size-4" />
            <span>İlk Yazıyı Oluştur</span>
          </button>
        </div>
      )}

      {/* Post List (Table) */}
      {!loading && !errorMsg && posts.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background-soft text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Başlık</th>
                  <th className="px-4 py-3">Dil</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Yayın Tarihi</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.map((post) => (
                  <tr key={post.id} className="transition-colors hover:bg-background-soft/80">
                    <td className="px-4 py-3.5 font-semibold text-foreground max-w-xs truncate">{post.title}</td>
                    <td className="px-4 py-3.5 text-muted-foreground uppercase">{post.locale}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{post.slug}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[post.status as BlogPostStatus]}`}
                      >
                        {STATUS_LABEL[post.status as BlogPostStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString("tr-TR") : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {post.status !== "published" ? (
                        <button
                          type="button"
                          disabled={statusChangingId === post.id}
                          onClick={() => handleStatusChange(post, "published")}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Eye className="size-3" />
                          <span>Yayınla</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={statusChangingId === post.id}
                          onClick={() => handleStatusChange(post, "draft")}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <EyeOff className="size-3" />
                          <span>Taslağa Al</span>
                        </button>
                      )}

                      {post.status !== "archived" && (
                        <button
                          type="button"
                          disabled={statusChangingId === post.id}
                          onClick={() => handleStatusChange(post, "archived")}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >
                          <Archive className="size-3" />
                          <span>Arşivle</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingPost(post);
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3 text-muted-foreground" />
                        <span>Düzenle</span>
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === post.id}
                        onClick={() => handleDelete(post)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === post.id ? <Wave className="h-3 w-6" aria-label="Siliniyor" /> : <Trash2 className="size-3" />}
                        <span>Sil</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <BlogModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPost(null);
        }}
        onSaved={fetchPosts}
        editingPost={editingPost}
      />
    </div>
  );
}

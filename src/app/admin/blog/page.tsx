"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { queryKeys, useQuery } from "@/lib/data/query-store";
import type { BlogPostRow } from "@/lib/admin/blog";
import { archiveAdminBlogPost, listAdminBlogPosts, restoreAdminBlogPost } from "@/lib/admin/blog";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans Blog listesi (#view-blog): Aktif / Arşiv segmenti ve yazı kartları.
// Arşive taşıma geri alınabilir; arşivden çıkan yazı mevcut kurala göre taslağa döner.

const EMPTY_POSTS: BlogPostRow[] = [];

function blogDate(iso: string, withTime: boolean) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  if (!withTime) return day;
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day}, ${time}`;
}

function StatusTag({ post, now }: { post: BlogPostRow; now: number }) {
  if (post.status === "published" && post.published_at) {
    if (now && new Date(post.published_at).getTime() > now) {
      return <span className="fx-tag star">Planlandı · {blogDate(post.published_at, true)}</span>;
    }
    return <span className="fx-tag ok">Yayında · {blogDate(post.published_at, false)}</span>;
  }
  if (post.status === "published") return <span className="fx-tag ok">Yayında</span>;
  return <span className="fx-tag grey">Taslak</span>;
}

export default function AdminBlogPage() {
  const [mode, setMode] = useState<"aktif" | "arsiv">("aktif");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);
  const active = useQuery(`${queryKeys.adminBlog}:active`, () => listAdminBlogPosts({ archived: false }), { staleTime: 30_000 });
  const archived = useQuery(`${queryKeys.adminBlog}:archive`, () => listAdminBlogPosts({ archived: true }), { staleTime: 30_000 });
  const activePosts = active.data?.data ?? EMPTY_POSTS;
  const archivedPosts = archived.data?.data ?? EMPTY_POSTS;
  const current = mode === "arsiv" ? archived : active;
  const posts = mode === "arsiv" ? archivedPosts : activePosts;
  const loadError = current.data?.error || "";

  async function toggleArchive(post: BlogPostRow) {
    const restoring = post.status === "archived";
    setBusyId(post.id);
    const { success, error } = restoring ? await restoreAdminBlogPost(post.id) : await archiveAdminBlogPost(post.id);
    setBusyId(null);
    if (!success) {
      toast.error(error || "İşlem tamamlanamadı.");
      return;
    }
    toast.success(restoring ? "Yazı arşivden çıkarıldı" : "Yazı arşive taşındı");
    await Promise.all([active.refetch(), archived.refetch()]);
  }

  const emptyTitle = loadError ? "Blog yazıları yüklenemedi" : mode === "arsiv" ? "Arşiv boş" : "Henüz blog yazısı yok";
  const emptyText = loadError ? loadError : mode === "arsiv" ? "Arşive taşınan yazılar burada listelenir." : "Sağ üstteki “Yeni Yazı” ile ilk yazınızı ekleyin.";

  return (
    <div id="view-blog" className={`pgv ${pages.root}`}>
      <div className="page"><div className="wrap">
        <div className="head">
          <div><h1>Blog</h1><p>Türkçe ve İngilizce blog yazılarını oluşturun, düzenleyin ve yayınlayın.</p></div>
          <div className="fx-headr">
            <div className="seg" role="group" aria-label="Görünüm">
              <button type="button" aria-pressed={mode === "aktif"} onClick={() => setMode("aktif")}>Aktif<small>{activePosts.length}</small></button>
              <button type="button" aria-pressed={mode === "arsiv"} onClick={() => setMode("arsiv")}>Arşiv<small>{archivedPosts.length}</small></button>
            </div>
            <Link className="fx-btn primary" href="/admin/blog/editor/">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Yeni Yazı
            </Link>
          </div>
        </div>
        <section className="card">
          <div className="fx-cards" id="bl-cards">
            {posts.map((post) => (
              <article key={post.id} className="fx-post">
                <div className="fx-post-img" style={post.cover_image_url ? { background: `center/cover url("${post.cover_image_url}")` } : undefined}>
                  {post.cover_image_url ? null : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>}
                </div>
                <div className="fx-post-b">
                  <b>{post.title || "Başlıksız yazı"}</b>
                  {post.excerpt ? <p>{post.excerpt}</p> : null}
                  <span className="fx-id">/blog/{post.slug}</span>
                </div>
                <div className="fx-post-f">
                  <StatusTag post={post} now={now} />
                  <span className="fx-tag grey">{post.locale === "en" ? "EN" : "TR"}</span>
                  <div className="fx-act">
                    <Link className="fx-ib txt" href={`/admin/blog/editor/?id=${post.id}`}>Düzenle</Link>
                    <button type="button" className="fx-ib txt" disabled={busyId === post.id} onClick={() => void toggleArchive(post)}>
                      {post.status === "archived" ? "Arşivden çıkar" : "Arşive taşı"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {current.loading && !posts.length ? (
            <div className="fx-empty" id="bl-empty"><b>Blog yazıları yükleniyor…</b></div>
          ) : (
            <div className="fx-empty" id="bl-empty" hidden={posts.length > 0}>
              <span className="fx-empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" /></svg></span>
              <b>{emptyTitle}</b>
              <span>{emptyText}</span>
            </div>
          )}
        </section>
      </div></div>
    </div>
  );
}

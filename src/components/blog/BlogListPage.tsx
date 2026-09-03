"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Newspaper, UserRound } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { useLocale } from "@/content/locale-context";
import { localizedPath, blogDetailPath } from "@/lib/routes";
import { getPublicBlogPosts, type BlogPostRow } from "@/lib/admin/blog";

function formatDate(iso: string | null, locale: "tr" | "en"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function BlogListPage() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicBlogPosts(locale).then((rows) => {
      if (!active) return;
      setPosts(rows);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  return (
    <section className="section-offset relative overflow-hidden border-b border-border bg-[#F6F8F3] pt-24 pb-20 md:pt-28 md:pb-28">
      <div className="relative mx-auto max-w-[1280px] px-6 md:px-8">
        <nav aria-label={isTr ? "Sayfa yolu" : "Breadcrumb"}>
          <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href={localizedPath("home", locale)} className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">
                {isTr ? "Ana Sayfa" : "Home"}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ink">Blog</li>
          </ol>
        </nav>

        <Reveal y={8}>
          <p className="mt-6 text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">
            {isTr ? "ORIENS ACADEMY BLOG" : "ORIENS ACADEMY BLOG"}
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-[clamp(2.4rem,5vw,3.75rem)] leading-[1.05] text-ink">
            {isTr ? "Sınav hazırlığı ve üniversite kabul rehberi" : "Exam prep and university admissions insights"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {isTr
              ? "Uluslararası sınavlar, üniversite başvuru süreçleri ve akademik hazırlık üzerine güncel yazılar."
              : "Fresh writing on international exams, university application processes, and academic preparation."}
          </p>
        </Reveal>

        {!loaded ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={isTr ? "Yazılar yükleniyor" : "Loading posts"}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[360px] animate-pulse rounded-[22px] border border-[#DDE4DC] bg-white/70 motion-reduce:animate-none" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div role="status" className="mt-14 flex flex-col items-center rounded-2xl border border-dashed border-[#DDE4DC] bg-white p-12 text-center">
            <Newspaper className="size-8 text-[#819586]" />
            <p className="mt-4 max-w-md text-sm leading-6 text-[#68756C]">
              {isTr
                ? "Henüz yayınlanmış bir yazı bulunmuyor. Yakında burada olacak."
                : "No posts have been published yet. Check back soon."}
            </p>
          </div>
        ) : (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Reveal key={post.id} y={8}>
                <Link
                  href={blogDetailPath(locale, post.slug)}
                  className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[#DDE4DC] bg-white shadow-[0_10px_30px_rgba(16,39,27,.05)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {post.cover_image_url ? (
                    <div className="relative h-44 w-full overflow-hidden bg-[#EFF4EE]">
                      <Image
                        src={post.cover_image_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-[#EFF4EE] text-[#819586]">
                      <Newspaper className="size-9" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3 text-[11px] font-medium text-[#68756C]">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(post.published_at, locale)}</span>
                      {post.author_name ? (
                        <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{post.author_name}</span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 font-heading text-xl leading-snug text-ink">{post.title}</h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {isTr ? "Devamını Oku" : "Read More"}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

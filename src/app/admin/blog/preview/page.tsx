import { Suspense } from "react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { BlogPreviewPage } from "@/components/admin/BlogPreviewPage";

export default function AdminBlogPreviewRoute() {
  return (
    <Suspense fallback={<AdminWaveStatus label="Önizleme yükleniyor…" />}>
      <BlogPreviewPage />
    </Suspense>
  );
}

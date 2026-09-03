import { Suspense } from "react";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { BlogEditorPage } from "@/components/admin/BlogEditorPage";

export default function AdminBlogEditorRoute() {
  return (
    <Suspense fallback={<AdminWaveStatus label="Editör yükleniyor…" />}>
      <BlogEditorPage />
    </Suspense>
  );
}

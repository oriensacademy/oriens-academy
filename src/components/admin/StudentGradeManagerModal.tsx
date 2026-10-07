import { RefListManagerDialog } from "@/components/admin/StudentRefDialogs";
import { manageStudentGradeOption, type StudentGradeOption } from "@/lib/admin/students";

// Referans #sinif-dialog "Sınıf Yönetimi".
export function StudentGradeManagerModal({ items, onClose, onChanged }: {
  items: StudentGradeOption[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  return (
    <RefListManagerDialog
      id="sinif"
      title="Sınıf Yönetimi"
      subtitle="Öğrenci formundaki sınıf seçeneklerini düzenleyin."
      inputLabel="Yeni sınıf seçeneği"
      placeholder="Yeni sınıf seçeneği, örn. 8"
      renamePlaceholder="Yeni sınıf adı"
      countUnit="seçenek"
      maxLength={120}
      items={items}
      onAction={async (action, label, item) => {
        const result = await manageStudentGradeOption({ action, id: item?.id, label: action === "create" || action === "rename" ? label : undefined });
        if (!result.success) return result.error || "Sınıf seçeneği güncellenemedi.";
        await onChanged();
        return null;
      }}
      onClose={onClose}
    />
  );
}

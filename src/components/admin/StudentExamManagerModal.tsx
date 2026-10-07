import { RefListManagerDialog } from "@/components/admin/StudentRefDialogs";
import { manageStudentExamOption, type StudentExamOption } from "@/lib/admin/students";

// Referans #sinav-dialog "Sınav Yönetimi".
export function StudentExamManagerModal({ items, onClose, onChanged }: { items: StudentExamOption[]; onClose: () => void; onChanged: () => void | Promise<void> }) {
  return (
    <RefListManagerDialog
      id="sinav"
      title="Sınav Yönetimi"
      subtitle="Öğrenci formundaki sınav seçeneklerini düzenleyin."
      inputLabel="Yeni sınav seçeneği"
      placeholder="Yeni sınav seçeneği, örn. SAT"
      renamePlaceholder="Yeni sınav adı"
      countUnit="seçenek"
      maxLength={80}
      items={items}
      onAction={async (action, label, item) => {
        const result = await manageStudentExamOption({ action, id: item?.id, label: action === "create" || action === "rename" ? label : undefined });
        if (!result.success) return result.error || "Sınav seçeneği güncellenemedi.";
        await onChanged();
        return null;
      }}
      onClose={onClose}
    />
  );
}

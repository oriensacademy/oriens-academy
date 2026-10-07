"use client";

import { RefListManagerDialog } from "@/components/admin/StudentRefDialogs";
import { manageLessonReference, type InstructorReference, type LessonReference } from "@/lib/admin/student-learning";

// Referans #derslist-dialog / #egitmen-dialog.
export function LessonReferenceManagerModal({ kind, items, onClose, onChanged }: { kind: "topic" | "instructor"; items: Array<LessonReference | InstructorReference>; onClose: () => void; onChanged: () => void }) {
  const topic = kind === "topic";
  return (
    <RefListManagerDialog
      id={topic ? "derslist" : "egitmen"}
      title={topic ? "Ders Listesi" : "Eğitmen Listesi"}
      subtitle={`Ders kaydı formundaki ${topic ? "ders" : "eğitmen"} seçeneklerini düzenleyin.`}
      inputLabel={topic ? "Yeni ders" : "Yeni eğitmen"}
      placeholder={topic ? "Yeni ders, örn. ESAT Chemistry" : "Yeni eğitmen adı soyadı"}
      renamePlaceholder={topic ? "Yeni ders adı" : "Yeni eğitmen adı soyadı"}
      countUnit={topic ? "ders" : "eğitmen"}
      maxLength={120}
      items={items.map((item) => ({ id: item.id, label: "label" in item ? item.label : item.name, active: item.active }))}
      onAction={async (action, label, item) => {
        const result = await manageLessonReference({ kind, action, id: item?.id, label });
        if (!result.success) return result.error || "İşlem tamamlanamadı.";
        onChanged();
        return null;
      }}
      onClose={onClose}
    />
  );
}

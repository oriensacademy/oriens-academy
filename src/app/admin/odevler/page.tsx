"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  Layers,
  Plus,
} from "lucide-react";
import { ContentLibraryManager } from "@/components/admin/homework/ContentLibraryManager";
import { ContentEditorModal } from "@/components/admin/homework/ContentEditorModal";
import { AssignedHomeworkList } from "@/components/admin/homework/AssignedHomeworkList";
import { AssignHomeworkModal } from "@/components/admin/homework/AssignHomeworkModal";
import type { HomeworkTemplate } from "@/lib/homework";

type HomeworkTab = "content" | "assignments" | "submissions";

export default function AdminHomeworkPage() {
  const [activeTab, setActiveTab] = useState<HomeworkTab>("content");

  // Global Content Editor Modal
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<HomeworkTemplate | null>(null);

  // Global Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] = useState<HomeworkTemplate | null>(null);

  const tabs: Array<{ id: HomeworkTab; label: string; icon: typeof ClipboardList }> = [
    { id: "content", label: "İçerikler & Materyaller", icon: Layers },
    { id: "assignments", label: "Atamalar", icon: CalendarCheck },
    { id: "submissions", label: "Teslimler & Değerlendirme", icon: ClipboardList },
  ];

  const handleAssignContent = (template: HomeworkTemplate) => {
    setSelectedTemplateForAssign(template);
    setAssignModalOpen(true);
  };

  const handleEditContent = (template: HomeworkTemplate) => {
    setSelectedTemplateForEdit(template);
    setEditorModalOpen(true);
  };

  const handleCreateNewContent = () => {
    setSelectedTemplateForEdit(null);
    setEditorModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
                Ödev & Materyal Yönetimi
              </h1>
              <p className="text-xs text-muted-foreground">
                Ödev, ders notu, çalışma kağıdı, kaynak materyal ve denemeleri yönetin, öğrencilere atayın ve teslimleri inceleyin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateNewContent}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 text-xs font-semibold text-ink hover:bg-surface-muted transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="size-4 text-primary" />
            Yeni İçerik Ekle
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedTemplateForAssign(null);
              setAssignModalOpen(true);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
          >
            <CalendarPlus className="size-4" />
            İçerik / Ödev Ata
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Only 3 Primary Tabs) */}
      <div className="flex border-b border-border overflow-x-auto gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-ink"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "content" && (
          <ContentLibraryManager
            onAssignContent={handleAssignContent}
            onEditContent={handleEditContent}
            onCreateNew={handleCreateNewContent}
          />
        )}

        {activeTab === "assignments" && (
          <AssignedHomeworkList
            onOpenAssignModal={() => {
              setSelectedTemplateForAssign(null);
              setAssignModalOpen(true);
            }}
          />
        )}

        {activeTab === "submissions" && (
          <AssignedHomeworkList filterSubmissionsOnly={true} />
        )}
      </div>

      {/* Content Editor Modal (Create / Edit) */}
      {editorModalOpen && (
        <ContentEditorModal
          isOpen={editorModalOpen}
          initialTemplate={selectedTemplateForEdit}
          onClose={() => {
            setEditorModalOpen(false);
            setSelectedTemplateForEdit(null);
          }}
          onSaved={() => {
            setEditorModalOpen(false);
            setSelectedTemplateForEdit(null);
          }}
        />
      )}

      {/* Assign Content Modal */}
      {assignModalOpen && (
        <AssignHomeworkModal
          isOpen={assignModalOpen}
          initialTemplate={selectedTemplateForAssign}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedTemplateForAssign(null);
          }}
          onAssigned={() => {
            setAssignModalOpen(false);
            setSelectedTemplateForAssign(null);
            if (activeTab === "assignments" || activeTab === "submissions") {
              setActiveTab("assignments");
            }
          }}
        />
      )}
    </div>
  );
}

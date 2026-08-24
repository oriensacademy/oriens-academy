"use client";

import { useState } from "react";
import {
  BookCopy,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  GraduationCap,
  Layers,
} from "lucide-react";
import { QuestionBankManager } from "@/components/admin/homework/QuestionBankManager";
import { TemplateManager } from "@/components/admin/homework/TemplateManager";
import { MockExamManager } from "@/components/admin/homework/MockExamManager";
import { AssignedHomeworkList } from "@/components/admin/homework/AssignedHomeworkList";
import { AssignHomeworkModal } from "@/components/admin/homework/AssignHomeworkModal";
import type { HomeworkTemplate, QuestionBankItem } from "@/lib/homework";

type HomeworkTab = "assignments" | "templates" | "question_bank" | "mock_exams" | "submissions";

export default function AdminHomeworkPage() {
  const [activeTab, setActiveTab] = useState<HomeworkTab>("assignments");

  // Global Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] =
    useState<HomeworkTemplate | null>(null);

  // Workflow bridge: Questions from Bank -> Template
  const [preloadedQuestionsForTemplate, setPreloadedQuestionsForTemplate] = useState<
    QuestionBankItem[] | null
  >(null);

  const tabs: Array<{ id: HomeworkTab; label: string; icon: typeof ClipboardList }> = [
    { id: "assignments", label: "Atanan Ödevler", icon: CalendarCheck },
    { id: "templates", label: "Ödev Şablonları", icon: BookCopy },
    { id: "question_bank", label: "Soru Bankası", icon: Layers },
    { id: "mock_exams", label: "Denemeler", icon: GraduationCap },
    { id: "submissions", label: "Teslimler & Değerlendirme", icon: ClipboardList },
  ];

  const handleAssignTemplate = (template: HomeworkTemplate) => {
    setSelectedTemplateForAssign(template);
    setAssignModalOpen(true);
  };

  const handleCreateTemplateFromQuestions = (questions: QuestionBankItem[]) => {
    setPreloadedQuestionsForTemplate(questions);
    setActiveTab("templates");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-forest/10 text-forest">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink font-heading">
                Ödev İşlemleri
              </h1>
              <p className="text-xs text-muted-foreground">
                Merkezi soru havuzu, şablonlar, deneme setleri ve öğrenci teslim değerlendirmesi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTemplateForAssign(null);
              setAssignModalOpen(true);
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer shadow-xs"
          >
            <CalendarPlus className="size-4" />
            Ödev Ata
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
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
        {activeTab === "assignments" && (
          <AssignedHomeworkList
            onOpenAssignModal={() => {
              setSelectedTemplateForAssign(null);
              setAssignModalOpen(true);
            }}
          />
        )}

        {activeTab === "templates" && (
          <TemplateManager
            initialPreloadedQuestions={preloadedQuestionsForTemplate}
            onAssignTemplate={handleAssignTemplate}
          />
        )}

        {activeTab === "question_bank" && (
          <QuestionBankManager
            onCreateTemplateWithQuestions={handleCreateTemplateFromQuestions}
          />
        )}

        {activeTab === "mock_exams" && (
          <MockExamManager
            onAssignMockExam={(m) => {
              // Convert mock to template shape for assign modal
              const asTemplate: HomeworkTemplate = {
                id: m.id,
                title: m.title,
                description: m.description,
                subject: m.topic_mix,
                exam: m.exam,
                estimated_duration_minutes: m.time_limit_minutes,
                external_link: null,
                instructor_note: null,
                status: "active",
                created_at: m.created_at,
                updated_at: m.updated_at,
                questions: m.questions,
              };
              handleAssignTemplate(asTemplate);
            }}
          />
        )}

        {activeTab === "submissions" && (
          <AssignedHomeworkList filterSubmissionsOnly={true} />
        )}
      </div>

      {/* Central Assign Homework Modal */}
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
              // trigger refresh
              setActiveTab("assignments");
            }
          }}
        />
      )}
    </div>
  );
}

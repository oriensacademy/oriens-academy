"use client";

import { useEffect, useState } from "react";
import {
  createAdminAvailabilitySlot,
  bulkCreateAdminAvailabilitySlots,
} from "@/lib/admin/availability";
import {
  X,
  Plus,
  Clock,
  Layers,
  AlertCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Wave } from "@/components/ui/wave";

interface CreateSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const DAYS_OF_WEEK = [
  { id: 1, label: "Pazartesi" },
  { id: 2, label: "Salı" },
  { id: 3, label: "Çarşamba" },
  { id: 4, label: "Perşembe" },
  { id: 5, label: "Cuma" },
  { id: 6, label: "Cumartesi" },
  { id: 0, label: "Pazar" },
];

const DEFAULT_TIME_SLOTS = [
  { startTime: "10:00", endTime: "11:00" },
  { startTime: "13:00", endTime: "14:00" },
  { startTime: "14:00", endTime: "15:00" },
  { startTime: "15:00", endTime: "16:00" },
];
const AVAILABILITY_DRAFT_KEY = "oriens_admin_draft_availability";

export function CreateSlotModal({
  isOpen,
  onClose,
  onCreated,
}: CreateSlotModalProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single Slot State
  const [todayStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [singleDate, setSingleDate] = useState(todayStr);
  const [singleStartTime, setSingleStartTime] = useState("13:00");
  const [singleEndTime, setSingleEndTime] = useState("14:00");
  const [singleStatus, setSingleStatus] = useState<"available" | "blocked">("available");

  // Bulk Slot State
  const [nextWeekStr] = useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [bulkStartDate, setBulkStartDate] = useState(todayStr);
  const [bulkEndDate, setBulkEndDate] = useState(nextWeekStr);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [timeSlots, setTimeSlots] = useState<
    Array<{ startTime: string; endTime: string }>
  >(DEFAULT_TIME_SLOTS);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const restoreDraft = () => {
    try {
      const raw = sessionStorage.getItem(AVAILABILITY_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<{
          mode: "single" | "bulk";
          singleDate: string;
          singleStartTime: string;
          singleEndTime: string;
          singleStatus: "available" | "blocked";
          bulkStartDate: string;
          bulkEndDate: string;
          selectedDays: number[];
          timeSlots: Array<{ startTime: string; endTime: string }>;
        }>;
        if (draft.mode) setMode(draft.mode);
        if (draft.singleDate) setSingleDate(draft.singleDate);
        if (draft.singleStartTime) setSingleStartTime(draft.singleStartTime);
        if (draft.singleEndTime) setSingleEndTime(draft.singleEndTime);
        if (draft.singleStatus) setSingleStatus(draft.singleStatus);
        if (draft.bulkStartDate) setBulkStartDate(draft.bulkStartDate);
        if (draft.bulkEndDate) setBulkEndDate(draft.bulkEndDate);
        if (draft.selectedDays?.length) setSelectedDays(draft.selectedDays);
        if (draft.timeSlots?.length) setTimeSlots(draft.timeSlots);
      }
    } catch {
      sessionStorage.removeItem(AVAILABILITY_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
    };
    queueMicrotask(restoreDraft);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    sessionStorage.setItem(AVAILABILITY_DRAFT_KEY, JSON.stringify({
      mode, singleDate, singleStartTime, singleEndTime, singleStatus,
      bulkStartDate, bulkEndDate, selectedDays, timeSlots,
    }));
  }, [draftReady, mode, singleDate, singleStartTime, singleEndTime, singleStatus, bulkStartDate, bulkEndDate, selectedDays, timeSlots]);

  const clearDraftAndClose = () => {
    sessionStorage.removeItem(AVAILABILITY_DRAFT_KEY);
    onClose();
  };

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const startsAtIso = `${singleDate}T${singleStartTime}:00`;
    const endsAtIso = `${singleDate}T${singleEndTime}:00`;

    const { error } = await createAdminAvailabilitySlot(startsAtIso, endsAtIso, singleStatus);

    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
    } else {
      setSuccessMsg("Müsaitlik zaman dilimi başarıyla eklendi.");
      sessionStorage.removeItem(AVAILABILITY_DRAFT_KEY);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1000);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const { createdCount, skippedCount, error } =
      await bulkCreateAdminAvailabilitySlots({
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        selectedDays,
        timeSlots,
      });

    setSubmitting(false);

    if (error) {
      setErrorMsg(error);
    } else {
      setSuccessMsg(
        `Toplu işlem tamamlandı: ${createdCount} yeni dilim eklendi${
          skippedCount > 0 ? `, ${skippedCount} çakışan dilim atlandı` : ""
        }.`
      );
      sessionStorage.removeItem(AVAILABILITY_DRAFT_KEY);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1200);
    }
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const addTimeSlotRow = () => {
    setTimeSlots([...timeSlots, { startTime: "16:00", endTime: "17:00" }]);
  };

  const removeTimeSlotRow = (index: number) => {
    if (timeSlots.length <= 1) return;
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (
    index: number,
    field: "startTime" | "endTime",
    val: string
  ) => {
    const updated = [...timeSlots];
    updated[index][field] = val;
    setTimeSlots(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-[#819586]" />
            <h2 className="text-sm font-bold text-foreground">
              Müsaitlik Dilimi Ekle
            </h2>
          </div>
          <button
            type="button"
            onClick={clearDraftAndClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-lg border border-border bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
              mode === "single"
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="size-3.5 text-[#819586]" />
            <span>Tekli Dilim</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors ${
              mode === "bulk"
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5 text-[#10271B]" />
            <span>Toplu Oluştur</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Single Mode Form */}
        {mode === "single" && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Tarih
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Başlangıç Saati
                </label>
                <input
                  type="time"
                  required
                  value={singleStartTime}
                  onChange={(e) => setSingleStartTime(e.target.value)}
                  className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Bitiş Saati
                </label>
                <input
                  type="time"
                  required
                  value={singleEndTime}
                  onChange={(e) => setSingleEndTime(e.target.value)}
                  className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Dilim Türü</label>
              <select
                value={singleStatus}
                onChange={(e) => setSingleStatus(e.target.value as "available" | "blocked")}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              >
                <option value="available">Müsait — öğrenci rezervasyonuna açık</option>
                <option value="blocked">Engelli — rezervasyona kapalı</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={clearDraftAndClose}
                className="rounded-lg border border-input bg-white px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C] disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Wave className="h-4 w-8 text-amber-400" aria-label="Kaydediliyor" />
                    <span>Kaydediliyor…</span>
                  </>
                ) : (
                  <span>Dilimi Kaydet</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Bulk Mode Form */}
        {mode === "bulk" && (
          <form onSubmit={handleBulkSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  required
                  min={bulkStartDate}
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                />
              </div>
            </div>

            {/* Days Selection */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Uygulanacak Günler
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {DAYS_OF_WEEK.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer select-none transition-colors ${
                      selectedDays.includes(d.id)
                        ? "border-[#10271B] bg-blue-50/50 text-[#10271B] font-semibold"
                        : "border-border bg-white text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDays.includes(d.id)}
                      onChange={() => toggleDay(d.id)}
                      className="rounded border-input text-[#10271B]"
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Slots List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-muted-foreground">
                  Saat Dilimleri
                </label>
                <button
                  type="button"
                  onClick={addTimeSlotRow}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#10271B] hover:underline"
                >
                  <Plus className="size-3" />
                  <span>Saat Ekle</span>
                </button>
              </div>

              {timeSlots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    required
                    value={slot.startTime}
                    onChange={(e) => updateTimeSlot(idx, "startTime", e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    required
                    value={slot.endTime}
                    onChange={(e) => updateTimeSlot(idx, "endTime", e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-white p-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => removeTimeSlotRow(idx)}
                    disabled={timeSlots.length <= 1}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={clearDraftAndClose}
                className="rounded-lg border border-input bg-white px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting || selectedDays.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C] disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Wave className="h-4 w-8 text-amber-400" aria-label="Oluşturuluyor" />
                    <span>Oluşturuluyor…</span>
                  </>
                ) : (
                  <span>Toplu Oluştur</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export interface PaymentStatusMetadata {
  failed_reason_code?: string | number | null;
  failed_reason_msg?: string | null;
  paytr_callback?: {
    failed_reason_code?: string | number | null;
    failed_reason_msg?: string | null;
  } | null;
}

export interface AdminPaymentStatusPresentation {
  label: string;
  bg: string;
  text: string;
}

const STATUS_COPY: Record<string, AdminPaymentStatusPresentation> = {
  pending: { label: "Bekliyor", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  requires_action: { label: "Doğrulama Gerekli", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  processing: { label: "İşleniyor", bg: "bg-blue-50 border-blue-200", text: "text-blue-800" },
  paid: { label: "Ödendi", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  failed: { label: "Başarısız", bg: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  cancelled: { label: "İptal", bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-700" },
  refunded: { label: "İade", bg: "bg-purple-50 border-purple-200", text: "text-purple-800" },
};

export function getAdminPaymentStatus(
  status: string,
  metadata?: PaymentStatusMetadata | null
): AdminPaymentStatusPresentation {
  if (status !== "failed") {
    return STATUS_COPY[status] || { label: status, bg: "bg-surface-muted", text: "text-ink" };
  }

  const callback = metadata?.paytr_callback;
  const reasonCode = String(callback?.failed_reason_code ?? metadata?.failed_reason_code ?? "").trim();
  const reasonMessage = String(callback?.failed_reason_msg ?? metadata?.failed_reason_msg ?? "").trim();

  if (reasonCode === "6") {
    return { label: "Vazgeçildi", bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-700" };
  }

  const isTimeout = /timeout|time[ -]?out|zaman\s*aş/i.test(reasonMessage);
  const isIncomplete3d = reasonCode === "0" || /3\s*-?\s*d|3d secure|doğrulama.*tamamlan/i.test(reasonMessage);
  if (isTimeout || isIncomplete3d) {
    return {
      label: isTimeout ? "Zaman Aşımı" : "3D Doğrulaması Tamamlanmadı",
      bg: "bg-neutral-100 border-neutral-200",
      text: "text-neutral-700",
    };
  }

  return STATUS_COPY.failed;
}

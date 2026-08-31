"use client";

import { useCallback, useState } from "react";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";

type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  action: () => void | Promise<void>;
};

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const requestConfirmation = useCallback((next: ConfirmationRequest) => {
    setRequest(next);
  }, []);

  const cancel = useCallback(() => {
    if (!loading) setRequest(null);
  }, [loading]);

  const confirm = useCallback(async () => {
    if (!request || loading) return;
    setLoading(true);
    try {
      await request.action();
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [loading, request]);

  return {
    requestConfirmation,
    confirmationDialog: (
      <ConfirmationDialog
        open={Boolean(request)}
        title={request?.title || "İşlemi onaylayın"}
        description={request?.description || ""}
        confirmLabel={request?.confirmLabel}
        destructive={request?.destructive}
        loading={loading}
        onCancel={cancel}
        onConfirm={confirm}
      />
    ),
  };
}

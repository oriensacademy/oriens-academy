"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  failed: boolean;
}

export class AuditDetailErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Admin Audit] Detail rendering failed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/35 p-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-5 shadow-2xl">
          <p className="text-sm font-semibold text-red-800">Bu kayıt görüntülenirken sorun oluştu.</p>
          <p className="mt-1 text-xs text-muted-foreground">Denetim listesi kullanılmaya devam edebilir.</p>
          <button
            type="button"
            onClick={this.props.onClose}
            className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
          >
            Detayı kapat
          </button>
        </div>
      </div>
    );
  }
}

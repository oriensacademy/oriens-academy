"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Search,
  RefreshCw,
  Send,
  CheckCircle,
  Clock,
  User,
  Mail,
  Phone,
  Inbox,
} from "lucide-react";
import { useAccount } from "@/lib/auth/account-context";
import {
  listAdminSupportThreads,
  updateSupportThreadStatus,
  sendAdminSupportMessage,
  markThreadReadByAdmin,
  subscribeToAllSupportThreads,
} from "@/lib/support/admin";
import { listThreadMessages, subscribeToThreadMessages } from "@/lib/support/client";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportMessage,
  type SupportStatus,
  type SupportThread,
} from "@/lib/support/types";
import { cn } from "@/lib/utils";

export default function AdminSupportPage({ initialThreadId = null, embedded = false }: { initialThreadId?: string | null; embedded?: boolean }) {
  const { user } = useAccount();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Conversation
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;

  const loadThreads = useCallback(async () => {
    const res = await listAdminSupportThreads({
      status: statusFilter,
      category: categoryFilter,
      search: searchQuery,
    });
    if (res.data) {
      setThreads(res.data);
    }
    setLoading(false);
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    let ignore = false;
    listAdminSupportThreads({
      status: statusFilter,
      category: categoryFilter,
      search: searchQuery,
    }).then((res) => {
      if (!ignore) {
        if (res.data) setThreads(res.data);
        setLoading(false);
      }
    });

    const unsub = subscribeToAllSupportThreads(() => {
      listAdminSupportThreads({
        status: statusFilter,
        category: categoryFilter,
        search: searchQuery,
      }).then((res) => {
        if (!ignore && res.data) setThreads(res.data);
      });
    });

    return () => {
      ignore = true;
      unsub();
    };
  }, [statusFilter, categoryFilter, searchQuery]);

  // Load messages when activeThreadId changes
  useEffect(() => {
    if (!activeThreadId) return;
    let ignore = false;
    markThreadReadByAdmin(activeThreadId);

    listThreadMessages(activeThreadId).then((res) => {
      if (!ignore) {
        if (res.data) setMessages(res.data);
        setLoadingMessages(false);
      }
    });

    const unsub = subscribeToThreadMessages(activeThreadId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      markThreadReadByAdmin(activeThreadId);
    });

    return () => {
      ignore = true;
      unsub();
    };
  }, [activeThreadId]);

  // Scroll to bottom
  useEffect(() => {
    if (activeThreadId && messages.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeThreadId]);

  // Handle status change
  const handleStatusChange = async (newStatus: SupportStatus) => {
    if (!activeThreadId) return;
    const res = await updateSupportThreadStatus(activeThreadId, newStatus);
    if (res.data) {
      setThreads((prev) =>
        prev.map((t) => (t.id === activeThreadId ? { ...t, status: newStatus } : t))
      );
    }
  };

  // Handle sending admin reply
  const handleSendReply = async () => {
    if (!activeThreadId || !replyText.trim() || isSending || !user) return;
    const text = replyText.trim();
    setReplyText("");
    setIsSending(true);

    const res = await sendAdminSupportMessage(activeThreadId, user.id, text);
    setIsSending(false);

    if (res.data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data!.id)) return prev;
        return [...prev, res.data!];
      });
      await loadThreads();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const fmt = (val: string | null) => {
    if (!val) return "—";
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(val));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      {!embedded && <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Öğrenci Destek & Canlı Mesajlaşma
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Öğrencilerden gelen destek taleplerini yanıtlayın, durumları güncelleyin ve canlı görüşme sağlayın.
          </p>
        </div>
        <button
          type="button"
          onClick={loadThreads}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#10271B] hover:bg-muted transition-colors shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className="size-3.5" />
          Yenile
        </button>
      </div>}

      {/* Main Split Layout */}
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
        {/* Left Column: Filters & Ticket List */}
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğrenci adı, e-posta veya konu ara…"
              className="min-h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-xs text-[#10271B] placeholder:text-muted-foreground/70 focus:border-[#819586] focus:outline-none"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-white p-1 shadow-xs">
            {[
              { id: "all", label: "Tümü" },
              { id: "waiting_support", label: "Yanıt Bekliyor" },
              { id: "open", label: "Açık" },
              { id: "resolved", label: "Çözüldü" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold transition-colors",
                  statusFilter === tab.id
                    ? "bg-[#10271B] text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-[#10271B]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Kategori:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-[#10271B] focus:border-[#819586] focus:outline-none"
            >
              <option value="all">Tüm Kategoriler</option>
              {SUPPORT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.labelTr}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket list */}
          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Destek talepleri yükleniyor…
              </div>
            ) : threads.length ? (
              threads.map((t) => {
                const isSelected = t.id === activeThreadId;
                const cat = SUPPORT_CATEGORIES.find((c) => c.id === t.category);
                const statusObj = SUPPORT_STATUS_LABELS[t.status];
                const studentName = t.student_profiles?.full_name || "Öğrenci";

                return (
                  <article
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3.5 transition-all shadow-xs",
                      isSelected
                        ? "border-[#10271B] bg-white ring-2 ring-[#10271B]/20"
                        : t.unread_for_admin
                        ? "border-amber-400 bg-amber-50/60 hover:bg-white"
                        : "border-border bg-white hover:border-[#819586]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold text-[#10271B]">
                            {studentName}
                          </span>
                          {t.unread_for_admin && (
                            <span className="inline-flex size-2 rounded-full bg-amber-600 ring-2 ring-amber-200" />
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {t.student_profiles?.email || ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {fmt(t.last_message_at)}
                      </span>
                    </div>

                    <h4 className="mt-2 line-clamp-1 text-xs font-semibold text-[#10271B]">
                      {t.subject}
                    </h4>

                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-[#10271B]">
                        {cat?.labelTr || t.category}
                      </span>
                      <span className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {statusObj?.tr || t.status}
                      </span>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Filtreye uygun destek talebi bulunamadı.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Conversation Detail */}
        <div className="rounded-2xl border border-border bg-white shadow-xs flex flex-col min-h-[580px]">
          {activeThread ? (
            <>
              {/* Thread detail banner */}
              <div className="border-b border-border p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#EFF3EE] px-2.5 py-0.5 text-xs font-bold text-[#10271B]">
                        {SUPPORT_CATEGORIES.find((c) => c.id === activeThread.category)?.labelTr || activeThread.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Talep #{activeThread.id.slice(0, 8)}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-heading text-xl text-[#10271B]">
                      {activeThread.subject}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="size-3.5 text-primary" />
                        <strong className="text-[#10271B]">{activeThread.student_profiles?.full_name || "Öğrenci"}</strong>
                      </span>
                      {activeThread.student_profiles?.email && (
                        <a
                          href={`mailto:${activeThread.student_profiles.email}`}
                          className="flex items-center gap-1 hover:text-[#10271B] hover:underline"
                        >
                          <Mail className="size-3.5" />
                          {activeThread.student_profiles.email}
                        </a>
                      )}
                      {activeThread.student_profiles?.phone && (
                        <a
                          href={`tel:${activeThread.student_profiles.phone}`}
                          className="flex items-center gap-1 hover:text-[#10271B] hover:underline"
                        >
                          <Phone className="size-3.5" />
                          {activeThread.student_profiles.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Status Change Selector & Actions */}
                  <div className="flex items-center gap-2">
                    <select
                      value={activeThread.status}
                      onChange={(e) => handleStatusChange(e.target.value as SupportStatus)}
                      className="min-h-9 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-[#10271B] focus:border-[#819586] focus:outline-none"
                    >
                      <option value="open">Açık</option>
                      <option value="waiting_student">Öğrenci Yanıtı Bekleniyor</option>
                      <option value="waiting_support">Destek Yanıtı Bekleniyor</option>
                      <option value="resolved">Çözüldü</option>
                      <option value="closed">Kapalı</option>
                    </select>

                    {activeThread.status !== "resolved" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange("resolved")}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs"
                      >
                        <CheckCircle className="size-3.5" />
                        Çözüldü
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[440px]">
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                    Mesaj geçmişi yükleniyor…
                  </div>
                ) : messages.length ? (
                  messages.map((m) => {
                    const isAdmin = m.sender_type === "admin";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[85%] sm:max-w-[75%]",
                          isAdmin ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <span className="mb-1 text-[11px] font-medium text-muted-foreground">
                          {isAdmin ? "Oriens Destek" : activeThread.student_profiles?.full_name || "Öğrenci"} · {fmt(m.created_at)}
                        </span>
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-xs",
                            isAdmin
                              ? "bg-[#10271B] text-white rounded-tr-xs"
                              : "bg-[#F3F6F1] border border-border text-[#10271B] rounded-tl-xs"
                          )}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Mesaj kaydı bulunamadı.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Admin Composer */}
              <div className="border-t border-border p-4 bg-[#FAFBF9] rounded-b-2xl">
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Öğrenciye yanıtınızı yazın… (Göndermek için Enter, yeni satır için Shift+Enter)"
                    className="w-full rounded-xl border border-border bg-white p-3 text-sm leading-relaxed text-[#10271B] placeholder:text-muted-foreground/60 focus:border-[#819586] focus:outline-none focus:ring-1 focus:ring-[#819586]"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Öğrenciye anlık Realtime mesaj olarak iletilir.
                    </span>
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#10271B] px-5 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 transition-colors shadow-xs"
                    >
                      <Send className="size-3.5" />
                      {isSending ? "Gönderiliyor…" : "Yanıtı Gönder"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-full border border-border bg-[#F3F6F1] text-[#819586] mb-3">
                <Inbox className="size-6" />
              </div>
              <h3 className="font-heading text-lg text-[#10271B]">Bir Destek Talebi Seçin</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Görüşme detaylarını görüntülemek ve öğrenciye yanıt yazmak için sol taraftaki listeden bir talep seçin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

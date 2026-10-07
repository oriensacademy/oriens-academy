"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { DEFAULT_CONTACT_SETTINGS, fetchContactSettings, saveContactSettings, validateContactSettings, type ContactSettings } from "@/lib/contact-settings";
import { usePageLeaveGuard } from "@/components/admin/UnsavedChangesGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ADMIN_MENU_STYLES, setAdminMenuStyle, useAdminMenuStyle } from "@/lib/admin/menu-style";
import { toast } from "@/components/ui/toast";
import pages from "@/components/admin/admin-pages.module.css";

// Referans: oriens-admin.body.html #view-ayar. "İletişim bilgileri" kartı
// site_settings "contact.public" kaydını düzenler (src/lib/contact-settings.ts).

const RULES: { key: string; label: string; test: (value: string) => boolean }[] = [
  { key: "len", label: "En az 8 karakter", test: (v) => v.length >= 8 },
  { key: "up", label: "Büyük harf", test: (v) => /[A-ZÇĞİÖŞÜ]/.test(v) },
  { key: "low", label: "Küçük harf", test: (v) => /[a-zçğıöşü]/.test(v) },
  { key: "num", label: "Rakam", test: (v) => /\d/.test(v) },
  { key: "sym", label: "Sembol", test: (v) => /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]/.test(v) },
];

const PREVIEW: Record<string, string> = { "": "a", blok: "b", liste: "c", koyu: "d" };

const icon = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export default function AdminSettingsPage() {
  return (
    <div id="view-ayar" className={`pgv ${pages.root}`}>
      <div className="page">
        <div className="wrap fx-narrow">
          <div className="head">
            <div>
              <h1>Ayarlar</h1>
              <p>Yönetici hesabı, iletişim bilgileri ve panel görünümü.</p>
            </div>
          </div>
          <AccountSecuritySection />
          <ContactSection />
          <MenuStyleSection />
        </div>
      </div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, children }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; children?: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="m-field">
      <label htmlFor={id} className="m-lab">{label}</label>
      <div className="fx-pwi">
        <input id={id} type={visible ? "text" : "password"} className="m-input" autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="fx-eye" aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"} onClick={() => setVisible((v) => !v)}>
          <svg {...icon} width={18} height={18}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
      {children}
    </div>
  );
}

function AccountSecuritySection() {
  const { user } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const rulesOk = RULES.every((rule) => rule.test(newPassword));
  const matches = !!confirmPassword && confirmPassword === newPassword;
  const canSave = !!currentPassword && rulesOk && matches && !passLoading;

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    setPassLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!user?.email) {
        toast.error("Yönetici oturumu doğrulanamadı.");
        return;
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reauthError) {
        toast.error("Mevcut şifre doğrulanamadı.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message || "Şifre güncellenemedi.");
        return;
      }
      await supabase.from("audit_logs").insert({ actor_user_id: user.id, action: "admin.password_change_completed", entity_type: "admin_auth", entity_id: user.id, metadata: { trigger: "voluntary_settings_change" } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Şifre güncellendi");
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <section className="card fx-set">
      <div className="fx-set-h">
        <span className="fx-set-ico"><svg {...icon}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg></span>
        <div><h2>Hesap güvenliği</h2><p>Yönetici hesabınızın giriş şifresini değiştirin.</p></div>
      </div>
      <div className="fx-set-grid">
        <div className="fx-set-info"><span className="m-lab">Yönetici e-postası</span><b>{user?.email ?? ""}</b><small>E-posta adresi bu panelden değiştirilemez.</small></div>
        <form className="fx-pw" autoComplete="off" onSubmit={handleUpdatePassword}>
          <PasswordField id="ay-mevcut" label="Mevcut şifre" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField id="ay-yeni" label="Yeni şifre" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <ul className="fx-rules" id="ay-rules">
            {RULES.map((rule) => <li key={rule.key} data-r={rule.key} className={rule.test(newPassword) ? "ok" : undefined}>{rule.label}</li>)}
          </ul>
          <PasswordField id="ay-tekrar" label="Yeni şifre (tekrar)" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password">
            <small className={`fx-match${confirmPassword ? (matches ? " ok" : " bad") : ""}`} id="ay-match">{!confirmPassword ? "" : matches ? "Şifreler eşleşiyor" : "Şifreler eşleşmiyor"}</small>
          </PasswordField>
          <button type="submit" className="fx-btn primary" id="ay-save" disabled={!canSave} aria-busy={passLoading || undefined}>
            <svg {...icon} width={16} height={16}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>Şifreyi Güncelle
          </button>
        </form>
      </div>
    </section>
  );
}

// Referans telFmt: alandan çıkınca / yapıştırınca +90 XXX XXX XX XX
function telFmt(value: string) {
  let d = value.replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) d = `90${d}`;
  else if (d.length === 11 && d[0] === "0") d = `9${d}`;
  if (d.length === 12 && d.startsWith("90")) return `+90 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  return value.trim();
}

const CONTACT_FIELDS: { key: keyof ContactSettings; id: string; label: string; tel?: boolean; type?: string }[] = [
  { key: "whatsapp", id: "ay-wa", label: "WhatsApp", tel: true },
  { key: "landline", id: "ay-tel", label: "Sabit telefon", tel: true },
  { key: "email", id: "ay-ep", label: "E-posta", type: "email" },
];

function ContactSection() {
  const [saved, setSaved] = useState<ContactSettings | null>(null);
  const [form, setForm] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let alive = true;
    void fetchContactSettings().then((value) => {
      if (!alive) return;
      setSaved(value);
      setForm(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const key = (value: ContactSettings) => [value.whatsapp, value.landline, value.email, value.address].map((v) => v.trim()).join("|");
  const dirty = !!saved && key(form) !== key(saved);
  usePageLeaveGuard(dirty, {
    title: "İletişim bilgileri",
    text: "İletişim bilgilerinde kaydedilmemiş değişiklikler var. Sayfadan çıkarsanız bu değişiklikler kaybolacak.",
    ok: "Kaydetmeden çık",
  });

  const set = (field: keyof ContactSettings, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || busy) return;
    const invalid = validateContactSettings(form);
    if (invalid) {
      toast.error(invalid.message);
      formRef.current?.querySelector<HTMLElement>(`#${invalid.field === "address" ? "ay-adres" : CONTACT_FIELDS.find((f) => f.key === invalid.field)?.id}`)?.focus();
      return;
    }
    setBusy(true);
    const result = await saveContactSettings(form);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSaved(result.value);
    setForm(result.value);
    toast.success("İletişim bilgileri kaydedildi");
  };

  return (
    <section className="card fx-set">
      <div className="fx-set-h">
        <span className="fx-set-ico"><svg {...icon}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg></span>
        <div><h2>İletişim bilgileri</h2><p>E-postaların alt bilgisinde ve sitenin iletişim alanlarında kullanılır. Buradan değiştirince her yerde güncellenir.</p></div>
      </div>
      <form ref={formRef} className="ay-il" id="ay-il" autoComplete="off" onSubmit={save} aria-busy={!saved || undefined}>
        {CONTACT_FIELDS.map((field) => (
          <div key={field.key} className="m-field">
            <label htmlFor={field.id} className="m-lab">{field.label}</label>
            <input
              id={field.id}
              className="m-input"
              type={field.type}
              inputMode={field.tel ? "tel" : undefined}
              value={form[field.key]}
              disabled={!saved}
              onChange={(event) => set(field.key, field.tel ? event.target.value.replace(/[^\d+ ]/g, "") : event.target.value)}
              onBlur={field.tel ? (event) => set(field.key, telFmt(event.target.value)) : undefined}
              onPaste={field.tel ? (event) => { const el = event.currentTarget; window.setTimeout(() => set(field.key, telFmt(el.value)), 0); } : undefined}
            />
          </div>
        ))}
        <div className="m-field ay-tam">
          <label htmlFor="ay-adres" className="m-lab">Adres</label>
          <textarea id="ay-adres" className="m-input" rows={2} value={form.address} disabled={!saved} onChange={(event) => set("address", event.target.value)} />
        </div>
        <div className="ay-il-f">
          <small id="ay-il-not" style={dirty ? { color: "#8A5F12" } : undefined}>{dirty ? "Kaydedilmemiş değişiklik var" : "Değişiklik yok"}</small>
          <button type="submit" className="fx-btn primary" id="ay-il-save" disabled={!dirty || busy} aria-busy={busy || undefined}>Kaydet</button>
        </div>
      </form>
    </section>
  );
}

function MenuStyleSection() {
  const current = useAdminMenuStyle();
  return (
    <section className="card fx-set">
      <div className="fx-set-h">
        <span className="fx-set-ico"><svg {...icon}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg></span>
        <div><h2>Menü görünümü</h2><p>Sol menünün stilini seçin; seçim bu tarayıcıda hatırlanır.</p></div>
      </div>
      <div className="sbs-opts" role="radiogroup" aria-label="Menü stili">
        {ADMIN_MENU_STYLES.map((option) => (
          <button
            key={option.value || "renkli"}
            type="button"
            role="radio"
            data-sbs={option.value}
            aria-checked={current === option.value}
            onClick={() => {
              setAdminMenuStyle(option.value);
              toast.success(`Menü görünümü: ${option.label}`);
            }}
          >
            <span className={`sbs-pv ${PREVIEW[option.value]}`}><i /><i /><i /><i /></span>
            <b>{option.label}</b>
            <small>{option.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

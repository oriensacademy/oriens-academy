// In-memory stand-ins for every network dependency of the mail Edge Functions:
// Supabase Auth + PostgREST, Cloudflare Turnstile siteverify and the Gmail API.
// Imported before any function module so env, fetch and Deno.serve are replaced
// first. The real fetch is never called; run with no --allow-net as a backstop.

export const SUPABASE_URL = "http://fake-supabase.test";
export const SECRET_KEY = "sb_secret_fixture_only";
export const PUBLISHABLE_KEY = "sb_publishable_fixture_only";

for (const [key, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: PUBLISHABLE_KEY }),
  TURNSTILE_SECRET_KEY: "fixture-turnstile-secret",
  GOOGLE_CLIENT_ID: "fixture-client",
  GOOGLE_CLIENT_SECRET: "fixture-secret",
  GOOGLE_REFRESH_TOKEN: "fixture-refresh",
  PURCHASE_OTP_HMAC_SECRET: "fixture-hmac-secret",
  EMAIL_CHANGE_HMAC_SECRET: "fixture-hmac-secret",
})) Deno.env.set(key, value);
Deno.env.delete("DENO_ENV");
Deno.env.delete("ENVIRONMENT");

type Row = Record<string, unknown>;
export type FakeUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};
export type SentMail = { to: string; bcc: string; subject: string; body: string; headers: string };

export const state = {
  users: [] as FakeUser[],
  tables: {} as Record<string, Row[]>,
  mailbox: [] as SentMail[],
  generateLinkCalls: [] as Row[],
  turnstileCalls: 0,
  gmailFailures: 0,
  rateLimitAllowed: true,
  realFetchCalls: 0,
  rejectedApiKeys: 0,
};

export function resetState() {
  state.users = [];
  state.tables = {};
  state.mailbox = [];
  state.generateLinkCalls = [];
  state.turnstileCalls = 0;
  state.gmailFailures = 0;
  state.rateLimitAllowed = true;
  state.rejectedApiKeys = 0;
}

export const tokenFor = (user: FakeUser) => `fixture-jwt.${user.id}`;
export const table = (name: string) => (state.tables[name] ??= []);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function userFromBearer(headers: Headers) {
  const bearer = (headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return state.users.find((user) => tokenFor(user) === bearer) ?? null;
}

// ---- PostgREST -------------------------------------------------------------

function coerce(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return decodeURIComponent(raw).replace(/^"(.*)"$/, "$1");
}

function matches(row: Row, column: string, op: string, raw: string): boolean {
  const value = row[column] ?? null;
  const expected = coerce(raw);
  switch (op) {
    case "eq": return String(value) === String(expected);
    case "neq": return String(value) !== String(expected);
    case "is": return value === expected;
    case "gt": return value !== null && String(value) > String(expected);
    case "gte": return value !== null && String(value) >= String(expected);
    case "lt": return value !== null && String(value) < String(expected);
    case "lte": return value !== null && String(value) <= String(expected);
    case "in": return raw.replace(/^\(|\)$/g, "").split(",").map((item) => String(coerce(item))).includes(String(value));
    default: throw new Error(`fake PostgREST: unsupported operator ${op}`);
  }
}

function splitCondition(condition: string) {
  const first = condition.indexOf(".");
  const second = condition.indexOf(".", first + 1);
  return [condition.slice(0, first), condition.slice(first + 1, second), condition.slice(second + 1)];
}

function filterRows(rows: Row[], params: URLSearchParams) {
  let result = rows;
  for (const [key, value] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (key === "or") {
      const conditions = value.replace(/^\(|\)$/g, "").split(",").map(splitCondition);
      result = result.filter((row) => conditions.some(([column, op, raw]) => matches(row, column, op, raw)));
      continue;
    }
    const dot = value.indexOf(".");
    result = result.filter((row) => matches(row, key, value.slice(0, dot), value.slice(dot + 1)));
  }
  const order = params.get("order");
  if (order) {
    const [column, direction] = order.split(",")[0].split(".");
    result = [...result].sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (direction === "desc" ? -1 : 1));
  }
  const limit = Number(params.get("limit") || 0);
  return limit ? result.slice(0, limit) : result;
}

function insertRow(name: string, input: Row): Row {
  const now = new Date().toISOString();
  const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...input };
  table(name).push(row);
  return row;
}

// Mirrors enqueue_email_notification: a pending outbox row, ON CONFLICT (dedupe_key) DO NOTHING.
function enqueueEmailNotification(eventType: string, entityType: string, entityId: string, recipient: string, template: string, payload: Row, dedupeKey: string) {
  if (table("notification_deliveries").some((row) => row.dedupe_key === dedupeKey)) return;
  const now = new Date().toISOString();
  insertRow("notification_deliveries", {
    channel: "email", event_type: eventType, entity_type: entityType, entity_id: entityId, recipient, template, payload,
    provider: "google_workspace", status: "pending", attempt_count: 0, next_attempt_at: now, dedupe_key: dedupeKey,
  });
}

// Mirrors queue_guardian_email_verified_welcome (20260903120000_signup_otp_gate_paytr_repair.sql).
function queueGuardianEmailVerifiedWelcome(guardian: Row) {
  enqueueEmailNotification("guardian.welcome", "guardian_account", String(guardian.user_id), String(guardian.email), "guardian_welcome",
    { guardian_name: guardian.full_name, locale: guardian.preferred_language }, `guardian.welcome:${guardian.user_id}:guardian`);
}

const rpcs: Record<string, (args: Row, headers: Headers) => unknown> = {
  is_admin: (_args, headers) => userFromBearer(headers)?.app_metadata?.role === "admin",
  check_and_claim_recovery_rate_limit: () => ({ allowed: state.rateLimitAllowed, reason: state.rateLimitAllowed ? null : "email" }),
  // Mirrors 20260905140000_email_idempotency_mail027_resend_retention.sql.
  claim_manual_email_dispatch: (args) => {
    const recipient = String(args.p_recipient || "").trim().toLowerCase();
    if (!recipient) return null;
    const key = `manual:${args.p_event_type}:${args.p_entity_id}:${recipient}`;
    const windowMs = Math.max(1, Math.min(Number(args.p_window_seconds ?? 60), 3600)) * 1000;
    const existing = table("notification_deliveries").find((row) => row.dedupe_key === key);
    const now = new Date().toISOString();
    if (existing) {
      if (existing.status !== "failed" && Date.parse(String(existing.updated_at)) >= Date.now() - windowMs) return null;
      Object.assign(existing, { status: "processing", attempt_count: Number(existing.attempt_count) + 1, updated_at: now });
      return existing.id;
    }
    return insertRow("notification_deliveries", {
      channel: "email", event_type: args.p_event_type, entity_type: args.p_entity_type, entity_id: args.p_entity_id,
      recipient, provider: "google_workspace", status: "processing", attempt_count: 1, next_attempt_at: now, dedupe_key: key,
    }).id;
  },
  activate_purchase_email_verification_challenge: (args) => {
    const now = new Date().toISOString();
    const challenge = table("purchase_email_verification_challenges").find((row) =>
      row.id === args.p_challenge_id && row.user_id === args.p_user_id && row.verified_at == null && row.superseded_at != null
    );
    if (!challenge || String(args.p_expires_at) <= now || String(args.p_resend_available_at) <= now) return false;
    for (const row of table("purchase_email_verification_challenges")) {
      if (row.user_id === args.p_user_id && row.id !== challenge.id && row.verified_at == null && row.superseded_at == null) {
        Object.assign(row, { superseded_at: now, expires_at: now, updated_at: now });
      }
    }
    Object.assign(challenge, {
      superseded_at: null,
      expires_at: args.p_expires_at,
      resend_available_at: args.p_resend_available_at,
      updated_at: now,
    });
    const email = String(challenge.candidate_email);
    insertRow("audit_logs", {
      actor_user_id: args.p_user_id,
      action: "purchase.email_verification_requested",
      entity_type: "user",
      entity_id: args.p_user_id,
      metadata: { candidate_email_masked: `${email.slice(0, 2)}***@${email.split("@")[1]}`, delivery_status: "sent" },
    });
    return true;
  },
  // Mirrors 20260831150000_guardian_identity_payment_outbox.sql.
  claim_email_notifications: (args) => {
    const now = new Date().toISOString();
    const claimed = table("notification_deliveries")
      .filter((row) => ["pending", "failed"].includes(String(row.status)) && String(row.next_attempt_at) <= now && Number(row.attempt_count) < 8)
      .slice(0, Math.max(1, Math.min(Number(args.p_limit ?? 10), 50)));
    for (const row of claimed) Object.assign(row, { status: "processing", attempt_count: Number(row.attempt_count) + 1, updated_at: now });
    return claimed.map((row) => ({ ...row }));
  },
  // Mirrors 20260906100000_otp_atomic_verification.sql, including the guardian_accounts
  // update that fires on_guardian_email_verified_welcome.
  verify_purchase_email_otp: (args) => {
    const now = new Date().toISOString();
    const email = String(args.p_candidate_email || "").trim().toLowerCase();
    const mine = table("purchase_email_verification_challenges")
      .filter((row) => row.user_id === args.p_user_id && String(row.candidate_email).trim().toLowerCase() === email);
    const active = mine
      .filter((row) => row.verified_at == null && row.superseded_at == null && String(row.expires_at) > now)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!active.length) {
      if (mine.some((row) => row.verified_at != null)) return { success: false, error_code: "ALREADY_VERIFIED" };
      if (mine.some((row) => row.superseded_at != null)) return { success: false, error_code: "SUPERSEDED" };
      return { success: false, error_code: "EXPIRED" };
    }
    const newest = active[0];
    if (Number(newest.attempt_count ?? 0) >= 5) return { success: false, error_code: "TOO_MANY_ATTEMPTS" };
    const match = active.find((row) => row.code_hash === args.p_code_hash);
    if (!match) {
      newest.attempt_count = Number(newest.attempt_count ?? 0) + 1;
      return { success: false, error_code: "INVALID_CODE", remaining_attempts: Math.max(0, 5 - Number(newest.attempt_count)) };
    }
    match.verified_at = now;
    for (const row of active) if (row !== match) row.superseded_at = now;
    const guardian = table("guardian_accounts").find((row) => row.user_id === args.p_user_id);
    if (!guardian) throw new Error("GUARDIAN_ACCOUNT_NOT_FOUND");
    const wasVerified = guardian.email_verified_at != null;
    Object.assign(guardian, { email, email_verified_at: guardian.email_verified_at ?? now, updated_at: now });
    if (!wasVerified) queueGuardianEmailVerifiedWelcome(guardian);
    return { success: true, challenge_id: match.id, candidate_email: match.candidate_email, verified_at: now };
  },
  // Mirrors 20260906110000_email_change_otp_candidate_hashes.sql.
  verify_email_change_otp: (args) => {
    const now = new Date().toISOString();
    const mine = table("email_change_challenges").filter((row) => row.user_id === args.p_user_id);
    const active = mine
      .filter((row) => row.verified_at == null && row.superseded_at == null && String(row.expires_at) > now)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!active.length) {
      if (mine.some((row) => row.verified_at != null)) return { success: false, error_code: "ALREADY_VERIFIED" };
      if (mine.some((row) => row.superseded_at != null)) return { success: false, error_code: "SUPERSEDED" };
      return { success: false, error_code: "EXPIRED" };
    }
    const newest = active[0];
    if (Number(newest.attempt_count ?? 0) >= 5) return { success: false, error_code: "TOO_MANY_ATTEMPTS" };
    const match = active.find((row) => (args.p_code_hashes as string[]).includes(String(row.code_hash)));
    if (!match) {
      newest.attempt_count = Number(newest.attempt_count ?? 0) + 1;
      return { success: false, error_code: "INVALID_CODE", remaining_attempts: Math.max(0, 5 - Number(newest.attempt_count)) };
    }
    match.verified_at = now;
    for (const row of active) if (row !== match) row.superseded_at = now;
    return { success: true, challenge_id: match.id, old_email: match.old_email, new_email: match.new_email, verified_at: now };
  },
};

async function handlePostgrest(url: URL, method: string, headers: Headers, body: unknown) {
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  if (path.startsWith("rpc/")) {
    const handler = rpcs[path.slice(4)];
    if (!handler) throw new Error(`fake PostgREST: unknown rpc ${path}`);
    return json(handler((body ?? {}) as Row, headers));
  }
  const rows = filterRows(table(path), url.searchParams);
  const wantsObject = (headers.get("accept") || "").includes("vnd.pgrst.object");
  const returning = (headers.get("prefer") || "").includes("return=representation");
  if (method === "GET" || method === "HEAD") {
    if (wantsObject) return rows.length === 1 ? json(rows[0]) : json({ code: "PGRST116" }, 406);
    return json(rows, 200, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
  }
  if (method === "POST") {
    const inserted = (Array.isArray(body) ? body : [body]).map((item) => insertRow(path, item as Row));
    return returning ? json(wantsObject ? inserted[0] : inserted, 201) : new Response(null, { status: 201 });
  }
  if (method === "PATCH") {
    for (const row of rows) Object.assign(row, body as Row);
    return returning ? json(rows) : new Response(null, { status: 204 });
  }
  throw new Error(`fake PostgREST: unsupported ${method} ${path}`);
}

// ---- Supabase Auth ---------------------------------------------------------

function handleAuth(url: URL, method: string, headers: Headers, body: Row | undefined) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (path === "/user" && method === "GET") {
    const user = userFromBearer(headers);
    return user ? json(user) : json({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }, 401);
  }
  if (path === "/admin/users" && method === "GET") {
    const page = Number(url.searchParams.get("page") || 1);
    const perPage = Number(url.searchParams.get("per_page") || 50);
    return json({ users: state.users.slice((page - 1) * perPage, page * perPage), aud: "authenticated" }, 200, {
      "x-total-count": String(state.users.length),
    });
  }
  const byId = path.match(/^\/admin\/users\/([0-9a-f-]+)$/);
  if (byId) {
    const user = state.users.find((item) => item.id === byId[1]);
    if (!user) return json({ code: 404, error_code: "user_not_found", msg: "User not found" }, 404);
    if (method === "PUT" && body) {
      if (typeof body.email === "string") user.email = body.email;
      if (body.email_confirm === true) user.email_confirmed_at = new Date().toISOString();
    }
    return json(user);
  }
  if (path === "/admin/generate_link" && method === "POST") {
    const redirectTo = url.searchParams.get("redirect_to") || String(body?.redirect_to || "");
    state.generateLinkCalls.push({ ...body, redirect_to: redirectTo });
    const user = state.users.find((item) => item.email === body?.email);
    const hashed = crypto.randomUUID().replaceAll("-", "");
    return json({
      ...user,
      action_link: `${SUPABASE_URL}/auth/v1/verify?token=${hashed}&type=${body?.type}&redirect_to=${encodeURIComponent(redirectTo)}`,
      hashed_token: hashed,
      redirect_to: redirectTo,
      verification_type: body?.type,
      email_otp: "000000",
    });
  }
  throw new Error(`fake Auth: unsupported ${method} ${path}`);
}

// ---- Gmail / Turnstile -----------------------------------------------------

function decodeMime(raw: string): SentMail {
  const mime = new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  const unfolded = mime.split("\r\n\r\n")[0].replace(/\r\n[ \t]+/g, " ");
  const header = (name: string) => unfolded.match(new RegExp(`^${name}: (.*)$`, "mi"))?.[1]?.trim() ?? "";
  const encodedSubject = header("Subject");
  // RFC 2047: adjacent encoded words form one byte stream (a character may span words).
  const encodedWords = [...encodedSubject.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/gi)];
  const subject = encodedWords.length
    ? new TextDecoder().decode(Uint8Array.from(encodedWords.map((word) => atob(word[1])).join(""), (c) => c.charCodeAt(0)))
    : encodedSubject;
  const decodedParts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/g)]
    .map((part) => new TextDecoder().decode(Uint8Array.from(atob(part[1].replace(/\r\n/g, "")), (c) => c.charCodeAt(0))));
  return { to: header("To"), bcc: header("Bcc"), subject, body: decodedParts.join("\n"), headers: mime.split("\r\n\r\n")[0] };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const headers = request.headers;
  const text = method === "GET" || method === "HEAD" ? "" : await request.text();

  if (url.origin === SUPABASE_URL) {
    // Mimic the hosted gateway: only project API keys are accepted as `apikey`.
    const apikey = headers.get("apikey") || "";
    if (apikey !== SECRET_KEY && apikey !== PUBLISHABLE_KEY) {
      state.rejectedApiKeys += 1;
      return json({ message: "Invalid API key" }, 401);
    }
    const body = text ? JSON.parse(text) : undefined;
    if (url.pathname.startsWith("/rest/v1/")) return handlePostgrest(url, method, headers, body);
    if (url.pathname.startsWith("/auth/v1/")) return handleAuth(url, method, headers, body);
  }
  if (url.href === "https://oauth2.googleapis.com/token") return json({ access_token: "fixture-access-token" });
  if (url.href === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
    if (state.gmailFailures > 0) {
      state.gmailFailures -= 1;
      return json({ error: { code: 500, message: "fixture provider failure" } }, 500);
    }
    state.mailbox.push(decodeMime(JSON.parse(text).raw));
    return json({ id: `fixture-message-${state.mailbox.length}` });
  }
  if (url.href === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    state.turnstileCalls += 1;
    const token = new URLSearchParams(text).get("response");
    return token === "fixture-valid-turnstile"
      ? json({ success: true, hostname: "oriens-academy.com", action: "password_recovery" })
      : json({ success: false, "error-codes": ["invalid-input-response"] });
  }
  state.realFetchCalls += 1;
  void realFetch;
  throw new Error(`Blocked unexpected network call: ${method} ${url.origin}${url.pathname}`);
};

// ---- Deno.serve capture ----------------------------------------------------

type Handler = (req: Request) => Response | Promise<Response>;
export const handlers: Record<string, Handler> = {};
Object.defineProperty(Deno, "serve", {
  configurable: true,
  writable: true,
  value: (handler: Handler) => {
    const name = new Error().stack?.match(/functions[\\/]([a-z-]+)[\\/]index\.ts/)?.[1];
    if (!name) throw new Error("Deno.serve called from an unknown module");
    handlers[name] = handler;
    return { finished: Promise.resolve(), shutdown: async () => {}, ref() {}, unref() {}, addr: { hostname: "fixture", port: 0, transport: "tcp" } };
  },
});

export async function invoke(name: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await handlers[name](new Request(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://oriens-academy.com", ...headers },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

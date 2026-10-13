
type Priority = "normal" | "lansia" | "disabilitas" | "vip";
type TicketStatus = "waiting" | "called" | "done" | "skipped";

interface QueueType {
  id: string;
  code: string; 
  name: string; 
  active: boolean;
}

interface Ticket {
  id: string;
  typeId: string; 
  code: string; 
  number: number; 
  label: string; 
  priority: Priority;
  status: TicketStatus;
  createdAt: number; 
  calledAt?: number; 
}

const STORAGE_KEYS = {
  types: "queueTypes",
  tickets: "tickets",
  counters: "ticketCounters",
} as const;

const PRIORITIES: Priority[] = ["normal", "lansia", "disabilitas", "vip"];

const PRIORITY_LABEL: Record<Priority, string> = {
  normal: "Normal",
  lansia: "Lansia",
  disabilitas: "Disabilitas",
  vip: "VIP",
};

const PRIORITY_RANK: Record<Priority, number> = {
  vip: 0,
  disabilitas: 1,
  lansia: 2,
  normal: 3,
};

/*Local Storage*/

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (err) {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getTypes(): QueueType[] {
  const raw = readJSON<unknown>(STORAGE_KEYS.types, []);
  if (!Array.isArray(raw)) return [];

  // Normalisasi data lama: dulu dashboard menyimpan `isActive` tanpa `id`.
  // Sekarang semua halaman memakai skema yang sama: { id, code, name, active }.
  let changed = false;
  const normalized: QueueType[] = raw.map((item: any, index: number) => {
    const code = String(item?.code ?? "").trim().toUpperCase();
    const name = String(item?.name ?? `Layanan ${index + 1}`).trim();
    const id = String(item?.id ?? `type-${code.toLowerCase() || index + 1}`);
    const active = typeof item?.active === "boolean"
      ? item.active
      : typeof item?.isActive === "boolean" ? item.isActive : true;
    if (item?.id !== id || item?.active !== active || item?.code !== code || "isActive" in (item ?? {})) changed = true;
    return { id, code, name, active };
  });
  if (changed) writeJSON(STORAGE_KEYS.types, normalized);
  return normalized;
}

function saveTypes(types: QueueType[]): void {
  writeJSON(STORAGE_KEYS.types, types);
}

function getTickets(): Ticket[] {
  const raw = readJSON<unknown>(STORAGE_KEYS.tickets, []);
  if (!Array.isArray(raw)) return [];

  // Normalize legacy admin tickets (e.g. status "Menunggu", priority "VIP")
  // into the canonical schema consumed by the operator and display pages.
  const types = getTypes();
  let changed = false;
  const normalized: Ticket[] = raw.map((item: any, index: number) => {
    const code = String(item?.code ?? "").trim().toUpperCase();
    const numberFromLabel = Number(String(item?.label ?? item?.id ?? "").match(/(\d+)$/)?.[1]);
    const number = Number.isFinite(item?.number) && item.number > 0
      ? Number(item.number)
      : numberFromLabel > 0 ? numberFromLabel : index + 1;
    const oldPriority = String(item?.priority ?? "normal").toLowerCase();
    const priority: Priority = (["normal", "lansia", "disabilitas", "vip"].includes(oldPriority)
      ? oldPriority : "normal") as Priority;
    const oldStatus = String(item?.status ?? "waiting").toLowerCase();
    const status: TicketStatus = oldStatus === "menunggu" || oldStatus === "waiting"
      ? "waiting"
      : oldStatus === "dipanggil" || oldStatus === "called"
        ? "called"
        : oldStatus === "selesai" || oldStatus === "done"
          ? "done"
          : oldStatus === "dilewati" || oldStatus === "skipped" ? "skipped" : "waiting";
    const type = types.find((t) => t.code === code);
    const label = String(item?.label ?? item?.id ?? formatLabel(code, number));
    const id = item?.typeId && item?.createdAt && item?.label
      ? String(item.id)
      : `legacy-${code}-${number}-${index}`;
    const createdAt = Number(item?.createdAt) || (Date.now() + index);
    if (item?.typeId !== (type?.id ?? `type-${code.toLowerCase()}`) || item?.label !== label || item?.status !== status || item?.priority !== priority || item?.createdAt !== createdAt) changed = true;
    return {
      ...item,
      id,
      typeId: String(item?.typeId ?? type?.id ?? `type-${code.toLowerCase()}`),
      code,
      number,
      label,
      priority,
      status,
      createdAt,
    } as Ticket;
  });
  if (changed) writeJSON(STORAGE_KEYS.tickets, normalized);
  return normalized;
}

function getCounters(): Record<string, number> {
  const data = readJSON<Record<string, number>>(STORAGE_KEYS.counters, {});
  return data && typeof data === "object" ? data : {};
}

function seedDefaults(): void {
  try {
    if (localStorage.getItem(STORAGE_KEYS.types) === null) {
      const defaults: QueueType[] = [
        { id: "type-a", code: "A", name: "Umum", active: true },
        { id: "type-g", code: "G", name: "Gigi", active: true },
        { id: "type-f", code: "F", name: "Farmasi", active: true },
      ];
      writeJSON(STORAGE_KEYS.types, defaults);
    }
    if (localStorage.getItem(STORAGE_KEYS.tickets) === null) writeJSON(STORAGE_KEYS.tickets, []);
    if (localStorage.getItem(STORAGE_KEYS.counters) === null) writeJSON(STORAGE_KEYS.counters, {});
  } catch (err) {
    console.error("Gagal menulis ke Local Storage:", err);
  }
}


function formatLabel(code: string, num: number): string {
  return `${code}-${String(num).padStart(3, "0")}`;
}

function compareTickets(a: Ticket, b: Ticket): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return byPriority !== 0 ? byPriority : a.createdAt - b.createdAt;
}

function makeId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Nomor urut yang akan didapat pengambil tiket berikutnya untuk kode ini. */
function nextNumberFor(code: string): number {
  const fromCounter = getCounters()[code] ?? 0;
  const fromTickets = getTickets()
    .filter((t) => t.code === code)
    .reduce((max, t) => Math.max(max, t.number), 0);
  return Math.max(fromCounter, fromTickets) + 1;
}

function nextIssueLabel(code: string): string {
  return formatLabel(code, nextNumberFor(code));
}

function issueTicket(typeId: string, priority: Priority): Ticket {
  const type = getTypes().find((t) => t.id === typeId);
  if (!type) throw new Error("Jenis antrian tidak ditemukan. Muat ulang halaman lalu coba lagi.");
  if (!type.active) throw new Error(`Antrian ${type.name} sedang ditutup. Pilih layanan lain.`);

  const counters = getCounters();
  const next = nextNumberFor(type.code);
  counters[type.code] = next;

  const ticket: Ticket = {
    id: makeId(),
    typeId: type.id,
    code: type.code,
    number: next,
    label: formatLabel(type.code, next),
    priority,
    status: "waiting",
    createdAt: Date.now(),
  };

  const tickets = getTickets();
  tickets.push(ticket);
  writeJSON(STORAGE_KEYS.counters, counters);
  writeJSON(STORAGE_KEYS.tickets, tickets);
  return ticket;
}

function watchData(
  onChange: () => void,
  options: { intervalMs?: number; onPoll?: () => void } = {}
): void {
  const { intervalMs = 2500, onPoll } = options;
  let lastSignature = "";

  const signature = (): string =>
    [STORAGE_KEYS.types, STORAGE_KEYS.tickets, STORAGE_KEYS.counters]
      .map((key) => localStorage.getItem(key) ?? "")
      .join("|");

  const check = (force = false): void => {
    const current = signature();
    if (force || current !== lastSignature) {
      lastSignature = current;
      onChange();
    }
    onPoll?.();
  };

  check(true);
  window.setInterval(() => check(), intervalMs);
  window.addEventListener("storage", () => check());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemen #${id} tidak ditemukan di halaman.`);
  return node as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("id-ID", { hour12: false });
}

/* ===== Auth & Role (dipakai semua halaman) ===== */

type Role = "admin" | "moderator" | "user";

interface Session {
  token: string;
  role: Role;
  firstName: string;
}

const SESSION_KEYS = ["accessToken", "token", "role", "firstName"] as const;
const STAFF_ROLES: Role[] = ["admin", "moderator"];
const ALL_ROLES: Role[] = ["admin", "moderator", "user"];

function normalizeRole(value: string | null | undefined): Role | null {
  const role = String(value ?? "").trim().toLowerCase();
  return (ALL_ROLES as string[]).includes(role) ? (role as Role) : null;
}

function getSession(): Session | null {
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
  const role = normalizeRole(localStorage.getItem("role"));
  if (!token || !role) return null;
  return { token, role, firstName: localStorage.getItem("firstName") || "Pengguna" };
}

function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** Halaman awal sesuai role: admin/moderator ke dashboard, user ke ambil antrian. */
function homeFor(role: Role): string {
  return isStaff(role) ? "index.html" : "ambil-antrian.html";
}

function logout(): void {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  window.location.href = "login.html";
}

/**
 * Auth guard + role guard. Belum login atau role tidak diizinkan -> paksa ke login.html.
 * Mengembalikan sesi kalau lolos, atau null kalau sedang di-redirect.
 */
function requireAuth(allowed: Role[] = ALL_ROLES): Session | null {
  const session = getSession();
  if (!session) {
    window.location.replace("login.html");
    return null;
  }
  if (!allowed.includes(session.role)) {
    window.location.replace("login.html?denied=1");
    return null;
  }
  // Logout di tab lain ikut mengeluarkan tab ini.
  window.addEventListener("storage", (event) => {
    if (event.key === null || SESSION_KEYS.includes(event.key as (typeof SESSION_KEYS)[number])) {
      if (!getSession()) window.location.replace("login.html");
    }
  });
  return session;
}

/** Isi nama + role di header, pasang tombol Keluar, sembunyikan menu khusus staff untuk role user. */
function mountUserBar(session: Session): void {
  const nameEl = document.getElementById("session-name");
  const roleEl = document.getElementById("session-role");
  if (nameEl) nameEl.textContent = session.firstName;
  if (roleEl) roleEl.textContent = session.role;
  const brand = document.getElementById("app-brand") as HTMLAnchorElement | null;
  if (brand) brand.href = homeFor(session.role);
  document.getElementById("btn-logout")?.addEventListener("click", logout);
  if (!isStaff(session.role)) {
    document.querySelectorAll<HTMLElement>("[data-staff-only]").forEach((node) => node.remove());
  }
}

/* ===== Aksi antrian (operator & dashboard) ===== */

function waitingTickets(typeId: string): Ticket[] {
  return getTickets()
    .filter((t) => t.typeId === typeId && t.status === "waiting")
    .sort(compareTickets);
}

function currentTicket(typeId: string): Ticket | undefined {
  return getTickets()
    .filter((t) => t.typeId === typeId && t.status === "called")
    .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0))[0];
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  waiting: "Menunggu",
  called: "Dipanggil",
  done: "Selesai",
  skipped: "Dilewati",
};

/** Ubah status satu tiket. */
function setTicketStatus(ticketId: string, status: TicketStatus): Ticket {
  const tickets = getTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error("Tiket tidak ditemukan. Data mungkin sudah berubah.");
  ticket.status = status;
  if (status === "called") ticket.calledAt = Date.now();
  writeJSON(STORAGE_KEYS.tickets, tickets);
  return ticket;
}

/**
 * Panggil tiket tertentu. Tiket yang sedang dipanggil di jenis yang sama otomatis Selesai.
 * announce = true: halaman ini (operator/dashboard) langsung mengumumkan nomornya lewat suara.
 */
function callTicket(ticketId: string, announce = false): Ticket {
  const tickets = getTickets();
  const target = tickets.find((t) => t.id === ticketId);
  if (!target) throw new Error("Tiket tidak ditemukan. Data mungkin sudah berubah.");
  for (const t of tickets) {
    if (t.typeId === target.typeId && t.status === "called") t.status = "done";
  }
  target.status = "called";
  target.calledAt = Date.now();
  const speakHere = announce && isSoundOn();
  // Tandai dulu SEBELUM tiket disimpan, supaya Layar Antrian di tab lain tidak ikut bersuara (dobel).
  if (speakHere) localStorage.setItem(ANNOUNCED_KEY, target.id);
  writeJSON(STORAGE_KEYS.tickets, tickets);
  if (speakHere) announceTickets([target]);
  return target;
}

/** Panggil Berikutnya: tiket aktif jadi Selesai, tiket prioritas teratas dipanggil. */
function callNext(typeId: string, announce = false): Ticket | null {
  const next = waitingTickets(typeId)[0];
  return next ? callTicket(next.id, announce) : null;
}

/* ===== Suara panggilan (dipakai layar, operator, dashboard) ===== */

const SOUND_KEY = "layarSound";
/** Id tiket terakhir yang sudah diumumkan oleh halaman yang memanggilnya. */
const ANNOUNCED_KEY = "lastAnnouncedTicket";
const DIGIT_WORDS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

let callVoice: SpeechSynthesisVoice | null = null;
let chimeCtx: AudioContext | null = null;

/** Suara menyala kecuali pengguna mematikannya di Layar Antrian. */
function isSoundOn(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "off";
}

// Pilih suara Bahasa Indonesia terbaik: Google (Chrome) > Microsoft Natural/Online (Edge) > id-ID apa pun.
function pickVoice(): void {
  const indo = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("id"));
  callVoice =
    indo.find((v) => /google/i.test(v.name)) ??
    indo.find((v) => /natural|online/i.test(v.name)) ??
    indo[0] ??
    null;
}

if ("speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
}

function speakText(text: string, onBlocked?: () => void): void {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  if (callVoice) utterance.voice = callVoice;
  utterance.rate = 0.9;
  utterance.addEventListener("error", (event) => {
    if (event.error === "not-allowed") onBlocked?.();
  });
  window.speechSynthesis.speak(utterance);
}

/** Buka AudioContext tanpa bunyi (harus dipanggil dari klik/tombol pengguna). */
function primeAudio(): void {
  try {
    if (chimeCtx === null) chimeCtx = new AudioContext();
    if (chimeCtx.state === "suspended") void chimeCtx.resume();
  } catch (err) {
    /* audio tidak didukung */
  }
}

function playChime(): void {
  try {
    if (chimeCtx === null) chimeCtx = new AudioContext();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") void ctx.resume();
    [659.25, 523.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.35;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch (err) {
    /* audio tidak didukung */
  }
}

/** "A-007" -> "A, nol nol tujuh" supaya dibaca per digit seperti panggilan loket. */
function spokenLabel(ticket: Ticket): string {
  const digits = String(ticket.number).padStart(3, "0").split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ");
  return `${ticket.code}, ${digits}`;
}

/** Bunyi "ding-dong" lalu: "Nomor antrian A, nol nol tujuh. Silakan ke loket Umum." */
function announceTickets(tickets: Ticket[], onBlocked?: () => void): void {
  if (tickets.length === 0) return;
  const types = getTypes();
  playChime();
  window.setTimeout(() => {
    for (const ticket of tickets) {
      const type = types.find((t) => t.id === ticket.typeId);
      speakText(
        `Nomor antrian, ${spokenLabel(ticket)}. Silakan ke loket ${type ? type.name : ticket.code}.`,
        onBlocked
      );
    }
  }, 800);
}

/** Lewati: tiket yang sedang dipanggil (tidak hadir) ditandai Dilewati. */
function skipCurrent(typeId: string): Ticket | null {
  const current = currentTicket(typeId);
  return current ? setTicketStatus(current.id, "skipped") : null;
}

/** Selesai: tutup tiket yang sedang dipanggil tanpa memanggil berikutnya. */
function finishCurrent(typeId: string): Ticket | null {
  const current = currentTicket(typeId);
  return current ? setTicketStatus(current.id, "done") : null;
}

/** Kosongkan semua tiket dan kembalikan penomoran ke 001. */
function resetQueue(): void {
  writeJSON(STORAGE_KEYS.tickets, []);
  writeJSON(STORAGE_KEYS.counters, {});
}

/* ===== Utilitas UI bersama ===== */

function startClock(target: HTMLElement): void {
  const tick = (): void => { target.textContent = formatTime(); };
  tick();
  window.setInterval(tick, 1000);
}

/** Tombol toggle Layar Penuh (Fullscreen API). */
function mountFullscreenToggle(button: HTMLButtonElement): void {
  button.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error("Gagal mengubah mode layar penuh:", err);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement !== null;
    button.textContent = active ? "Keluar layar penuh" : "Layar penuh";
    button.setAttribute("aria-pressed", String(active));
    document.body.classList.toggle("is-fullscreen", active);
  });
}

function makeToast(target: HTMLElement): (message: string, isError?: boolean) => void {
  let timer = 0;
  return (message, isError = false) => {
    target.textContent = message;
    target.classList.toggle("is-error", isError);
    target.classList.add("is-visible");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => target.classList.remove("is-visible"), 3200);
  };
}

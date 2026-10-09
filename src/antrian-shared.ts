
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
  const data = readJSON<QueueType[]>(STORAGE_KEYS.types, []);
  return Array.isArray(data) ? data : [];
}

function getTickets(): Ticket[] {
  const data = readJSON<Ticket[]>(STORAGE_KEYS.tickets, []);
  return Array.isArray(data) ? data : [];
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

function issueTicket(typeId: string, priority: Priority): Ticket {
  const type = getTypes().find((t) => t.id === typeId);
  if (!type) throw new Error("Jenis antrian tidak ditemukan. Muat ulang halaman lalu coba lagi.");
  if (!type.active) throw new Error(`Antrian ${type.name} sedang ditutup. Pilih layanan lain.`);

  const counters = getCounters();
  const next = (counters[type.code] ?? 0) + 1;
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
    [STORAGE_KEYS.types, STORAGE_KEYS.tickets]
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

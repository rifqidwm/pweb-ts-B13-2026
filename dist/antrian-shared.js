"use strict";
const STORAGE_KEYS = {
    types: "queueTypes",
    tickets: "tickets",
    counters: "ticketCounters",
};
const PRIORITIES = ["normal", "lansia", "disabilitas", "vip"];
const PRIORITY_LABEL = {
    normal: "Normal",
    lansia: "Lansia",
    disabilitas: "Disabilitas",
    vip: "VIP",
};
const PRIORITY_RANK = {
    vip: 0,
    disabilitas: 1,
    lansia: 2,
    normal: 3,
};
/*Local Storage*/
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    }
    catch (err) {
        return fallback;
    }
}
function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function getTypes() {
    const data = readJSON(STORAGE_KEYS.types, []);
    return Array.isArray(data) ? data : [];
}
function getTickets() {
    const data = readJSON(STORAGE_KEYS.tickets, []);
    return Array.isArray(data) ? data : [];
}
function getCounters() {
    const data = readJSON(STORAGE_KEYS.counters, {});
    return data && typeof data === "object" ? data : {};
}
function seedDefaults() {
    try {
        if (localStorage.getItem(STORAGE_KEYS.types) === null) {
            const defaults = [
                { id: "type-a", code: "A", name: "Umum", active: true },
                { id: "type-g", code: "G", name: "Gigi", active: true },
                { id: "type-f", code: "F", name: "Farmasi", active: true },
            ];
            writeJSON(STORAGE_KEYS.types, defaults);
        }
        if (localStorage.getItem(STORAGE_KEYS.tickets) === null)
            writeJSON(STORAGE_KEYS.tickets, []);
        if (localStorage.getItem(STORAGE_KEYS.counters) === null)
            writeJSON(STORAGE_KEYS.counters, {});
    }
    catch (err) {
        console.error("Gagal menulis ke Local Storage. Pastikan browser mendukung Local Storage dan tidak dalam mode penyamaran.", err);
    }
}
function formatLabel(code, num) {
    return `${code}-${String(num).padStart(3, "0")}`;
}
function compareTickets(a, b) {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return byPriority !== 0 ? byPriority : a.createdAt - b.createdAt;
}
function makeId() {
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function issueTicket(typeId, priority) {
    const type = getTypes().find((t) => t.id === typeId);
    if (!type)
        throw new Error("Jenis antrian tidak ditemukan. Muat ulang halaman lalu coba lagi.");
    if (!type.active)
        throw new Error(`Antrian ${type.name} sedang ditutup. Pilih layanan lain.`);
    const counters = getCounters();
    const next = (counters[type.code] ?? 0) + 1;
    counters[type.code] = next;
    const ticket = {
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
function watchData(onChange, options = {}) {
    const { intervalMs = 2500, onPoll } = options;
    let lastSignature = "";
    const signature = () => [STORAGE_KEYS.types, STORAGE_KEYS.tickets]
        .map((key) => localStorage.getItem(key) ?? "")
        .join("|");
    const check = (force = false) => {
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
        if (!document.hidden)
            check();
    });
}
function byId(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Elemen #${id} tidak ditemukan di halaman.`);
    return node;
}
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function formatTime(date = new Date()) {
    return date.toLocaleTimeString("id-ID", { hour12: false });
}

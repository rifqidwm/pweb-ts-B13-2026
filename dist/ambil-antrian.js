"use strict";
(() => {
    const gridEl = byId("type-grid");
    const priorityGroupEl = byId("priority-group");
    const updatedEl = byId("updated");
    const toastEl = byId("toast");
    const dialog = byId("ticket-dialog");
    const dlgNumber = byId("dlg-number");
    const dlgService = byId("dlg-service");
    const dlgPriority = byId("dlg-priority");
    const dlgTime = byId("dlg-time");
    const dlgAhead = byId("dlg-ahead");
    let selected = "normal";
    let toastTimer = 0;
    const priorityButtons = Array.from(priorityGroupEl.querySelectorAll("button[data-priority]"));
    function isPriority(value) {
        return PRIORITIES.includes(value);
    }
    function syncPriorityButtons() {
        for (const btn of priorityButtons) {
            btn.setAttribute("aria-pressed", String(btn.dataset.priority === selected));
        }
    }
    priorityGroupEl.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-priority]");
        if (!btn || !isPriority(btn.dataset.priority))
            return;
        selected = btn.dataset.priority;
        syncPriorityButtons();
        render();
    });
    function buildCard(type, waitingCount) {
        const card = el("article", "type-card");
        if (!type.active)
            card.classList.add("is-closed");
        const ghost = el("span", "type-ghost", type.code);
        ghost.setAttribute("aria-hidden", "true");
        const name = el("h3", "type-name", type.name);
        const status = el("p", "type-status", type.active ? `${waitingCount} orang menunggu` : "Ditutup sementara");
        const button = el("button", "btn btn-primary btn-block btn-take", "Ambil nomor");
        button.type = "button";
        button.dataset.typeId = type.id;
        button.disabled = !type.active;
        card.append(ghost, name, status, button);
        if (type.active) {
            card.append(el("p", "type-priority", `Prioritas ${PRIORITY_LABEL[selected]}`));
        }
        return card;
    }
    function render() {
        const types = getTypes();
        const tickets = getTickets();
        if (types.length === 0) {
            gridEl.replaceChildren(el("p", "grid-empty", "Belum ada layanan yang dibuka. Silakan hubungi petugas di loket."));
            return;
        }
        const cards = types.map((type) => {
            const waiting = tickets.filter((t) => t.typeId === type.id && t.status === "waiting").length;
            return buildCard(type, waiting);
        });
        gridEl.replaceChildren(...cards);
    }
    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toastEl.classList.remove("is-visible"), 3500);
    }
    function showTicket(ticket) {
        const type = getTypes().find((t) => t.id === ticket.typeId);
        const ahead = getTickets().filter((t) => t.typeId === ticket.typeId &&
            t.status === "waiting" &&
            t.id !== ticket.id &&
            compareTickets(t, ticket) < 0).length;
        dlgNumber.textContent = ticket.label;
        dlgService.textContent = type ? type.name : ticket.code;
        dlgPriority.textContent = PRIORITY_LABEL[ticket.priority];
        dlgTime.textContent = formatTime(new Date(ticket.createdAt));
        dlgAhead.textContent =
            ahead === 0 ? "Tidak ada antrian di depan Anda." : `${ahead} antrian di depan Anda.`;
        if (!dialog.open)
            dialog.showModal();
    }
    gridEl.addEventListener("click", (event) => {
        const btn = event.target.closest(".btn-take");
        if (!btn || btn.disabled || !btn.dataset.typeId)
            return;
        btn.disabled = true; 
        try {
            const ticket = issueTicket(btn.dataset.typeId, selected);
            showTicket(ticket);
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal mengambil nomor. Coba lagi.");
        }
        finally {
            render(); 
        }
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog)
            dialog.close();
    });
    seedDefaults();
    syncPriorityButtons();
    watchData(render, {
        intervalMs: 2500,
        onPoll: () => {
            updatedEl.textContent = `Data diperbarui ${formatTime()}`;
        },
    });
})();

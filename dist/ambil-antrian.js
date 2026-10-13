"use strict";
(() => {
    // Revisi soal: ambil-antrian.html protected, semua role wajib login.
    const session = requireAuth(ALL_ROLES);
    if (!session)
        return;
    mountUserBar(session);
    const gridEl = byId("type-grid");
    const updatedEl = byId("updated");
    const toastEl = byId("toast");
    const fullscreenBtn = byId("btn-fullscreen");
    const dialog = byId("ticket-dialog");
    const dlgNumber = byId("dlg-number");
    const dlgService = byId("dlg-service");
    const dlgPriority = byId("dlg-priority");
    const dlgTime = byId("dlg-time");
    const dlgAhead = byId("dlg-ahead");
    // Prioritas yang dipilih per jenis antrian (tetap tersimpan walau kartu dirender ulang oleh polling).
    const selected = new Map();
    function isPriority(value) {
        return PRIORITIES.includes(value);
    }
    function buildCard(type, waitingCount) {
        const card = el("article", "panel type-card");
        if (!type.active)
            card.classList.add("is-closed");
        const chosen = selected.get(type.id) ?? "normal";
        const head = el("div", "card-head");
        head.append(el("h3", "card-name", type.name.toUpperCase()), el("span", "code-badge", type.code));
        const status = el("p", "type-status");
        if (type.active) {
            status.append(`${waitingCount} menunggu · nomor Anda berikutnya `, el("strong", "", nextIssueLabel(type.code)));
        }
        else {
            status.textContent = "Ditutup sementara";
        }
        // Pilihan prioritas tampil langsung di atas tombol Ambil Nomor.
        const pickLabel = el("p", "prio-label", "Prioritas");
        const pick = el("div", "prio-pick");
        pick.setAttribute("role", "group");
        pick.setAttribute("aria-label", `Prioritas ${type.name}`);
        for (const p of PRIORITIES) {
            const btn = el("button", "", PRIORITY_LABEL[p]);
            btn.type = "button";
            btn.dataset.pickType = type.id;
            btn.dataset.priority = p;
            btn.disabled = !type.active;
            btn.setAttribute("aria-pressed", String(p === chosen));
            pick.append(btn);
        }
        const take = el("button", "btn btn-primary btn-block btn-take", chosen === "normal" ? "Ambil Nomor" : `Ambil Nomor ${PRIORITY_LABEL[chosen]}`);
        take.type = "button";
        take.dataset.typeId = type.id;
        take.disabled = !type.active;
        card.append(head, status, pickLabel, pick, take);
        return card;
    }
    function render() {
        // Jenis aktif di depan, yang ditutup di belakang.
        const types = [...getTypes()].sort((a, b) => Number(b.active) - Number(a.active));
        const tickets = getTickets();
        if (types.length === 0) {
            gridEl.replaceChildren(el("p", "empty", "Belum ada layanan yang dibuka. Silakan hubungi petugas di loket."));
            return;
        }
        gridEl.replaceChildren(...types.map((type) => buildCard(type, tickets.filter((t) => t.typeId === type.id && t.status === "waiting").length)));
    }
    const showToast = makeToast(toastEl);
    function showTicket(ticket) {
        const type = getTypes().find((t) => t.id === ticket.typeId);
        const ahead = getTickets().filter((t) => t.typeId === ticket.typeId && t.status === "waiting" && t.id !== ticket.id && compareTickets(t, ticket) < 0).length;
        dlgNumber.textContent = ticket.label;
        dlgService.textContent = type ? type.name : ticket.code;
        dlgPriority.textContent = PRIORITY_LABEL[ticket.priority];
        dlgTime.textContent = formatTime(new Date(ticket.createdAt));
        dlgAhead.textContent = ahead === 0 ? "Tidak ada antrian di depan Anda." : `${ahead} antrian di depan Anda.`;
        if (!dialog.open)
            dialog.showModal();
    }
    gridEl.addEventListener("click", (event) => {
        const target = event.target;
        const pickBtn = target.closest("button[data-pick-type]");
        if (pickBtn && !pickBtn.disabled && pickBtn.dataset.pickType && isPriority(pickBtn.dataset.priority)) {
            selected.set(pickBtn.dataset.pickType, pickBtn.dataset.priority);
            render();
            return;
        }
        const btn = target.closest(".btn-take");
        if (!btn || btn.disabled || !btn.dataset.typeId)
            return;
        const typeId = btn.dataset.typeId;
        btn.disabled = true;
        try {
            showTicket(issueTicket(typeId, selected.get(typeId) ?? "normal"));
            selected.delete(typeId); // kembali ke Normal untuk pengunjung berikutnya
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal mengambil nomor. Coba lagi.", true);
        }
        finally {
            render();
        }
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog)
            dialog.close();
    });
    mountFullscreenToggle(fullscreenBtn);
    seedDefaults();
    watchData(render, {
        intervalMs: 2500,
        onPoll: () => {
            updatedEl.textContent = `Data diperbarui ${formatTime()}`;
        },
    });
})();

(() => {
  // Auth Guard & Role Guard: hanya admin/moderator.
  const session = requireAuth(STAFF_ROLES);
  if (!session) return;
  mountUserBar(session);

  const queueTypeListEl = byId<HTMLDivElement>("queueTypeList");
  const selectQueueTypeEl = byId<HTMLSelectElement>("selectQueueType");
  const addQueueTypeForm = byId<HTMLFormElement>("addQueueTypeForm");
  const queueCodeInput = byId<HTMLInputElement>("queueCode");
  const queueNameInput = byId<HTMLInputElement>("queueName");
  const issueTicketForm = byId<HTMLFormElement>("issueTicketForm");
  const selectPriorityEl = byId<HTMLSelectElement>("selectPriority");
  const issuedTicketListEl = byId<HTMLDivElement>("issuedTicketList");
  const resetQueueBtn = byId<HTMLButtonElement>("resetQueueBtn");
  const typeMsg = byId<HTMLParagraphElement>("typeMessage");
  const ticketMsg = byId<HTMLParagraphElement>("ticketMessage");
  const updatedEl = byId("updated");

  function flash(target: HTMLElement, message: string, isError = false): void {
    target.textContent = message;
    target.classList.toggle("is-error", isError);
    window.setTimeout(() => {
      if (target.textContent === message) target.textContent = "";
    }, 4000);
  }

  function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = el("button", `btn btn-sm ${className}`.trim(), label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      try {
        onClick();
      } catch (error) {
        flash(ticketMsg, error instanceof Error ? error.message : "Aksi gagal.", true);
      }
      renderAll();
    });
    return btn;
  }

  /* ---------- Manajemen jenis antrian ---------- */
  function renderQueueTypes(): void {
    const types = getTypes();
    const tickets = getTickets();
    const keepSelected = selectQueueTypeEl.value;

    selectQueueTypeEl.replaceChildren(new Option("Pilih jenis antrian", ""));
    queueTypeListEl.replaceChildren();

    if (types.length === 0) {
      queueTypeListEl.append(el("p", "empty", "Belum ada jenis antrian. Tambahkan lewat form di atas."));
    }

    for (const qt of types) {
      const waiting = tickets.filter((t) => t.typeId === qt.id && t.status === "waiting").length;

      const row = el("div", `list-row${qt.active ? "" : " is-off"}`);
      const main = el("div", "list-main");
      const title = el("p", "list-title", qt.name.toUpperCase());
      title.append(el("span", "code", `(${qt.code})`));
      const meta = el("p", "list-meta");
      meta.append(
        el("span", `badge ${qt.active ? "badge-ok" : "badge-off"}`, qt.active ? "Aktif" : "Nonaktif"),
        `${waiting} menunggu`
      );
      main.append(title, meta);

      const actions = el("div", "list-actions");
      actions.append(
        button(qt.active ? "Nonaktifkan" : "Aktifkan", "", () => toggleType(qt.id)),
        button("Hapus", "btn-danger", () => deleteType(qt.id))
      );
      row.append(main, actions);
      queueTypeListEl.append(row);

      // Jenis nonaktif tidak bisa dipilih untuk tiket baru.
      if (qt.active) selectQueueTypeEl.append(new Option(`${qt.name} (${qt.code})`, qt.id));
    }

    if ([...selectQueueTypeEl.options].some((o) => o.value === keepSelected)) {
      selectQueueTypeEl.value = keepSelected;
    }
  }

  function toggleType(id: string): void {
    const types = getTypes();
    const target = types.find((t) => t.id === id);
    if (!target) return;
    target.active = !target.active;
    saveTypes(types);
    flash(typeMsg, `${target.name} ${target.active ? "diaktifkan" : "dinonaktifkan"}.`);
  }

  function deleteType(id: string): void {
    const types = getTypes();
    const target = types.find((t) => t.id === id);
    if (!target) return;
    if (!confirm(`Hapus jenis antrian ${target.name} (${target.code})? Semua tiketnya ikut terhapus.`)) return;

    saveTypes(types.filter((t) => t.id !== id));
    writeJSON(STORAGE_KEYS.tickets, getTickets().filter((t) => t.typeId !== id));
    const counters = getCounters();
    delete counters[target.code];
    writeJSON(STORAGE_KEYS.counters, counters);
    flash(typeMsg, `${target.name} dihapus.`);
  }

  // Kode 1 huruf kapital, tolak duplikat kode/nama (case-insensitive).
  addQueueTypeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = queueCodeInput.value.trim().toUpperCase();
    const name = queueNameInput.value.trim();

    if (!/^[A-Z]$/.test(code)) return flash(typeMsg, "Kode harus 1 huruf (A-Z).", true);
    if (!name) return flash(typeMsg, "Nama layanan wajib diisi.", true);

    const types = getTypes();
    if (types.some((t) => t.code.toLowerCase() === code.toLowerCase())) {
      return flash(typeMsg, `Kode ${code} sudah dipakai.`, true);
    }
    if (types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return flash(typeMsg, `Nama "${name}" sudah terdaftar.`, true);
    }

    types.push({ id: `type-${code.toLowerCase()}`, code, name, active: true });
    saveTypes(types);
    addQueueTypeForm.reset();
    queueCodeInput.focus();
    flash(typeMsg, `${name} (${code}) ditambahkan.`);
    renderAll();
  });

  queueCodeInput.addEventListener("input", () => {
    queueCodeInput.value = queueCodeInput.value.toUpperCase().replace(/[^A-Z]/g, "");
  });

  /* ---------- Daftar tiket aktif per jenis ---------- */
  function ticketRow(ticket: Ticket): HTMLElement {
    const row = el("div", `list-row${ticket.status === "called" ? " is-called" : ""}`);
    const main = el("div", "list-main");
    const title = el("p", "list-title");
    title.append(el("span", "ticket-label", ticket.label));
    title.append(el("span", `badge${ticket.priority !== "normal" ? " badge-prio" : ""}`, PRIORITY_LABEL[ticket.priority]));
    title.append(el("span", `badge${ticket.status === "called" ? " badge-call" : ""}`, STATUS_LABEL[ticket.status]));
    main.append(title);

    const actions = el("div", "list-actions");
    if (ticket.status === "called") {
      actions.append(button("Selesai", "", () => {
        setTicketStatus(ticket.id, "done");
        flash(ticketMsg, `${ticket.label} selesai.`);
      }));
    } else {
      actions.append(
        button("Panggil", "", () => flash(ticketMsg, `${callTicket(ticket.id, true).label} dipanggil.`)),
        button("Lewati", "btn-danger", () => {
          setTicketStatus(ticket.id, "skipped");
          flash(ticketMsg, `${ticket.label} dilewati.`);
        })
      );
    }
    row.append(main, actions);
    return row;
  }

  function renderTickets(): void {
    const types = getTypes();
    const tickets = getTickets();
    issuedTicketListEl.replaceChildren();

    let any = false;
    for (const type of types) {
      const called = tickets.filter((t) => t.typeId === type.id && t.status === "called");
      const waiting = tickets.filter((t) => t.typeId === type.id && t.status === "waiting").sort(compareTickets);
      if (called.length + waiting.length === 0) continue;
      any = true;
      issuedTicketListEl.append(el("h3", "group-title", type.name.toUpperCase()));
      [...called, ...waiting].forEach((t) => issuedTicketListEl.append(ticketRow(t)));
    }
    if (!any) issuedTicketListEl.append(el("p", "empty", "Belum ada tiket aktif."));
  }

  issueTicketForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const typeId = selectQueueTypeEl.value;
    const priority = selectPriorityEl.value as Priority;
    if (!typeId) return flash(ticketMsg, "Pilih jenis antrian dulu.", true);
    if (!PRIORITIES.includes(priority)) return;
    try {
      const ticket = issueTicket(typeId, priority);
      flash(ticketMsg, `Tiket ${ticket.label} (${PRIORITY_LABEL[priority]}) diterbitkan.`);
    } catch (error) {
      flash(ticketMsg, error instanceof Error ? error.message : "Gagal menerbitkan tiket.", true);
    }
    renderAll();
  });

  // Reset Antrian: kosongkan tiket, nomor kembali ke 001.
  resetQueueBtn.addEventListener("click", () => {
    if (!confirm("Reset seluruh antrian? Semua tiket dihapus dan nomor kembali ke 001.")) return;
    resetQueue();
    flash(ticketMsg, "Antrian direset.");
    renderAll();
  });

  function renderAll(): void {
    renderQueueTypes();
    renderTickets();
  }

  seedDefaults();
  watchData(renderAll, {
    intervalMs: 2500,
    onPoll: () => { updatedEl.textContent = `Diperbarui ${formatTime()}`; },
  });
})();

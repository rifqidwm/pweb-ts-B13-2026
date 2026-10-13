(() => {
  // Auth guard + role guard: operator hanya untuk admin/moderator.
  const session = requireAuth(STAFF_ROLES);
  if (!session) return;
  mountUserBar(session);

  const grid = byId<HTMLElement>("operator-grid");
  const updatedEl = byId("updated");
  const toast = makeToast(byId("toast"));
  startClock(byId("operator-clock"));

  function run(action: () => string | null): void {
    try {
      const message = action();
      if (message) toast(message);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Aksi gagal.", true);
    }
    render();
  }

  function makeButton(label: string, className: string, onClick: () => string | null, disabled: boolean): HTMLButtonElement {
    const btn = el("button", `btn ${className}`.trim(), label);
    btn.type = "button";
    btn.disabled = disabled;
    btn.addEventListener("click", () => run(onClick));
    return btn;
  }

  function ticketBox(title: string, ticket: Ticket | undefined, current: boolean): HTMLElement {
    const box = el("div", `op-box${current ? " is-current" : ""}`);
    box.append(el("small", "", title));
    box.append(el("p", "op-number", ticket?.label ?? "-"));
    box.append(el("p", "op-meta", ticket ? `Prioritas ${PRIORITY_LABEL[ticket.priority]}` : "Belum ada tiket"));
    return box;
  }

  function buildCard(type: QueueType): HTMLElement {
    const waiting = waitingTickets(type.id);
    const current = currentTicket(type.id);

    const card = el("article", "panel op-card");
    const head = el("div", "card-head");
    const name = el("h2", "card-name", type.name.toUpperCase());
    if (!type.active) name.append(" ", el("span", "badge badge-off", "Nonaktif"));
    head.append(name, el("span", "count-pill", `${waiting.length} menunggu`));

    const pair = el("div", "op-pair");
    pair.append(ticketBox("Sedang dipanggil", current, true), ticketBox("Berikutnya", waiting[0], false));

    const actions = el("div", "op-actions");
    actions.append(
      makeButton("Panggil Berikutnya", "btn-primary", () => {
        const t = callNext(type.id, true);
        return t ? `${t.label} dipanggil.` : "Tidak ada tiket menunggu.";
      }, waiting.length === 0),
      makeButton("Lewati", "btn-danger", () => {
        const t = skipCurrent(type.id);
        return t ? `${t.label} ditandai dilewati.` : null;
      }, !current),
      makeButton("Selesai", "", () => {
        const t = finishCurrent(type.id);
        return t ? `${t.label} selesai.` : null;
      }, !current)
    );

    card.append(head, pair, actions);
    if (waiting.length === 0) card.append(el("p", "op-hint", "Tidak ada tiket menunggu untuk jenis antrian ini."));
    return card;
  }

  function render(): void {
    const types = getTypes();
    if (types.length === 0) {
      grid.replaceChildren(el("p", "empty", "Belum ada jenis antrian. Tambahkan lewat Dashboard Admin."));
      return;
    }
    // Jenis aktif di depan.
    grid.replaceChildren(...[...types].sort((a, b) => Number(b.active) - Number(a.active)).map(buildCard));
  }

  seedDefaults();
  watchData(render, {
    intervalMs: 2500,
    onPoll: () => { updatedEl.textContent = `Diperbarui ${formatTime()}`; },
  });
})();

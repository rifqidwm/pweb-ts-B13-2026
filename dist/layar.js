"use strict";
(() => {
    // Revisi soal: layar.html protected, semua role (user/admin/moderator) wajib login.
    const session = requireAuth(ALL_ROLES);
    if (!session)
        return;
    mountUserBar(session);
    const boardEl = byId("board");
    const spotlightEl = byId("spotlight");
    const spotNumberEl = byId("spot-number");
    const spotServiceEl = byId("spot-service");
    const spotMetaEl = byId("spot-meta");
    const updatedEl = byId("updated");
    const clockEl = byId("clock");
    const soundBtn = byId("btn-sound");
    const fullscreenBtn = byId("btn-fullscreen");
    const lastCalled = new Map();
    let firstRender = true;
    // Pilihan suara disimpan (localStorage) agar tetap menyala setelah pindah halaman / reload.
    let soundOn = isSoundOn();
    // Browser memblokir audio sampai ada interaksi (klik/tombol) di halaman ini.
    let unlocked = navigator.userActivation?.hasBeenActive ?? false;
    function onBlocked() {
        unlocked = false;
        updateSoundBtn();
    }
    function updateSoundBtn() {
        const needsClick = soundOn && !unlocked;
        soundBtn.setAttribute("aria-pressed", String(soundOn && unlocked));
        soundBtn.classList.toggle("is-attention", needsClick);
        soundBtn.textContent = !soundOn
            ? "Nyalakan suara"
            : needsClick ? "Klik untuk aktifkan suara" : "Suara menyala";
    }
    function unlockAudio() {
        if (unlocked)
            return;
        unlocked = true;
        primeAudio(); // membuka izin audio di dalam gesture pengguna
        updateSoundBtn();
    }
    function announce(items) {
        if (!soundOn || items.length === 0)
            return;
        // Beri jeda sebentar lalu lewati tiket yang sudah diumumkan oleh Operator/Dashboard
        // (perangkat yang sama), supaya suaranya tidak dobel.
        window.setTimeout(() => {
            const already = localStorage.getItem(ANNOUNCED_KEY);
            announceTickets(items.map((i) => i.ticket).filter((t) => t.id !== already), onBlocked);
        }, 300);
    }
    function infoLine(label, value, className = "") {
        const line = el("div", `card-line ${className}`.trim());
        line.append(el("span", "card-line-label", label), el("strong", "card-line-value", value));
        return line;
    }
    function buildRow(type, called, waiting, justCalled) {
        const card = el("li", "panel board-card");
        if (called)
            card.classList.add("is-calling");
        if (justCalled)
            card.classList.add("is-flash");
        const head = el("div", "card-head");
        head.append(el("h3", "card-name", type.name.toUpperCase()), el("span", "code-badge", type.code));
        const body = el("div", "card-body");
        if (called) {
            body.append(el("span", "card-status", "Dipanggil"));
            body.append(el("strong", "card-number", called.label));
            if (called.priority !== "normal") {
                body.append(el("span", "card-priority", `Prioritas ${PRIORITY_LABEL[called.priority]}`));
            }
        }
        else {
            body.append(el("p", "card-empty-title", "Belum ada nomor dipanggil"));
            body.append(el("p", "card-empty-sub", "Nomor akan muncul setelah operator memanggil tiket."));
        }
        const foot = el("div", "card-foot");
        const next = waiting[0];
        foot.append(infoLine("Berikutnya dipanggil", next ? `${next.label}${next.priority !== "normal" ? ` · ${PRIORITY_LABEL[next.priority]}` : ""}` : "-", "is-next"));
        foot.append(infoLine("Nomor ambil berikutnya", nextIssueLabel(type.code)));
        foot.append(el("p", "card-waiting", `${waiting.length} tiket menunggu`));
        card.append(head, body, foot);
        return card;
    }
    function renderSpotlight(latest, pulse) {
        if (latest) {
            spotNumberEl.textContent = latest.ticket.label;
            spotServiceEl.textContent = `Silakan menuju ${latest.type.name}`;
            spotMetaEl.textContent =
                latest.ticket.priority === "normal"
                    ? "Panggilan terbaru"
                    : `Panggilan terbaru, prioritas ${PRIORITY_LABEL[latest.ticket.priority]}`;
            spotlightEl.classList.add("has-ticket");
        }
        else {
            spotNumberEl.textContent = "-";
            spotServiceEl.textContent = "Belum ada nomor yang dipanggil";
            spotMetaEl.textContent = "Nomor akan muncul di sini setelah operator memanggil tiket.";
            spotlightEl.classList.remove("has-ticket");
        }
        if (pulse) {
            spotlightEl.classList.remove("is-pulse");
            void spotlightEl.offsetWidth;
            spotlightEl.classList.add("is-pulse");
        }
    }
    function render() {
        const types = getTypes().filter((t) => t.active);
        const tickets = getTickets();
        const rows = [];
        const calledNow = [];
        const newlyCalled = [];
        for (const type of types) {
            const mine = tickets.filter((t) => t.typeId === type.id);
            const called = mine
                .filter((t) => t.status === "called")
                .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0))[0];
            const waiting = mine.filter((t) => t.status === "waiting").sort(compareTickets);
            const justCalled = !firstRender && called !== undefined && lastCalled.get(type.id) !== called.id;
            lastCalled.set(type.id, called ? called.id : null);
            if (called) {
                calledNow.push({ ticket: called, type });
                if (justCalled)
                    newlyCalled.push({ ticket: called, type });
            }
            rows.push(buildRow(type, called, waiting, justCalled));
        }
        if (rows.length === 0) {
            const empty = el("li", "empty", "Belum ada jenis antrian aktif. Admin dapat menambahkannya lewat Dashboard.");
            boardEl.replaceChildren(empty);
        }
        else {
            boardEl.replaceChildren(...rows);
        }
        const byRecent = (a, b) => (b.ticket.calledAt ?? 0) - (a.ticket.calledAt ?? 0);
        renderSpotlight([...calledNow].sort(byRecent)[0], newlyCalled.length > 0);
        announce(newlyCalled.sort((a, b) => byRecent(b, a)));
        firstRender = false;
    }
    soundBtn.addEventListener("click", () => {
        // Suara sudah dipilih tapi masih diblokir: klik ini cukup membuka izin audio, jangan mematikan.
        const turnOn = !soundOn || !unlocked;
        soundOn = turnOn;
        localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
        if (soundOn) {
            unlockAudio();
            playChime();
            window.setTimeout(() => speakText("Suara panggilan aktif.", onBlocked), 800);
        }
        else if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        updateSoundBtn();
    });
    // Interaksi apa pun di halaman (klik, sentuh, tombol keyboard) ikut membuka izin audio.
    // Tombol suara ditangani sendiri di atas agar kliknya tidak terhitung dua kali.
    const onFirstInteraction = (event) => {
        if (event.target instanceof Node && soundBtn.contains(event.target))
            return;
        unlockAudio();
        document.removeEventListener("pointerdown", onFirstInteraction);
        document.removeEventListener("keydown", onFirstInteraction);
    };
    if (!unlocked) {
        document.addEventListener("pointerdown", onFirstInteraction);
        document.addEventListener("keydown", onFirstInteraction);
    }
    // Tombol "Suara" di tab lain ikut tersinkron.
    window.addEventListener("storage", (event) => {
        if (event.key !== SOUND_KEY)
            return;
        soundOn = event.newValue !== "off";
        updateSoundBtn();
    });
    updateSoundBtn();
    mountFullscreenToggle(fullscreenBtn);
    startClock(clockEl);
    seedDefaults();
    watchData(render, {
        intervalMs: 2500,
        onPoll: () => {
            updatedEl.textContent = `Diperbarui ${formatTime()}`;
        },
    });
})();

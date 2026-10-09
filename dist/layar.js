"use strict";
(() => {
    const boardEl = byId("board");
    const spotlightEl = byId("spotlight");
    const spotNumberEl = byId("spot-number");
    const spotServiceEl = byId("spot-service");
    const spotMetaEl = byId("spot-meta");
    const updatedEl = byId("updated");
    const clockEl = byId("clock");
    const soundBtn = byId("btn-sound");
    const fullscreenBtn = byId("btn-fullscreen");
    const DIGIT_WORDS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
    const lastCalled = new Map();
    let firstRender = true;
    let soundOn = false;
    let audioCtx = null;
    function playChime() {
        try {
            if (audioCtx === null)
                audioCtx = new AudioContext();
            const ctx = audioCtx;
            if (ctx.state === "suspended")
                void ctx.resume();
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
        }
        catch (err) {
        }
    }
    function announce(items) {
        if (!soundOn || items.length === 0)
            return;
        playChime();
        if (!("speechSynthesis" in window))
            return;
        window.setTimeout(() => {
            for (const { ticket, type } of items) {
                const digits = String(ticket.number)
                    .padStart(3, "0")
                    .split("")
                    .map((d) => DIGIT_WORDS[Number(d)])
                    .join(" ");
                const utterance = new SpeechSynthesisUtterance(`Nomor antrian ${ticket.code}, ${digits}. Silakan menuju ${type.name}.`);
                utterance.lang = "id-ID";
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }
        }, 800);
    }
    function buildRow(type, called, waiting, justCalled) {
        const row = el("li", "board-row");
        if (called)
            row.classList.add("is-calling");
        if (justCalled)
            row.classList.add("is-flash");
        const code = el("span", "row-code", type.code);
        code.setAttribute("aria-hidden", "true");
        const info = el("div", "row-info");
        info.append(el("h3", "row-name", type.name));
        const meta = el("p", "row-meta");
        meta.append(el("span", "", `${waiting.length} menunggu`));
        if (waiting[0])
            meta.append(el("span", "row-next", `Berikutnya ${waiting[0].label}`));
        info.append(meta);
        const now = el("div", "row-now");
        now.append(el("span", "row-now-label", called ? "Dipanggil" : "Belum ada"));
        now.append(el("strong", "row-number", called ? called.label : "-"));
        row.append(code, info, now);
        return row;
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
            const empty = el("li", "board-empty", "Belum ada jenis antrian aktif. Admin dapat menambahkannya lewat Dashboard.");
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
        soundOn = !soundOn;
        soundBtn.setAttribute("aria-pressed", String(soundOn));
        soundBtn.textContent = soundOn ? "Suara menyala" : "Suara mati";
        if (soundOn)
            playChime(); 
    });
    fullscreenBtn.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            else {
                await document.documentElement.requestFullscreen();
            }
        }
        catch (err) {
        }
    });
    document.addEventListener("fullscreenchange", () => {
        const active = document.fullscreenElement !== null;
        fullscreenBtn.textContent = active ? "Keluar layar penuh" : "Layar penuh";
        fullscreenBtn.setAttribute("aria-pressed", String(active));
        document.body.classList.toggle("is-fullscreen", active);
    });
    function tickClock() {
        clockEl.textContent = formatTime();
    }
    tickClock();
    window.setInterval(tickClock, 1000);
    seedDefaults();
    watchData(render, {
        intervalMs: 2500,
        onPoll: () => {
            updatedEl.textContent = `Diperbarui ${formatTime()}`;
        },
    });
})();

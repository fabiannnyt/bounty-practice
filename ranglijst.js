/* Ranglijst: top 100 per periode */
(() => {
  const { $, $$, esc, nf, head, rest, rpc, isOnline } = window.U;
  const STATS = [["kills", "Kills", 1], ["points", "Punten", 1], ["finals_won", "Finals gewonnen", 1], ["playtime_min", "Speeltijd", 1], ["best_streak", "Killstreak", 0], ["kd", "K/D", 0]];
  const PERIODS = [["week", "Week"], ["maand", "Maand"], ["altijd", "Altijd"]];
  const q = new URLSearchParams(location.search);
  let stat = q.get("stat") || "kills", period = q.get("periode") || "week", rows = [];
  const me = (localStorage.getItem("bp_me") || "").toLowerCase();
  const fmt = (k, v) => k === "kd" ? v.toFixed(2).replace(".", ",") : k === "playtime_min" ? `${nf.format(Math.floor(v / 60))} uur` : nf.format(v);
  const tabs = $("[data-tabs]"), pers = $("[data-periods]");
  tabs.innerHTML = STATS.map(([k, l]) => `<button role="tab" data-stat="${k}">${l}</button>`).join("");
  pers.innerHTML = PERIODS.map(([k, l]) => `<button role="tab" data-period="${k}">${l}</button>`).join("");
  function sync() {
    const per = STATS.find((s) => s[0] === stat)[2];
    if (!per) period = "altijd";
    $$("button", tabs).forEach((b) => b.setAttribute("aria-selected", b.dataset.stat === stat));
    $$("button", pers).forEach((b) => { b.setAttribute("aria-selected", b.dataset.period === period); b.disabled = !per && b.dataset.period !== "altijd"; });
    history.replaceState(null, "", `?stat=${stat}&periode=${period}`);
  }
  async function load() {
    sync();
    try {
      if (stat === "kd" || stat === "best_streak") {
        const ps = await rest("bp_players?select=name,kills,deaths,best_streak&limit=1000");
        rows = ps.filter((p) => stat === "kd" ? p.kills >= 50 : p.best_streak > 0).map((p) => ({ name: p.name, value: stat === "kd" ? (p.deaths ? p.kills / p.deaths : p.kills) : p.best_streak })).sort((a, b) => b.value - a.value).slice(0, 100);
      } else rows = (await rpc("bp_leaderboard", { p_period: period, p_stat: stat, p_limit: 100 })).map((r) => ({ name: r.name, value: Number(r.value) }));
    } catch { rows = []; }
    render();
  }
  function render(focus) {
    $("[data-board]").innerHTML = rows.length ? rows.map((r, i) => `<li data-name="${esc(r.name)}" tabindex="0" class="${r.name.toLowerCase() === me || r.name.toLowerCase() === focus ? "me" : ""}">
      <span class="pos">${i + 1}</span><img src="${head(r.name, 36)}" alt="" width="36" height="36" loading="lazy" decoding="async">
      <span class="nm">${isOnline(r.name) ? '<i class="dot"></i>' : ""}${esc(r.name)}</span><span class="val">${fmt(stat, r.value)}</span></li>`).join("")
      : `<li class="empty">Nog niemand in deze lijst. Speel een potje en sta er als eerste in.</li>`;
    $("[data-board-note]").textContent = stat === "kd" ? "Alleen spelers met minimaal 50 kills." : "";
  }
  // Resetklok voor week/maand
  function reset() {
    const el = $("[data-reset]");
    if (period === "altijd") { el.textContent = ""; return; }
    const n = new Date(), end = new Date(n);
    if (period === "week") { end.setDate(n.getDate() + ((8 - (n.getDay() || 7)) % 7 || 7)); end.setHours(0, 0, 0, 0); }
    else { end.setMonth(n.getMonth() + 1, 1); end.setHours(0, 0, 0, 0); }
    const ms = end - n;
    el.innerHTML = `Deze ${period === "week" ? "week" : "maand"} eindigt over <b>${Math.floor(ms / 864e5)}d ${Math.floor(ms / 36e5) % 24}u</b>. Daarna begint de lijst opnieuw.`;
  }
  tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-stat]"); if (b) { stat = b.dataset.stat; load(); reset(); } });
  pers.addEventListener("click", (e) => { const b = e.target.closest("[data-period]"); if (b && !b.disabled) { period = b.dataset.period; load(); reset(); } });
  $("[data-board]").addEventListener("click", (e) => { const li = e.target.closest("[data-name]"); if (li) location.href = `./#speler/${encodeURIComponent(li.dataset.name)}`; });
  $("[data-board]").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.name) location.href = `./#speler/${encodeURIComponent(e.target.dataset.name)}`; });
  $("[data-find]").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = $("#rl-q").value.trim().toLowerCase();
    const i = rows.findIndex((r) => r.name.toLowerCase() === n);
    if (i < 0) { window.U.toast("Niet gevonden in deze top 100."); return; }
    render(n);
    $$("[data-board] li")[i].scrollIntoView({ block: "center" });
  });
  $("#rl-q").value = localStorage.getItem("bp_me") || "";
  load(); reset(); setInterval(reset, 60000);
})();

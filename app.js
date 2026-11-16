/* Bounty Practice – homepage + profiel */
(() => {
  const { C, $, $$, esc, nf, head, skin, validName, euro, ago, dur, rest, rpc, fn, toast, isOnline } = window.U;

  let players = [];      // alle spelers, gesorteerd op punten
  let ranks = [];
  let shopOpen = true;
  let bounties = [];
  const me = () => localStorage.getItem("bp_me") || "";
  const posOf = (p) => players.indexOf(p) + 1;
  const findP = (n) => players.find((x) => x.name.toLowerCase() === String(n).toLowerCase());
  const dot = (n) => isOnline(n) ? `<i class="dot" title="Nu online"></i>` : "";

  /* ---------------- Routing: home of profielpagina ---------------- */
  {
    const q = new URLSearchParams(location.search);
    if (q.get("speler")) history.replaceState(null, "", location.pathname + `#speler/${encodeURIComponent(q.get("speler"))}${q.get("vs") ? `/vs/${encodeURIComponent(q.get("vs"))}` : ""}`);
    if (q.get("code")) sessionStorage.setItem("bp_code", q.get("code").toUpperCase());
  }
  function route() {
    const m = location.hash.match(/^#speler\/([^/]+)(?:\/vs\/([^/]+))?$/);
    const onProfile = !!m && players.length > 0;
    $("#home").hidden = onProfile;
    $("#profile-view").hidden = !onProfile;
    document.title = m ? `${decodeURIComponent(m[1])} – Bounty Practice` : "Bounty Practice – KitPvP & Finals";
    if (onProfile) { showProfile(decodeURIComponent(m[1]), m[2] && decodeURIComponent(m[2])); scrollTo(0, 0); }
  }
  addEventListener("hashchange", route);
  const goPlayer = (n) => (location.hash = `speler/${encodeURIComponent(n)}`);

  /* ---------------- Spelers ---------------- */
  const SEL = "uuid,name,kills,deaths,best_streak,finals_played,finals_won,points,favorite_kit,last_seen,first_join,playtime_min";
  async function loadPlayers() {
    players = await rest(`bp_players?select=${SEL}&order=points.desc&limit=1000`);
    renderAll();
    route();
  }
  function renderAll() {
    renderPodium(); renderBoard(); renderWelcome(); renderTotals(); renderMeta(); renderChips(); renderRecords();
  }
  setInterval(async () => {
    if (document.hidden || $("#home").hidden) return;
    try { players = await rest(`bp_players?select=${SEL}&order=points.desc&limit=1000`); renderAll(); } catch {}
  }, 60000);
  document.addEventListener("bp:server", () => { renderMeta(); renderBoard(); renderChips(); });

  function renderPodium() {
    const el = $("[data-podium]");
    const top = players.slice(0, 3);
    $(".podium figcaption").hidden = !top.length;
    if (!top.length) {
      el.innerHTML = `<li class="podium-empty"><b>Het podium is nog leeg</b><span>De eerste drie spelers met punten staan hier. Dat kun jij zijn.</span><button type="button" class="btn" data-copy-ip>Kopieer IP en speel</button></li>`;
      return;
    }
    el.innerHTML = top.map((p, i) => `
      <li data-name="${esc(p.name)}" tabindex="0" aria-label="Plek ${i + 1}: ${esc(p.name)}, ${nf.format(p.points)} punten">
        <img class="skin" src="${skin(p.name)}" alt="" loading="${i ? "lazy" : "eager"}" decoding="async">
        <span class="step"><span class="num">${i + 1}</span><span class="name">${dot(p.name)}${esc(p.name)}</span><span class="pts">${nf.format(p.points)} punten</span></span>
      </li>`).join("");
  }

  function renderWelcome() {
    const el = $("[data-welcome]");
    const p = findP(me());
    if (!p) { el.hidden = true; return; }
    const i = posOf(p) - 1;
    el.href = `#speler/${encodeURIComponent(p.name)}`;
    el.innerHTML = `<img src="${head(p.name, 28)}" alt="" width="28" height="28"><span>Welkom terug, <b>${esc(p.name)}</b>. Je staat <b>#${i + 1}</b>${i > 0 ? `, nog ${nf.format(players[i - 1].points - p.points + 1)} punten tot #${i}` : " en iedereen jaagt op jou"}.</span>`;
    el.hidden = false;
  }

  function renderTotals() {
    const sum = (k) => players.reduce((t, p) => t + (p[k] || 0), 0);
    [["kills", "[data-total-kills]"], ["finals_won", "[data-total-wins]"]].forEach(([k, s]) => {
      const n = sum(k);
      $(s).textContent = nf.format(n);
      $(s).closest(".mode-live").hidden = n < 1;
    });
  }

  /* Meta onder de hero: online uit de plugin, anders "vandaag gespeeld" */
  function renderMeta() {
    const s = window.U.getServer();
    const today = players.filter((p) => p.last_seen && Date.now() - new Date(p.last_seen) < 864e5).length;
    $("[data-live-meta]").innerHTML = s ? `<span class="online"><i></i>${nf.format(s.online)} nu online</span> · ` : today >= 3 ? `${nf.format(today)} spelers speelden vandaag · ` : "";
  }

  /* Populaire spelers onder het zoekveld: wie nu online is, anders de top */
  function renderChips() {
    const s = window.U.getServer();
    const list = (s?.online_names?.length ? s.online_names.map(findP).filter(Boolean) : players.slice(0, 5)).slice(0, 6);
    const el = $("[data-chips]");
    el.hidden = !list.length;
    el.innerHTML = `<span>${s?.online_names?.length ? "Nu online:" : "Probeer:"}</span>` + list.map((p) => `<a href="#speler/${encodeURIComponent(p.name)}"><img src="${head(p.name, 20)}" alt="" width="20" height="20">${esc(p.name)}</a>`).join("");
  }

  /* ---------------- Top 10 met periode ---------------- */
  const STATS = [
    { key: "kills", label: "Kills", period: true },
    { key: "points", label: "Punten", period: true },
    { key: "best_streak", label: "Killstreak" },
    { key: "finals_won", label: "Finals gewonnen", period: true },
    { key: "kd", label: "K/D" },
  ];
  const PERIODS = [["altijd", "Altijd"], ["maand", "Maand"], ["week", "Week"]];
  const KD_MIN = 50;
  let stat = "kills", period = "altijd", periodRows = null;
  const statVal = (p, k) => k === "kd" ? (p.deaths ? p.kills / p.deaths : p.kills) : p[k] || 0;
  const statFmt = (k, v) => k === "kd" ? v.toFixed(2).replace(".", ",") : nf.format(v);
  const tabs = $("[data-tabs]"), pers = $("[data-periods]");
  tabs.innerHTML = STATS.map((s) => `<button role="tab" data-stat="${s.key}" aria-selected="${s.key === stat}">${s.label}</button>`).join("");
  pers.innerHTML = PERIODS.map(([k, l]) => `<button role="tab" data-period="${k}" aria-selected="${k === period}">${l}</button>`).join("");
  function syncTabs() {
    const st = STATS.find((s) => s.key === stat);
    if (!st.period && period !== "altijd") period = "altijd";
    $$("button", tabs).forEach((t) => t.setAttribute("aria-selected", t.dataset.stat === stat));
    $$("button", pers).forEach((t) => { t.setAttribute("aria-selected", t.dataset.period === period); t.disabled = !st.period && t.dataset.period !== "altijd"; });
  }
  async function loadPeriod() {
    periodRows = null;
    if (period !== "altijd") {
      try { periodRows = await rpc("bp_leaderboard", { p_period: period, p_stat: stat, p_limit: 200 }); } catch { periodRows = []; }
    }
    renderBoard();
  }
  tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-stat]"); if (b) { stat = b.dataset.stat; syncTabs(); loadPeriod(); } });
  pers.addEventListener("click", (e) => { const b = e.target.closest("[data-period]"); if (b && !b.disabled) { period = b.dataset.period; syncTabs(); loadPeriod(); } });
  // Pijltjestoetsen tussen tabs
  [tabs, pers].forEach((g) => g.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = $$("button:not(:disabled)", g), i = bs.indexOf(document.activeElement);
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length];
    n.focus(); n.click();
  }));
  function renderBoard() {
    const my = me().toLowerCase();
    let all;
    if (period !== "altijd" && periodRows) all = periodRows.map((r) => ({ name: r.name, v: Number(r.value) }));
    else all = players.filter((p) => stat === "kd" ? p.kills >= KD_MIN : statVal(p, stat) > 0)
      .map((p) => ({ name: p.name, v: statVal(p, stat) })).sort((a, b) => b.v - a.v);
    const row = (p, i) => `<li data-name="${esc(p.name)}" tabindex="0" class="${p.name.toLowerCase() === my ? "me" : ""}">
          <span class="pos">${i + 1}</span>
          <img src="${head(p.name, 36)}" alt="" width="36" height="36" loading="lazy" decoding="async">
          <span class="nm">${dot(p.name)}${esc(p.name)}${p.name.toLowerCase() === my ? ` <small>jij</small>` : ""}</span>
          <span class="val">${statFmt(stat, p.v)}</span></li>`;
    let html = all.slice(0, 10).map(row).join("");
    const mi = all.findIndex((p) => p.name.toLowerCase() === my);
    if (mi >= 10) html += `<li class="gap" aria-hidden="true">···</li>${row(all[mi], mi)}`;
    $("[data-board]").innerHTML = html || `<li class="empty">${period === "altijd" ? "Nog geen scores. Speel een potje en claim de eerste plek." : `Deze ${period} heeft nog niemand gescoord. Jij kunt de eerste zijn.`}</li>`;
    $("[data-board-note]").textContent = stat === "kd" ? `Alleen spelers met minimaal ${KD_MIN} kills.` : period === "week" ? "De week begint op maandag." : period === "maand" ? "Telt vanaf de 1e van de maand." : "";
  }
  const board = $("[data-board]");
  board.addEventListener("click", (e) => { const li = e.target.closest("[data-name]"); if (li) goPlayer(li.dataset.name); });
  [board, $("[data-podium]")].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.name) goPlayer(e.target.dataset.name); }));
  $("[data-podium]").addEventListener("click", (e) => { const li = e.target.closest("[data-name]"); if (li) goPlayer(li.dataset.name); });

  /* Speler van de week + serverrecords */
  async function loadPotw() {
    try {
      const [w] = await rpc("bp_leaderboard", { p_period: "week", p_stat: "points", p_limit: 1 });
      if (!w) return;
      const el = $("[data-potw]");
      el.href = `#speler/${encodeURIComponent(w.name)}`;
      el.innerHTML = `<span class="potw-k">Speler van de week</span><img src="${skin(w.name)}" alt="" loading="lazy"><b>${esc(w.name)}</b><span>${nf.format(Number(w.value))} punten sinds maandag</span>`;
      el.hidden = false;
    } catch {}
  }
  function renderRecords() {
    if (!players.length) { $("[data-records]").innerHTML = ""; return; }
    const best = (k) => players.reduce((a, b) => (statVal(b, k) > statVal(a, k) ? b : a));
    const R = [["best_streak", "Langste killstreak", (v) => `${v} op rij`], ["kills", "Meeste kills", nf.format], ["finals_won", "Meeste Finals gewonnen", nf.format], ["playtime_min", "Langst gespeeld", dur]];
    $("[data-records]").innerHTML = `<h3>Serverrecords</h3><ul>` + R.map(([k, l, f]) => {
      const p = best(k);
      return statVal(p, k) ? `<li><a href="#speler/${encodeURIComponent(p.name)}"><img src="${head(p.name, 32)}" alt="" width="32" height="32" loading="lazy"><span><small>${l}</small><b>${f(statVal(p, k))}</b></span><em>${esc(p.name)}</em></a></li>` : "";
    }).join("") + `</ul>`;
  }

  /* ---------------- Live: feed, gezocht, uitdaging ---------------- */
  const FEED = {
    streak: (f) => `<b>${esc(f.actor)}</b> staat op een killstreak van ${esc(f.detail)}`,
    shutdown: (f) => `<b>${esc(f.actor)}</b> stopte de streak van <b>${esc(f.target)}</b> (${esc(f.detail)})`,
    finals: (f) => `<b>${esc(f.actor)}</b> won een Finals-ronde op ${esc(f.detail)}`,
    milestone: (f) => `<b>${esc(f.actor)}</b> haalde ${esc(f.detail)}`,
    rank: (f) => `<b>${esc(f.actor)}</b> heeft nu ${esc(f.detail)}`,
    gift: (f) => `<b>${esc(f.actor)}</b> gaf <b>${esc(f.target)}</b> ${esc(f.detail)} cadeau`,
    join: (f) => `<b>${esc(f.actor)}</b> speelt voor het eerst`,
  };
  async function loadLive() {
    try {
      const [feed, wanted, [ch]] = await Promise.all([
        rest("bp_feed?select=*&order=created_at.desc&limit=6"),
        rest("bp_bounties?select=*&order=reward.desc&limit=5"),
        rest(`bp_challenges?select=*&day=eq.${new Date().toLocaleDateString("sv-SE")}`),
      ]);
      bounties = wanted;
      $("[data-feed]").innerHTML = feed.length ? feed.map((f) => `<li><img src="${head(f.actor, 28)}" alt="" width="28" height="28" loading="lazy"><span>${(FEED[f.type] || FEED.join)(f)}<small>${ago(f.created_at)}</small></span></li>`).join("")
        : `<li class="empty">Nog niks gebeurd. Join en zet de eerste melding neer.</li>`;
      $("[data-wanted]").innerHTML = wanted.length ? wanted.map((b) => `<li><a href="#speler/${encodeURIComponent(b.target)}"><img src="${head(b.target, 40)}" alt="" width="40" height="40"><span><b>${esc(b.target)}</b><small>${b.streak} kills op rij</small></span><em>+${nf.format(b.reward)}</em></a></li>`).join("")
        : `<li class="empty">Niemand gezocht. Haal een streak van 5 en je staat hier.</li>`;
      const cp = $("[data-challenge]");
      if (ch) {
        $("[data-challenge-text]").textContent = ch.text;
        $("[data-challenge-reward]").textContent = `+${nf.format(ch.reward)} punten`;
        const tick = () => { const t = new Date(); t.setHours(24, 0, 0, 0); const ms = t - Date.now(); $("[data-challenge-left]").textContent = `nog ${Math.floor(ms / 36e5)}u ${Math.floor(ms / 6e4) % 60}m`; };
        tick(); clearInterval(cp._t); cp._t = setInterval(tick, 30000);
        cp.hidden = false;
      } else cp.hidden = true;
      $("#live").hidden = !feed.length && !wanted.length && !ch;
    } catch {}
  }
  setInterval(() => !document.hidden && $("#profile-view").hidden && loadLive(), 30000);

  /* ---------------- Kits ---------------- */
  async function loadKits() {
    try {
      const [kits, pk] = await Promise.all([rest("bp_kits?select=*&order=sort"), rest("bp_player_kits?select=kit,kills&limit=10000")]);
      if (!kits.length) return;
      const kills = {};
      pk.forEach((r) => (kills[r.kit] = (kills[r.kit] || 0) + r.kills));
      const fav = {};
      players.forEach((p) => p.favorite_kit && (fav[p.favorite_kit] = (fav[p.favorite_kit] || 0) + 1));
      const favTot = Object.values(fav).reduce((a, b) => a + b, 0) || 1;
      const top = Math.max(...kits.map((k) => kills[k.name] || 0));
      $("[data-kit-grid]").innerHTML = kits.map((k) => `<article class="kit${(kills[k.name] || 0) === top && top ? " hot" : ""}">
        <div class="kit-top"><h4>${esc(k.name)}</h4>${(kills[k.name] || 0) === top && top ? `<span class="kit-badge">Meeste kills</span>` : ""}</div>
        <p>${esc(k.description || "")}</p>
        <ul>${k.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        <div class="kit-stats"><span><b>${nf.format(kills[k.name] || 0)}</b> kills</span><span><b>${Math.round(((fav[k.name] || 0) / favTot) * 100)}%</b> favoriet</span></div>
      </article>`).join("");
      $("[data-kits]").hidden = false;
    } catch {}
  }

  /* ---------------- Finals-uitslagen ---------------- */
  async function loadMatches() {
    try {
      const ms = await rest("bp_finals_matches?select=*&order=ended_at.desc&limit=6");
      if (!ms.length) return;
      $("[data-matches]").innerHTML = ms.map((m) => `<li>
        <div class="m-win">${m.winners.map((w) => `<a href="#speler/${encodeURIComponent(w)}" title="${esc(w)}"><img src="${head(w, 40)}" alt="${esc(w)}" width="40" height="40" loading="lazy"></a>`).join("")}</div>
        <div class="m-info"><b>${m.winners.map(esc).join(" & ")}</b><span>${esc(m.map || "")} · ${esc(m.mode || "")} · ${m.players.length} spelers${m.duration_s ? ` · ${Math.round(m.duration_s / 60)} min` : ""}</span></div>
        <time datetime="${m.ended_at}">${ago(m.ended_at)}</time></li>`).join("");
      $("[data-finals-section]").hidden = false;
    } catch {}
  }

  /* ---------------- Zoeken met suggesties ---------------- */
  const input = $("#q"), sug = $("[data-suggest]");
  let sugIdx = -1, sugList = [], faceT;
  function renderSug() {
    const q = input.value.trim().toLowerCase();
    sugList = q ? players.filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || b.points - a.points).slice(0, 6) : [];
    sugIdx = -1;
    sug.innerHTML = sugList.map((p, i) => `<li role="option" id="sug-${i}" data-name="${esc(p.name)}"><img src="${head(p.name, 28)}" alt="" width="28" height="28"><span>${dot(p.name)}${esc(p.name)}</span><small>#${posOf(p)} · ${nf.format(p.points)} punten</small></li>`).join("");
    sug.hidden = !sugList.length;
    input.setAttribute("aria-expanded", !sug.hidden);
  }
  input.addEventListener("input", () => {
    renderSug();
    clearTimeout(faceT);
    faceT = setTimeout(() => { const n = input.value.trim(); $("[data-search-face]").src = head(validName(n) ? n : "MHF_Steve", 48); }, 300);
  });
  input.addEventListener("keydown", (e) => {
    if (sug.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : -1) + sugList.length) % sugList.length;
      $$("li", sug).forEach((li, i) => li.setAttribute("aria-selected", i === sugIdx));
      input.setAttribute("aria-activedescendant", `sug-${sugIdx}`);
    } else if (e.key === "Enter" && sugIdx >= 0) { e.preventDefault(); sug.hidden = true; goPlayer(sugList[sugIdx].name); }
    else if (e.key === "Escape") sug.hidden = true;
  });
  sug.addEventListener("mousedown", (e) => { const li = e.target.closest("[data-name]"); if (li) { e.preventDefault(); sug.hidden = true; goPlayer(li.dataset.name); } });
  input.addEventListener("blur", () => setTimeout(() => (sug.hidden = true), 100));
  $("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); sug.hidden = true; const n = input.value.trim(); if (n) goPlayer(n); });

  /* ---------------- Profielpagina ---------------- */
  const BADGES = [
    { n: "Eerste bloed", d: "1 kill", k: "kills", v: 1 },
    { n: "Jager", d: "100 kills", k: "kills", v: 100 },
    { n: "Bounty Hunter", d: "500 kills", k: "kills", v: 500 },
    { n: "On fire", d: "Killstreak van 10", k: "best_streak", v: 10 },
    { n: "Onstopbaar", d: "Killstreak van 25", k: "best_streak", v: 25 },
    { n: "Finalist", d: "10 Finals gespeeld", k: "finals_played", v: 10 },
    { n: "Kampioen", d: "Een Finals gewonnen", k: "finals_won", v: 1 },
    { n: "Dynastie", d: "25 Finals gewonnen", k: "finals_won", v: 25 },
  ];
  const rarity = (b) => Math.round((players.filter((p) => p[b.k] >= b.v).length / (players.length || 1)) * 100);

  function targetHtml(p, pos) {
    if (pos === 1) {
      const next = players[1];
      return next ? `<div class="target is-top"><img src="${head(next.name, 44)}" alt="" width="44" height="44"><div><b>Jij bent het doelwit.</b><span>${esc(next.name)} zit ${nf.format(p.points - next.points)} punten achter je.</span></div></div>` : "";
    }
    const t = players[pos - 2];
    const pct = Math.max(4, Math.min(100, Math.round((p.points / (t.points + 1)) * 100)));
    return `<a class="target" href="#speler/${encodeURIComponent(t.name)}"><img src="${head(t.name, 44)}" alt="" width="44" height="44"><div>
      <span class="target-k">Jouw doelwit</span><b>Nog ${nf.format(t.points - p.points + 1)} punten om ${esc(t.name)} in te halen voor #${pos - 1}</b>
      <span class="bar"><i style="width:${pct}%"></i></span></div></a>`;
  }
  function badgesHtml(p) {
    const got = BADGES.filter((b) => p[b.k] >= b.v).length;
    return `<div class="block"><p class="block-h"><b>Mijlpalen</b><span>${got} van ${BADGES.length}</span></p><ul class="badges">${BADGES.map((b) => {
      const ok = p[b.k] >= b.v, pct = Math.min(100, Math.round((p[b.k] / b.v) * 100)), r = rarity(b);
      return `<li class="${ok ? "ok" : ""}"><b>${esc(b.n)}</b><span>${ok ? esc(b.d) : `${nf.format(p[b.k])} / ${nf.format(b.v)}`}</span><small>${r}% van de spelers${r <= 10 && ok ? " · zeldzaam" : ""}</small>${ok ? "" : `<i style="width:${pct}%"></i>`}</li>`;
    }).join("")}</ul></div>`;
  }

  /* Sinds je laatste bezoek (alleen voor je eigen profiel) */
  function sinceHtml(p, pos) {
    if (p.name.toLowerCase() !== me().toLowerCase()) return "";
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem("bp_snap") || "null"); } catch {}
    const now = { name: p.name, kills: p.kills, points: p.points, pos, best_streak: p.best_streak, at: Date.now() };
    if (!prev || prev.name !== p.name) { localStorage.setItem("bp_snap", JSON.stringify(now)); return ""; }
    if (Date.now() - prev.at > 3600e3) localStorage.setItem("bp_snap", JSON.stringify(now));
    const dk = p.kills - prev.kills, dp = p.points - prev.points, dpos = prev.pos - pos;
    if (!dk && !dp && !dpos) return "";
    const parts = [];
    if (dk) parts.push(`<b>+${nf.format(dk)}</b> kills`);
    if (dp) parts.push(`<b>${dp > 0 ? "+" : ""}${nf.format(dp)}</b> punten`);
    if (dpos) parts.push(`<b>${dpos > 0 ? `${dpos} plek${dpos > 1 ? "ken" : ""} gestegen` : `${-dpos} plek${dpos < -1 ? "ken" : ""} gezakt`}</b>`);
    if (p.best_streak > prev.best_streak) parts.push(`<b>nieuw streak-record: ${p.best_streak}</b>`);
    return `<p class="since">Sinds je laatste bezoek (${ago(prev.at)}): ${parts.join(", ")}.</p>`;
  }

  async function showProfile(name, vs) {
    const box = $("[data-profile]");
    const p = findP(name);
    if (!p) {
      box.className = "profile empty";
      box.innerHTML = `<h1>Geen stats voor ${esc(name)}</h1><p>Klopt de spelling? Je stats verschijnen na je eerste potje op de server.</p><a class="btn" href="./#stats">Opnieuw zoeken</a>`;
      return;
    }
    localStorage.setItem("bp_me", p.name);
    box.className = "profile";
    const pos = posOf(p);
    const kd = p.deaths ? (p.kills / p.deaths).toFixed(2).replace(".", ",") : nf.format(p.kills);
    const wr = p.finals_played ? ` · ${Math.round((p.finals_won / p.finals_played) * 100)}%` : "";
    const b = bounties.find((x) => x.target.toLowerCase() === p.name.toLowerCase());
    box.innerHTML = `
      <div class="pf-left">
        <img class="profile-skin" src="${skin(p.name)}" alt="Skin van ${esc(p.name)}">
        ${isOnline(p.name) ? `<span class="pf-online"><i class="dot"></i>Nu online</span>` : ""}
      </div>
      <div class="pf-main">
        <div class="profile-head">
          <h1>${esc(p.name)}<span data-chip></span></h1>
          <div class="pf-actions">
            <button class="share" type="button" data-share>Deel</button>
            <button class="share" type="button" data-card>Stats-kaart</button>
            <a class="share" href="regels.html?melden=${encodeURIComponent(p.name)}#melden" title="Speler melden">Melden</a>
          </div>
        </div>
        <p class="profile-meta">#${pos} van ${nf.format(players.length)} op punten${p.first_join ? ` · speelt sinds ${new Date(p.first_join).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}` : ""}${p.last_seen && !isOnline(p.name) ? ` · laatst online ${ago(p.last_seen)}` : ""}</p>
        ${b ? `<div class="wanted-banner"><b>Gezocht</b> ${b.streak} kills op rij. Wie ${esc(p.name)} stopt, krijgt ${nf.format(b.reward)} punten.</div>` : ""}
        ${sinceHtml(p, pos)}
        <div data-rank-status></div>
        <div class="stats">
          <div class="stat"><b>${nf.format(p.kills)}</b><span>Kills</span></div>
          <div class="stat"><b>${nf.format(p.deaths)}</b><span>Deaths</span></div>
          <div class="stat"><b>${kd}</b><span>K/D</span></div>
          <div class="stat"><b>${nf.format(p.best_streak)}</b><span>Hoogste killstreak</span></div>
          <div class="stat"><b>${nf.format(p.finals_played)}</b><span>Finals gespeeld</span></div>
          <div class="stat"><b>${nf.format(p.finals_won)}</b><span>Finals gewonnen${wr}</span></div>
          <div class="stat hl"><b>${nf.format(p.points)}</b><span>Punten</span></div>
          <div class="stat"><b>${p.playtime_min ? dur(p.playtime_min) : "–"}</b><span>Speeltijd</span></div>
        </div>
        ${targetHtml(p, pos)}
        <div class="pf-grid">
          <div class="block" data-chart><p class="block-h"><b>Punten per dag</b><span>laatste 14 dagen</span></p><div class="chart sk"></div></div>
          <div class="block" data-form hidden><p class="block-h"><b>Laatste Finals</b><span data-form-sum></span></p><ol class="form" data-form-list></ol></div>
        </div>
        <div class="pf-grid">
          <div class="block" data-pkits hidden><p class="block-h"><b>Kills per kit</b><span>favoriet: ${esc(p.favorite_kit || "–")}</span></p><ul class="pkits" data-pkits-list></ul></div>
          <div class="block" data-rivals hidden><p class="block-h"><b>Rivalen</b></p><div class="rivals" data-rivals-list></div></div>
        </div>
        ${badgesHtml(p)}
        <form class="vs-form" data-vs-form>
          <label for="vs-q">Vergelijk 1v1 met</label>
          <input id="vs-q" name="vs" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Minecraft-naam" value="${esc(vs || (pos > 1 ? players[pos - 2].name : players[1]?.name || ""))}">
          <button type="submit">Vergelijk</button>
        </form>
        <div data-vs></div>
      </div>`;
    if (vs) renderVs(p, vs);
    loadRankStatus(p, box);
    loadProfileExtras(p);
  }

  async function loadRankStatus(p, box) {
    try {
      const r = await rpc("bp_active_rank", { p_mc_name: p.name });
      const rk = r?.[0] && ranks.find((x) => x.id === r[0].rank_id);
      if (!rk) return;
      const c = $("[data-chip]", box); c.className = "chip"; c.style.background = rk.color; c.textContent = rk.name;
      const end = new Date(r[0].expires_at), days = Math.max(0, Math.ceil((end - Date.now()) / 864e5));
      $("[data-rank-status]", box).innerHTML = `<div class="rank-status${days <= 7 ? " soon" : ""}" style="--c:${esc(rk.color)}">
        <span><b>${esc(rk.name)} actief</b> tot ${end.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}, nog ${days} ${days === 1 ? "dag" : "dagen"}.${days <= 7 ? " Verleng op tijd, hij loopt niet vanzelf door." : ""}</span>
        ${rk.purchasable && shopOpen ? `<button type="button" data-extend="${esc(rk.id)}">Verlengen</button>` : ""}</div>`;
    } catch {}
  }

  async function loadProfileExtras(p) {
    const since = new Date(Date.now() - 13 * 864e5).toLocaleDateString("sv-SE");
    const [daily, ms, pk, rv] = await Promise.all([
      rest(`bp_stats_daily?select=day,points&uuid=eq.${p.uuid}&day=gte.${since}&order=day`).catch(() => []),
      rest(`bp_finals_matches?select=ended_at,winners,map&players=cs.${encodeURIComponent(`{"${p.name}"}`)}&order=ended_at.desc&limit=10`).catch(() => []),
      rest(`bp_player_kits?select=kit,kills,deaths&uuid=eq.${p.uuid}&order=kills.desc`).catch(() => []),
      rest(`bp_rivals?select=other,kills_on,deaths_by&uuid=eq.${p.uuid}`).catch(() => []),
    ]);
    // Puntengrafiek: 14 balken, ook voor dagen zonder spel
    const byDay = Object.fromEntries(daily.map((d) => [d.day, d.points]));
    const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); const k = d.toLocaleDateString("sv-SE"); return { k, d, v: byDay[k] || 0 }; });
    const max = Math.max(1, ...days.map((d) => d.v));
    const tot = days.reduce((a, d) => a + d.v, 0);
    const ch = $("[data-chart]");
    if (ch) {
      $(".block-h span", ch).textContent = `${nf.format(tot)} in 14 dagen`;
      $(".chart", ch).outerHTML = `<div class="chart" role="img" aria-label="Punten per dag, totaal ${nf.format(tot)} in 14 dagen">${days.map((d) => `<span title="${d.d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}: ${nf.format(d.v)} punten"><i style="height:${Math.max(3, (d.v / max) * 100)}%"></i></span>`).join("")}</div>`;
    }
    // Finals-vorm
    if (ms.length) {
      const wins = ms.filter((m) => m.winners.some((w) => w.toLowerCase() === p.name.toLowerCase())).length;
      $("[data-form-list]").innerHTML = ms.map((m) => { const w = m.winners.some((x) => x.toLowerCase() === p.name.toLowerCase()); return `<li class="${w ? "w" : "l"}" title="${esc(m.map || "")}, ${ago(m.ended_at)}">${w ? "W" : "V"}</li>`; }).join("");
      $("[data-form-sum]").textContent = `${wins} van de ${ms.length} gewonnen`;
      $("[data-form]").hidden = false;
    }
    // Kills per kit
    if (pk.length) {
      const top = Math.max(...pk.map((k) => k.kills));
      $("[data-pkits-list]").innerHTML = pk.map((k) => `<li><span>${esc(k.kit)}</span><span class="trk"><i style="width:${(k.kills / top) * 100}%"></i></span><b>${nf.format(k.kills)}</b></li>`).join("");
      $("[data-pkits]").hidden = false;
    }
    // Rivalen: aartsvijand (doodt jou het vaakst) en prooi (jij doodt hem het vaakst)
    if (rv.length) {
      const nem = rv.reduce((a, b) => (b.deaths_by > a.deaths_by ? b : a));
      const prey = rv.reduce((a, b) => (b.kills_on > a.kills_on ? b : a));
      const card = (r, k, txt) => `<a class="rival" href="#speler/${encodeURIComponent(r.other)}"><img src="${head(r.other, 40)}" alt="" width="40" height="40"><span><small>${k}</small><b>${esc(r.other)}</b><em>${txt}</em></span></a>`;
      $("[data-rivals-list]").innerHTML = (nem.deaths_by ? card(nem, "Aartsvijand", `heeft je ${nem.deaths_by}x gedood`) : "") + (prey.kills_on ? card(prey, "Prooi", `jij doodde hem ${prey.kills_on}x`) : "");
      $("[data-rivals]").hidden = false;
    }
  }

  /* 1v1 */
  const VS = [{ k: "kills", l: "Kills" }, { k: "deaths", l: "Deaths", low: true }, { k: "kd", l: "K/D" }, { k: "best_streak", l: "Hoogste killstreak" }, { k: "finals_won", l: "Finals gewonnen" }, { k: "finals_played", l: "Finals gespeeld" }, { k: "points", l: "Punten" }];
  function renderVs(a, name) {
    const box = $("[data-vs]");
    const b = findP(name);
    if (!b) { box.innerHTML = `<p class="vs-none">Geen stats voor <b>${esc(name)}</b>.</p>`; return; }
    if (b.name === a.name) { box.innerHTML = `<p class="vs-none">Kies iemand anders dan jezelf.</p>`; return; }
    let wa = 0, wb = 0;
    const rows = VS.map((s) => {
      const va = statVal(a, s.k), vb = statVal(b, s.k);
      const aw = s.low ? va < vb : va > vb, bw = s.low ? vb < va : vb > va;
      if (aw) wa++; if (bw) wb++;
      const tot = va + vb || 1;
      return `<div class="vs-row"><b class="${aw ? "win" : ""}">${statFmt(s.k, va)}</b><div class="vs-mid"><span>${s.l}</span><span class="vs-bar"><i class="${aw ? "win" : ""}" style="width:${(va / tot) * 100}%"></i><i class="${bw ? "win" : ""}" style="width:${(vb / tot) * 100}%"></i></span></div><b class="${bw ? "win" : ""}">${statFmt(s.k, vb)}</b></div>`;
    }).join("");
    const verdict = wa === wb ? "Gelijkspel. Tijd voor een echte 1v1." : `${esc(wa > wb ? a.name : b.name)} wint ${Math.max(wa, wb)} van de ${VS.length} stats.`;
    box.innerHTML = `<div class="vs"><div class="vs-heads"><span><img src="${head(a.name, 40)}" alt="" width="40" height="40">${esc(a.name)}</span><em>vs</em><span class="r">${esc(b.name)}<img src="${head(b.name, 40)}" alt="" width="40" height="40"></span></div>${rows}<p class="vs-verdict">${verdict}</p></div>`;
  }
  const curName = () => $("[data-profile] h1")?.firstChild?.textContent;
  $("[data-profile]").addEventListener("submit", (e) => {
    if (!e.target.matches("[data-vs-form]")) return;
    e.preventDefault();
    const other = e.target.elements.vs.value.trim();
    if (other) location.hash = `speler/${encodeURIComponent(curName())}/vs/${encodeURIComponent(other)}`;
  });
  $("[data-profile]").addEventListener("click", async (e) => {
    if (e.target.closest("[data-extend]")) return openBuy(e.target.closest("[data-extend]").dataset.extend, curName());
    if (e.target.closest("[data-card]")) return makeCard(findP(curName()));
    if (!e.target.closest("[data-share]")) return;
    const p = findP(curName());
    const url = `${C.siteUrl}/?speler=${encodeURIComponent(p.name)}`;
    const text = `Ik sta #${posOf(p)} op Bounty Practice met ${nf.format(p.kills)} kills en ${nf.format(p.points)} punten. Kun jij me inhalen?`;
    if (navigator.share) { try { await navigator.share({ title: "Bounty Practice", text, url }); } catch {} return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); } catch {}
    toast("Link gekopieerd. Plak hem in Discord.");
  });

  /* Stats-kaart als afbeelding (1080x1350, voor Instagram/TikTok/Discord) */
  async function makeCard(p) {
    const W = 1080, Hh = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = Hh;
    const x = cv.getContext("2d");
    await document.fonts.ready;
    const g = x.createRadialGradient(W * 0.3, 0, 50, W * 0.3, 0, 900);
    g.addColorStop(0, "#3a1210"); g.addColorStop(1, "#0e0a09");
    x.fillStyle = g; x.fillRect(0, 0, W, Hh);
    const load = (src) => new Promise((res) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const body = await load(skin(p.name));
    if (body) { x.imageSmoothingEnabled = false; const h = 620, w = body.width * (h / body.height); x.drawImage(body, W - w - 90, 170, w, h); }
    x.fillStyle = "#ff3b30"; x.font = "700 64px 'Pixelify Sans'"; x.fillText("BOUNTY PRACTICE", 80, 130);
    x.fillStyle = "#f4ece0"; x.font = "800 96px 'DM Sans'"; x.fillText(p.name, 80, 300);
    x.fillStyle = "#f0b44c"; x.font = "700 48px 'DM Sans'"; x.fillText(`#${posOf(p)} op punten`, 80, 380);
    const kd = p.deaths ? (p.kills / p.deaths).toFixed(2).replace(".", ",") : String(p.kills);
    const S = [["Kills", nf.format(p.kills)], ["K/D", kd], ["Killstreak", nf.format(p.best_streak)], ["Finals gewonnen", nf.format(p.finals_won)], ["Punten", nf.format(p.points)], ["Speeltijd", p.playtime_min ? dur(p.playtime_min) : "–"]];
    S.forEach(([l, v], i) => {
      const cx = 80 + (i % 2) * 460, cy = 860 + Math.floor(i / 2) * 150;
      x.fillStyle = "rgba(244,236,224,.06)"; x.beginPath(); x.roundRect(cx, cy - 92, 440, 130, 20); x.fill();
      x.fillStyle = "#f4ece0"; x.font = "800 58px 'DM Sans'"; x.fillText(v, cx + 28, cy - 18);
      x.fillStyle = "#b3a291"; x.font = "500 30px 'DM Sans'"; x.fillText(l, cx + 28, cy + 22);
    });
    x.fillStyle = "#b3a291"; x.font = "600 32px 'DM Sans'"; x.fillText(`Speel mee: ${C.serverIp}`, 80, Hh - 60);
    try {
      cv.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `bounty-practice-${p.name}.png`; a.click();
        toast("Stats-kaart gedownload.");
      });
    } catch { toast("Downloaden lukt niet in deze browser."); }
  }

  /* ---------------- Ranks + winkel ---------------- */
  const price3 = (c) => Math.round((c * 3 * 0.85) / 10) * 10 - 1;
  async function loadRanks() {
    ranks = await rest("bp_ranks?select=*&order=sort");
    const buyable = ranks.filter((r) => r.purchasable);
    $("[data-ranks]").innerHTML = buyable.map((r) => `
      <article class="rank" style="--c:${esc(r.color)}">
        <span class="tag">[${esc(r.name)}]</span>
        <p class="price">${euro(r.price_cents)}</p>
        <span class="per">per 30 dagen</span>
        <span class="per3">${euro(price3(r.price_cents))} voor 90 dagen <em>-15%</em></span>
        <ul>${r.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <button class="buy" data-buy-id="${esc(r.id)}">Kies ${esc(r.name)}</button>
      </article>`).join("");
    // Vergelijkingstabel: "Alles van X" uitgeschreven
    const own = (r) => r.perks.filter((x) => !/^Alles van /.test(x));
    const cum = []; let acc = [];
    buyable.forEach((r) => { acc = [...acc, ...own(r)]; cum.push(new Set(acc)); });
    const rows = [...new Set(buyable.flatMap(own))];
    $("[data-compare-table]").innerHTML = `<thead><tr><th></th>${buyable.map((r) => `<th style="color:${esc(r.color)}">${esc(r.name)}</th>`).join("")}</tr></thead>
      <tbody><tr><th>Prijs per 30 dagen</th>${buyable.map((r) => `<td><b>${euro(r.price_cents)}</b></td>`).join("")}</tr>
      ${rows.map((perk) => `<tr><th>${esc(perk)}</th>${cum.map((s) => `<td>${s.has(perk) ? `<span class="yes" aria-label="ja"></span>` : `<span class="no" aria-label="nee">–</span>`}</td>`).join("")}</tr>`).join("")}</tbody>`;
    initPreview();
    checkShop();
    loadSupporters();
  }
  async function checkShop() {
    try { shopOpen = !!(await fn("bp-checkout", { ping: true })).ready; } catch { shopOpen = false; }
    $("[data-shop-soon]").hidden = shopOpen;
    $$("[data-buy-id]").forEach((b) => { b.disabled = !shopOpen; if (!shopOpen) b.textContent = "Binnenkort"; });
    if (shopOpen) loadGoal();
  }
  async function loadGoal() {
    try {
      const [g] = await rpc("bp_goal");
      if (!g?.goal_cents) return;
      const pct = Math.min(100, Math.round((g.raised_cents / g.goal_cents) * 100));
      $("[data-goal-label]").textContent = g.label || "Servergoal";
      $("[data-goal-text]").textContent = `${euro(g.raised_cents)} van ${euro(g.goal_cents)} · ${pct}%`;
      $("[data-goal-bar]").style.width = `${Math.max(pct, 1)}%`;
      $("[data-goal]").hidden = false;
    } catch {}
  }
  async function loadSupporters() {
    try {
      const list = await rpc("bp_supporters");
      if (list?.length) {
        const order = Object.fromEntries(ranks.map((r) => [r.id, r.sort]));
        list.sort((a, b) => (order[b.rank_id] ?? 0) - (order[a.rank_id] ?? 0));
        $("[data-supporters-list]").innerHTML = list.map((s) => { const rk = ranks.find((r) => r.id === s.rank_id); return `<li style="--c:${esc(rk?.color || "#888")}"><a href="#speler/${encodeURIComponent(s.mc_name)}"><img src="${head(s.mc_name, 40)}" alt="" width="40" height="40" loading="lazy"><span>${esc(s.mc_name)}</span><small>${esc(rk?.name || "")}</small></a></li>`; }).join("");
        $("[data-supporters]").hidden = false;
      }
    } catch {}
    try {
      const cr = await rpc("bp_creators");
      if (cr?.length) {
        $("[data-creators-list]").innerHTML = cr.map((c) => `<li><a href="${esc(/^https?:\/\//.test(c.channel_url) ? c.channel_url : "#")}" target="_blank" rel="noopener nofollow"><img src="${head(c.mc_name, 48)}" alt="" width="48" height="48" loading="lazy"><span><b>${esc(c.mc_name)}</b><small>${esc(c.platform)}</small></span></a></li>`).join("");
        $("[data-creators]").hidden = false;
      }
    } catch {}
  }

  /* Rank-preview */
  let pvRank = "vip";
  const pvName = $("[data-pv-name]");
  function renderPreview() {
    const r = ranks.find((x) => x.id === pvRank);
    if (!r) return;
    const n = validName(pvName.value.trim()) ? pvName.value.trim() : (me() || "Steve");
    const pfx = `<span class="pfx" style="color:${esc(r.color)}">[${esc(r.name)}]</span>`;
    const msgCol = ["vip", "hunter", "legende"].includes(r.id) ? `style="color:${esc(r.color)}"` : "";
    $("[data-pv-head]").src = head(n, 16);
    $("[data-pv-tab]").innerHTML = `${pfx} ${esc(n)}`;
    $("[data-pv-chat]").innerHTML = `<p><span class="sys">${esc(n)} is de arena in gesprongen</span></p><p>${pfx} ${esc(n)}: <span ${msgCol}>gg, wie durft een 1v1?</span></p><p><span class="sys gold">${esc(n)} heeft een killstreak van 5!</span></p>`;
    $$("button", $("[data-pv-pick]")).forEach((b) => b.setAttribute("aria-checked", b.dataset.id === pvRank));
  }
  function initPreview() {
    pvName.value = me();
    $("[data-pv-pick]").innerHTML = ranks.map((r) => `<button type="button" role="radio" data-id="${esc(r.id)}" style="--c:${esc(r.color)}">${esc(r.name)}</button>`).join("");
    renderPreview();
  }
  $("[data-pv-pick]").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) { pvRank = b.dataset.id; renderPreview(); } });
  pvName.addEventListener("input", renderPreview);
  $("[data-ranks]").addEventListener("mouseover", (e) => { const b = e.target.closest(".rank") && $("[data-buy-id]", e.target.closest(".rank")); if (b && b.dataset.buyId !== pvRank) { pvRank = b.dataset.buyId; renderPreview(); } });

  /* Koopvenster */
  const dlg = $("[data-buy]"), bf = $("[data-buy-form]"), bmsg = $("[data-buy-msg]"), cmsg = $("[data-coupon-msg]");
  let buying = null, months = 1, coupon = null;
  const setMsg = (el, t, cls = "") => { el.textContent = t; el.className = `msg ${cls}`; };
  const total = () => { let c = months === 3 ? price3(buying.price_cents) : buying.price_cents; if (coupon) c = Math.max(100, Math.round(c * (100 - coupon.pct) / 100)); return c; };
  function renderPrice() {
    const base = months === 3 ? price3(buying.price_cents) : buying.price_cents, c = total();
    $("[data-buy-price]").textContent = `${euro(c)} voor ${months * 30} dagen${base !== c ? ` (was ${euro(base)})` : months === 3 ? `, je bespaart ${euro(buying.price_cents * 3 - c)}` : ""}`;
    $("[data-buy-go]").textContent = `Betaal ${euro(c)}`;
  }
  function setTerm(m) { months = m; $$("[data-months]").forEach((b) => b.setAttribute("aria-checked", Number(b.dataset.months) === m)); renderPrice(); }
  $("[data-term-pick]").addEventListener("click", (e) => { const b = e.target.closest("[data-months]"); if (b) setTerm(Number(b.dataset.months)); });
  function setGift(gift) {
    $$("[data-for]", bf).forEach((x) => x.setAttribute("aria-checked", (x.dataset.for === "gift") === gift));
    $("[data-mc-label]").textContent = gift ? "Minecraft-naam van je vriend" : "Jouw Minecraft-naam";
    $("[data-gift-note]").hidden = !gift;
    $("[data-gift-from]").hidden = !gift;
    bf.elements.from.value = gift ? me() : "";
    const mc = bf.elements.mc;
    mc.value = gift ? "" : me();
    mc.dispatchEvent(new Event("input"));
    if (gift) mc.focus();
  }
  $("[data-for-pick]").addEventListener("click", (e) => { const x = e.target.closest("[data-for]"); if (x) setGift(x.dataset.for === "gift"); });
  async function checkCoupon() {
    const code = bf.elements.coupon.value.trim();
    coupon = null;
    if (!code) { setMsg(cmsg, ""); renderPrice(); return; }
    try {
      const [c] = await rpc("bp_check_coupon", { p_code: code });
      if (c) { coupon = { code, pct: c.pct }; setMsg(cmsg, `${c.pct}% korting${c.creator ? `, je steunt ${c.creator}` : ""}.`, "ok"); }
      else setMsg(cmsg, "Deze code werkt niet (meer).", "bad");
    } catch { setMsg(cmsg, "Code checken lukt nu niet.", "bad"); }
    renderPrice();
  }
  $("[data-coupon-check]").addEventListener("click", checkCoupon);
  bf.elements.coupon.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); checkCoupon(); } });
  function openBuy(id, forName) {
    buying = ranks.find((r) => r.id === id);
    if (!buying) return;
    bf.style.setProperty("--c", buying.color);
    $("[data-buy-rank]").textContent = buying.name;
    $("[data-term1]").textContent = euro(buying.price_cents);
    $("[data-term3]").textContent = euro(price3(buying.price_cents));
    setMsg(bmsg, "");
    setGift(false);
    if (forName) bf.elements.mc.value = forName;
    const code = sessionStorage.getItem("bp_code");
    if (code && !bf.elements.coupon.value) { bf.elements.coupon.value = code; checkCoupon(); }
    setTerm(1);
    $("[data-buy-face]").src = head(validName(bf.elements.mc.value) ? bf.elements.mc.value : "MHF_Steve", 36);
    dlg.showModal();
  }
  $("[data-ranks]").addEventListener("click", (e) => { const b = e.target.closest("[data-buy-id]"); if (b && !b.disabled) openBuy(b.dataset.buyId); });
  bf.elements.mc.addEventListener("input", (e) => { const n = e.target.value.trim(); $("[data-buy-face]").src = head(validName(n) ? n : "MHF_Steve", 36); });
  bf.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "pay") return;
    e.preventDefault();
    const mc = bf.elements.mc.value.trim(), from = bf.elements.from.value.trim();
    if (!validName(mc)) return setMsg(bmsg, "Vul de Minecraft-naam in: 3 tot 16 tekens, alleen letters, cijfers en _.", "bad");
    if (from && !validName(from)) return setMsg(bmsg, "Vul bij 'van' een geldige Minecraft-naam in, of laat het leeg.", "bad");
    if (!bf.elements.ok.checked) return setMsg(bmsg, "Ga eerst akkoord met de voorwaarden.", "bad");
    const go = $("[data-buy-go]");
    go.disabled = true; setMsg(bmsg, "Betaling klaarzetten…");
    try {
      const d = await fn("bp-checkout", { mc_name: mc, rank_id: buying.id, months, gift_from: $("[data-gift-from]").hidden ? "" : from, coupon: coupon?.code || "" });
      if (d.checkout_url) { location.href = d.checkout_url; return; }
      setMsg(bmsg, d.error || "Er ging iets mis. Probeer het later opnieuw.", "bad");
    } catch { setMsg(bmsg, "Geen verbinding. Check je internet en probeer het opnieuw.", "bad"); }
    go.disabled = false;
  });

  /* Media-aanvraag */
  const mdlg = $("[data-media-dlg]"), mf = $("[data-media]"), mmsg = $("[data-media-msg]");
  $("[data-open-media]").addEventListener("click", () => { if (!mf.elements.mc_name.value) mf.elements.mc_name.value = me(); setMsg(mmsg, ""); mdlg.showModal(); });
  $("[data-close]", mf).addEventListener("click", () => mdlg.close());
  mf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(mf));
    if (!validName(f.mc_name.trim())) return setMsg(mmsg, "Vul een geldige Minecraft-naam in.", "bad");
    if (!/^https?:\/\/\S+\.\S+/.test(f.channel_url.trim())) return setMsg(mmsg, "Vul de volledige link naar je kanaal in, met https://.", "bad");
    const btn = $(".btn", mf);
    btn.disabled = true; setMsg(mmsg, "Versturen…");
    try {
      await rpc("bp_submit_media_request", { p_mc_name: f.mc_name.trim(), p_platform: f.platform, p_channel_url: f.channel_url.trim(), p_followers: f.followers.trim(), p_discord: f.discord.trim(), p_motivation: f.motivation.trim() });
      mf.reset(); mdlg.close();
      toast("Aanvraag verstuurd. We laten via Discord weten of je de Media-rank krijgt.");
    } catch (err) { setMsg(mmsg, err.message, "bad"); }
    btn.disabled = false;
  });

  /* ---------------- Events, nieuws ---------------- */
  async function loadEvents() {
    try {
      const evs = await rest(`bp_events?select=*&or=(ends_at.gt.${new Date().toISOString()},and(ends_at.is.null,starts_at.gt.${new Date(Date.now() - 3 * 36e5).toISOString()}))&order=starts_at&limit=4`);
      if (!evs.length) return;
      const ev = evs[0], el = $("[data-event]"), start = new Date(ev.starts_at);
      const when = (d) => d.toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const tick = () => {
        const ms = start - Date.now();
        const left = ms <= 0 ? `<b class="live">Nu live</b>` : `nog ${Math.floor(ms / 864e5) ? `${Math.floor(ms / 864e5)}d ` : ""}${Math.floor(ms / 36e5) % 24}u ${Math.floor(ms / 6e4) % 60}m`;
        el.innerHTML = `<span class="event-k">Volgend event</span><b>${esc(ev.title)}</b><span>${when(start)} · ${left}</span><span class="event-cal">Zet in agenda</span>`;
      };
      tick(); setInterval(tick, 30000);
      el.href = ics(ev); el.download = "bounty-practice-event.ics"; el.title = ev.description || ""; el.hidden = false;
      if (evs.length > 1) {
        $("[data-agenda]").innerHTML = evs.map((e) => `<li><time>${when(new Date(e.starts_at))}</time><b>${esc(e.title)}</b><span>${esc(e.description || "")}</span><a href="${ics(e)}" download="bounty-practice-event.ics">Zet in agenda</a></li>`).join("");
        $("[data-agenda-wrap]").hidden = false;
        $("[data-news-section]").hidden = false;
      }
    } catch {}
  }
  function ics(ev) {
    const pad = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const s = new Date(ev.starts_at), e = ev.ends_at ? new Date(ev.ends_at) : new Date(s.getTime() + 2 * 36e5);
    const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bounty Practice//NL", "BEGIN:VEVENT", `UID:${ev.id}@bountypractice`, `DTSTAMP:${pad(new Date())}`, `DTSTART:${pad(s)}`, `DTEND:${pad(e)}`, `SUMMARY:Bounty Practice: ${ev.title}`, `LOCATION:${C.serverIp}`, `DESCRIPTION:${(ev.description || "").replace(/\n/g, " ")} Server-IP: ${C.serverIp}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return URL.createObjectURL(new Blob([txt], { type: "text/calendar" }));
  }
  async function loadNews() {
    try {
      const ns = await rest("bp_news?select=*&order=created_at.desc&limit=3");
      if (!ns.length) return;
      $("[data-news]").innerHTML = ns.map((n) => `<article><time datetime="${n.created_at}">${new Date(n.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}</time><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");
      $("[data-news-section]").hidden = false;
      $(".news-grid").classList.toggle("solo", $("[data-agenda-wrap]").hidden);
    } catch {}
  }

  /* Discord-ledenteller (werkt zodra de echte invite in config.js staat) */
  {
    const code = C.discord.split("/").pop();
    if (code && code !== "PLACEHOLDER") fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`).then((r) => r.json()).then((d) => {
      if (d.approximate_member_count) $("[data-discord-count]").textContent = ` · ${nf.format(d.approximate_member_count)} leden`;
    }).catch(() => {});
  }

  /* ---------------- Start ---------------- */
  syncTabs();
  Promise.all([loadRanks(), loadPlayers()]).then(() => { loadKits(); }).catch(() => {
    $("[data-board]").innerHTML = `<li class="empty">Stats laden lukt nu even niet. Ververs de pagina over een minuut.</li>`;
  });
  loadLive(); loadMatches(); loadPotw(); loadEvents(); loadNews();
})();

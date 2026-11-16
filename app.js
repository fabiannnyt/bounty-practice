/* Bounty Practice – website-logica */
(() => {
  const C = window.BP;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const H = { apikey: C.anonKey, Authorization: `Bearer ${C.anonKey}` };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("nl-NL");
  const head = (n, s = 64) => `https://mc-heads.net/avatar/${encodeURIComponent(n)}/${s}`;
  const skin = (n) => `https://mc-heads.net/body/${encodeURIComponent(n)}/300`;
  const validName = (n) => /^[A-Za-z0-9_]{3,16}$/.test(n);
  const euro = (c) => "€" + (c / 100).toFixed(2).replace(".", ",");

  async function rest(path) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/${path}`, { headers: H });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  async function rpc(fn, args) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || "Er ging iets mis");
    return d;
  }

  /* Toast */
  const toastEl = $("[data-toast]");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  /* IP + Discord */
  $$("[data-ip]").forEach((el) => (el.textContent = C.serverIp));
  $$("[data-discord]").forEach((el) => (el.href = C.discord));
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-copy-ip]")) return;
    try { await navigator.clipboard.writeText(C.serverIp); } catch {}
    const big = $(".ip");
    big.classList.add("copied");
    $("[data-ip-hint]").textContent = "Gekopieerd";
    toast(`${C.serverIp} gekopieerd. Plak het in Minecraft bij Multiplayer.`);
    setTimeout(() => { big.classList.remove("copied"); $("[data-ip-hint]").textContent = "Kopieer IP"; }, 2200);
  });
  fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(C.serverIp)}`).then((r) => r.json()).then((d) => {
    if (!d?.online) return;
    const el = $("[data-online]");
    $("span", el).textContent = `${nf.format(d.players?.online ?? 0)} online`;
    el.hidden = false;
  }).catch(() => {});

  /* Data */
  let players = [];
  let ranks = [];
  const STATS = [
    { key: "kills", label: "Kills" },
    { key: "points", label: "Punten" },
    { key: "best_streak", label: "Killstreak" },
    { key: "finals_won", label: "Finals gewonnen" },
    { key: "kd", label: "K/D" },
    { key: "finals_played", label: "Finals gespeeld" },
  ];
  const KD_MIN = 50;
  const statVal = (p, k) => k === "kd" ? (p.deaths ? p.kills / p.deaths : p.kills) : p[k] || 0;
  const statFmt = (k, v) => k === "kd" ? v.toFixed(2).replace(".", ",") : nf.format(v);
  const goPlayer = (n) => (location.hash = `speler/${encodeURIComponent(n)}`);

  async function loadPlayers() {
    players = await rest("bp_players?select=name,kills,deaths,best_streak,finals_played,finals_won,points,favorite_kit,last_seen&order=points.desc&limit=1000");
    $("#names").innerHTML = players.map((p) => `<option value="${esc(p.name)}">`).join("");
    renderAll();
    route();
  }
  function renderAll() {
    renderPodium();
    renderBoard();
    renderWelcome();
    renderTotals();
    renderToday();
    renderKits();
  }
  function renderTotals() {
    const sum = (k) => players.reduce((t, p) => t + (p[k] || 0), 0);
    [["kills", "[data-total-kills]"], ["finals_won", "[data-total-wins]"]].forEach(([k, s]) => {
      const n = sum(k);
      $(s).textContent = nf.format(n);
      $(s).closest(".mode-live").hidden = n < 1;
    });
  }
  /* Vandaag gespeeld: werkt ook zonder online-check van de server */
  function renderToday() {
    const n = players.filter((p) => p.last_seen && Date.now() - new Date(p.last_seen) < 864e5).length;
    const el = $("[data-today]");
    el.hidden = n < 3;
    el.textContent = `${nf.format(n)} spelers speelden vandaag ·`;
  }
  /* Meest gekozen kits (op basis van favoriete kit) */
  function renderKits() {
    const count = {};
    players.forEach((p) => p.favorite_kit && (count[p.favorite_kit] = (count[p.favorite_kit] || 0) + 1));
    const tot = Object.values(count).reduce((a, b) => a + b, 0);
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const el = $("[data-kits]");
    el.hidden = top.length < 2;
    $("ol", el).innerHTML = top.map(([k, n]) => `<li><span>${esc(k)}</span><span class="trk"><i style="width:${Math.round((n / tot) * 100)}%"></i></span><b>${Math.round((n / tot) * 100)}%</b></li>`).join("");
  }

  /* Podium */
  function renderPodium() {
    const top = players.slice(0, 3);
    const el = $("[data-podium]");
    $(".podium figcaption").hidden = !top.length;
    if (!top.length) {
      el.innerHTML = `<li class="podium-empty"><b>Het podium is nog leeg</b><span>De eerste drie spelers met punten staan hier. Dat kun jij zijn.</span><button type="button" class="btn" data-copy-ip>Kopieer IP en speel</button></li>`;
      return;
    }
    el.innerHTML = top.map((p, i) => `
      <li data-name="${esc(p.name)}" tabindex="0" aria-label="Plek ${i + 1}: ${esc(p.name)}, ${nf.format(p.points)} punten">
        <img class="skin" src="${skin(p.name)}" alt="">
        <span class="step"><span class="num">${i + 1}</span><span class="name">${esc(p.name)}</span><span class="pts">${nf.format(p.points)} punten</span></span>
      </li>`).join("");
  }
  $("[data-podium]").addEventListener("click", (e) => { const li = e.target.closest("[data-name]"); if (li) goPlayer(li.dataset.name); });

  /* Top 10 */
  let stat = "kills";
  const tabs = $("[data-tabs]");
  tabs.innerHTML = STATS.map((s) => `<button role="tab" data-stat="${s.key}" aria-selected="${s.key === stat}">${s.label}</button>`).join("");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-stat]");
    if (!b) return;
    stat = b.dataset.stat;
    $$("button", tabs).forEach((t) => t.setAttribute("aria-selected", t === b));
    renderBoard();
  });
  function renderBoard() {
    const me = (localStorage.getItem("bp_me") || "").toLowerCase();
    const all = players.filter((p) => stat === "kd" ? p.kills >= KD_MIN : statVal(p, stat) > 0)
      .sort((a, b) => statVal(b, stat) - statVal(a, stat));
    const row = (p, i) => `<li data-name="${esc(p.name)}" tabindex="0" class="${p.name.toLowerCase() === me ? "me" : ""}">
          <span class="pos">${i + 1}</span>
          <img src="${head(p.name, 36)}" alt="" width="36" height="36" loading="lazy">
          <span class="nm">${esc(p.name)}${p.name.toLowerCase() === me ? ` <small>jij</small>` : ""}</span>
          <span class="val">${statFmt(stat, statVal(p, stat))}</span></li>`;
    let html = all.slice(0, 10).map(row).join("");
    const mi = all.findIndex((p) => p.name.toLowerCase() === me);
    if (mi >= 10) html += `<li class="gap" aria-hidden="true">···</li>${row(all[mi], mi)}`;
    $("[data-board]").innerHTML = html || `<li class="empty">Nog geen scores. Speel een potje en claim de eerste plek.</li>`;
    $("[data-board-note]").textContent = stat === "kd" ? `Alleen spelers met minimaal ${KD_MIN} kills.` : "";
  }
  const board = $("[data-board]");
  board.addEventListener("click", (e) => { const li = e.target.closest("[data-name]"); if (li) goPlayer(li.dataset.name); });
  [board, $("[data-podium]")].forEach((el) => el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset.name) goPlayer(e.target.dataset.name);
  }));

  /* Zoeken + profiel */
  const input = $("#q");
  let faceT;
  input.addEventListener("input", () => {
    clearTimeout(faceT);
    faceT = setTimeout(() => { const n = input.value.trim(); $("[data-search-face]").src = head(validName(n) ? n : "MHF_Steve", 48); }, 300);
  });
  const sug = $("[data-suggest]");
  let sugIdx = -1, sugList = [];
  function renderSug() {
    const q = input.value.trim().toLowerCase();
    sugList = q ? players.filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || b.points - a.points).slice(0, 6) : [];
    sugIdx = -1;
    sug.innerHTML = sugList.map((p, i) => `<li role="option" id="sug-${i}" data-name="${esc(p.name)}">
      <img src="${head(p.name, 28)}" alt="" width="28" height="28"><span>${esc(p.name)}</span><small>#${players.indexOf(p) + 1} · ${nf.format(p.points)} punten</small></li>`).join("");
    sug.hidden = !sugList.length;
    input.setAttribute("aria-expanded", !sug.hidden);
  }
  input.addEventListener("input", renderSug);
  input.addEventListener("keydown", (e) => {
    if (sug.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : -1) + sugList.length) % sugList.length;
      $$("li", sug).forEach((li, i) => li.setAttribute("aria-selected", i === sugIdx));
      input.setAttribute("aria-activedescendant", `sug-${sugIdx}`);
    } else if (e.key === "Enter" && sugIdx >= 0) {
      e.preventDefault(); sug.hidden = true; goPlayer(sugList[sugIdx].name);
    } else if (e.key === "Escape") sug.hidden = true;
  });
  sug.addEventListener("mousedown", (e) => { const li = e.target.closest("[data-name]"); if (li) { e.preventDefault(); sug.hidden = true; goPlayer(li.dataset.name); } });
  input.addEventListener("blur", () => setTimeout(() => (sug.hidden = true), 100));
  $("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); sug.hidden = true; const n = input.value.trim(); if (n) goPlayer(n); });

  async function showProfile(name, vs) {
    const box = $("[data-profile]");
    input.value = name;
    $("[data-search-face]").src = head(name, 48);
    box.hidden = false;
    const p = players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!p) {
      box.className = "profile empty";
      box.innerHTML = `Geen stats voor <b>${esc(name)}</b>. Klopt de spelling? Je stats verschijnen na je eerste potje op de server.`;
      return;
    }
    localStorage.setItem("bp_me", p.name);
    renderBoard();
    renderWelcome();
    box.className = "profile";
    const kd = p.deaths ? (p.kills / p.deaths).toFixed(2).replace(".", ",") : nf.format(p.kills);
    const wr = p.finals_played ? ` · ${Math.round((p.finals_won / p.finals_played) * 100)}%` : "";
    const pos = players.findIndex((x) => x.name === p.name) + 1;
    box.innerHTML = `
      <img class="profile-skin" src="${skin(p.name)}" alt="Skin van ${esc(p.name)}">
      <div>
        <div class="profile-head">
          <h3>${esc(p.name)}<span data-chip></span></h3>
          <button class="share" type="button" data-share>Deel je stats</button>
        </div>
        <p class="profile-meta">#${pos} van ${nf.format(players.length)} op punten${p.last_seen ? `, laatst online ${new Date(p.last_seen).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}` : ""}</p>
        <div class="stats">
          <div class="stat"><b>${nf.format(p.kills)}</b><span>Kills</span></div>
          <div class="stat"><b>${nf.format(p.deaths)}</b><span>Deaths</span></div>
          <div class="stat"><b>${kd}</b><span>K/D</span></div>
          <div class="stat"><b>${nf.format(p.best_streak)}</b><span>Hoogste killstreak</span></div>
          <div class="stat"><b>${nf.format(p.finals_played)}</b><span>Finals gespeeld</span></div>
          <div class="stat"><b>${nf.format(p.finals_won)}</b><span>Finals gewonnen${wr}</span></div>
          <div class="stat hl"><b>${nf.format(p.points)}</b><span>Punten</span></div>
          <div class="stat"><b>${esc(p.favorite_kit || "–")}</b><span>Favoriete kit</span></div>
        </div>
        ${targetHtml(p, pos)}
        ${badgesHtml(p)}
        <form class="vs-form" data-vs-form>
          <label for="vs-q">Vergelijk 1v1 met</label>
          <input id="vs-q" name="vs" list="names" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Minecraft-naam" value="${esc(vs || (pos > 1 ? players[pos - 2].name : players[1]?.name || ""))}">
          <button type="submit">Vergelijk</button>
        </form>
        <div data-vs></div>
      </div>`;
    if (vs) renderVs(p, vs);
    try {
      const r = await rpc("bp_active_rank", { p_mc_name: p.name });
      const rk = r?.[0] && ranks.find((x) => x.id === r[0].rank_id);
      if (rk) {
        const c = $("[data-chip]", box); c.className = "chip"; c.style.background = rk.color; c.textContent = rk.name;
        const end = new Date(r[0].expires_at);
        const days = Math.max(0, Math.ceil((end - Date.now()) / 864e5));
        const st = document.createElement("div");
        st.className = `rank-status${days <= 7 ? " soon" : ""}`;
        st.style.setProperty("--c", rk.color);
        st.innerHTML = `<span><b>${esc(rk.name)} actief</b> tot ${end.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}, nog ${days} ${days === 1 ? "dag" : "dagen"}.${days <= 7 ? " Verleng op tijd, hij loopt niet vanzelf door." : ""}</span>
          ${rk.purchasable ? `<button type="button" data-extend="${esc(rk.id)}">Verleng 30 dagen</button>` : ""}`;
        $(".stats", box).before(st);
      }
    } catch {}
  }
  /* Doelwit: de speler net boven je op punten. Geeft elke speler een concreet doel. */
  function targetHtml(p, pos) {
    if (pos === 1) {
      const next = players[1];
      if (!next) return "";
      const gap = p.points - next.points;
      return `<div class="target is-top">
        <img src="${head(next.name, 44)}" alt="" width="44" height="44">
        <div><b>Jij bent het doelwit.</b><span>${esc(next.name)} zit ${nf.format(gap)} punten achter je.</span></div>
      </div>`;
    }
    const t = players[pos - 2];
    const gap = t.points - p.points + 1;
    const pct = Math.max(4, Math.min(100, Math.round((p.points / (t.points + 1)) * 100)));
    return `<div class="target" data-name="${esc(t.name)}" tabindex="0" role="link">
      <img src="${head(t.name, 44)}" alt="" width="44" height="44">
      <div>
        <span class="target-k">Jouw doelwit</span>
        <b>Nog ${nf.format(gap)} punten om ${esc(t.name)} in te halen voor #${pos - 1}</b>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </div>
    </div>`;
  }
  $("[data-profile]").addEventListener("click", (e) => { const t = e.target.closest(".target[data-name]"); if (t) goPlayer(t.dataset.name); });

  /* Welkom terug: wie eerder zocht, ziet meteen zijn plek in de hero */
  function renderWelcome() {
    const me = localStorage.getItem("bp_me");
    const el = $("[data-welcome]");
    const i = me ? players.findIndex((x) => x.name.toLowerCase() === me.toLowerCase()) : -1;
    if (i < 0) { el.hidden = true; return; }
    const p = players[i];
    el.href = `#speler/${encodeURIComponent(p.name)}`;
    el.innerHTML = `<img src="${head(p.name, 28)}" alt="" width="28" height="28"><span>Welkom terug, <b>${esc(p.name)}</b>. Je staat <b>#${i + 1}</b>${i > 0 ? `, nog ${nf.format(players[i - 1].points - p.points + 1)} punten tot #${i}` : " en iedereen jaagt op jou"}.</span>`;
    el.hidden = false;
  }

  function route() {
    const m = location.hash.match(/^#speler\/([^/]+)(?:\/vs\/([^/]+))?$/);
    if (m && players.length) {
      showProfile(decodeURIComponent(m[1]), m[2] && decodeURIComponent(m[2]));
      (m[2] ? $("[data-profile]") : $("#stats")).scrollIntoView();
    }
  }

  $("[data-profile]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-extend]");
    if (b) openBuy(b.dataset.extend, $("[data-profile] h3").firstChild.textContent);
  });

  /* 1v1 vergelijken */
  const VS = [
    { k: "kills", l: "Kills" }, { k: "deaths", l: "Deaths", low: true }, { k: "kd", l: "K/D" },
    { k: "best_streak", l: "Hoogste killstreak" }, { k: "finals_won", l: "Finals gewonnen" },
    { k: "finals_played", l: "Finals gespeeld" }, { k: "points", l: "Punten" },
  ];
  const val = (p, k) => k === "kd" ? (p.deaths ? p.kills / p.deaths : p.kills) : p[k];
  const fmt = (k, v) => k === "kd" ? v.toFixed(2).replace(".", ",") : nf.format(v);
  function renderVs(a, name) {
    const box = $("[data-vs]");
    const b = players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!b) { box.innerHTML = `<p class="vs-none">Geen stats voor <b>${esc(name)}</b>.</p>`; return; }
    if (b.name === a.name) { box.innerHTML = `<p class="vs-none">Kies iemand anders dan jezelf.</p>`; return; }
    let wa = 0, wb = 0;
    const rows = VS.map((s) => {
      const va = val(a, s.k), vb = val(b, s.k);
      const aw = s.low ? va < vb : va > vb, bw = s.low ? vb < va : vb > va;
      if (aw) wa++; if (bw) wb++;
      const tot = va + vb || 1;
      return `<div class="vs-row">
        <b class="${aw ? "win" : ""}">${fmt(s.k, va)}</b>
        <div class="vs-mid"><span>${s.l}</span><span class="vs-bar"><i class="${aw ? "win" : ""}" style="width:${(va / tot) * 100}%"></i><i class="${bw ? "win" : ""}" style="width:${(vb / tot) * 100}%"></i></span></div>
        <b class="${bw ? "win" : ""}">${fmt(s.k, vb)}</b></div>`;
    }).join("");
    const verdict = wa === wb ? "Gelijkspel. Tijd voor een echte 1v1." : `${esc(wa > wb ? a.name : b.name)} wint ${Math.max(wa, wb)} van de ${VS.length} stats.`;
    box.innerHTML = `<div class="vs">
      <div class="vs-heads">
        <span><img src="${head(a.name, 40)}" alt="" width="40" height="40">${esc(a.name)}</span>
        <em>vs</em>
        <span class="r">${esc(b.name)}<img src="${head(b.name, 40)}" alt="" width="40" height="40"></span>
      </div>
      ${rows}
      <p class="vs-verdict">${verdict}</p>
    </div>`;
  }
  $("[data-profile]").addEventListener("submit", (e) => {
    if (!e.target.matches("[data-vs-form]")) return;
    e.preventDefault();
    const other = e.target.elements.vs.value.trim();
    const me = $("[data-profile] h3").firstChild.textContent;
    if (other) location.hash = `speler/${encodeURIComponent(me)}/vs/${encodeURIComponent(other)}`;
  });

  /* Delen */
  $("[data-profile]").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-share]")) return;
    const name = $("[data-profile] h3").firstChild.textContent;
    const p = players.find((x) => x.name === name);
    const pos = players.indexOf(p) + 1;
    const url = `${location.origin}${location.pathname}#speler/${encodeURIComponent(name)}`;
    const text = `Ik sta #${pos} op Bounty Practice met ${nf.format(p.kills)} kills en ${nf.format(p.points)} punten. Kun jij me inhalen?`;
    if (navigator.share) { try { await navigator.share({ title: "Bounty Practice", text, url }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(`${text} ${url}`); } catch {}
    toast("Link gekopieerd. Plak hem in Discord.");
  });

  /* Mijlpalen */
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
  function badgesHtml(p) {
    const got = BADGES.filter((b) => p[b.k] >= b.v).length;
    return `<div class="badges">
      <p class="badges-h"><b>Mijlpalen</b><span>${got} van ${BADGES.length}</span></p>
      <ul>${BADGES.map((b) => {
        const ok = p[b.k] >= b.v;
        const pct = Math.min(100, Math.round((p[b.k] / b.v) * 100));
        return `<li class="${ok ? "ok" : ""}" title="${esc(b.d)}">
          <b>${esc(b.n)}</b><span>${ok ? esc(b.d) : `${nf.format(p[b.k])} / ${nf.format(b.v)}`}</span>
          ${ok ? "" : `<i style="width:${pct}%"></i>`}</li>`;
      }).join("")}</ul></div>`;
  }
  addEventListener("hashchange", route);

  /* Ranks */
  async function loadRanks() {
    ranks = await rest("bp_ranks?select=*&order=sort");
    $("[data-ranks]").innerHTML = ranks.filter((r) => r.purchasable).map((r) => `
      <article class="rank" style="--c:${esc(r.color)}">
        <span class="tag">[${esc(r.name)}]</span>
        <p class="price">${euro(r.price_cents)}</p>
        <span class="per">per 30 dagen</span>
        <ul>${r.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <button class="buy" data-buy-id="${esc(r.id)}">Kies ${esc(r.name)}</button>
      </article>`).join("");
    initPreview();
  }

  /* Rank-preview: Minecraft-chat en tab met jouw naam */
  let pvRank = "vip";
  const pvName = $("[data-pv-name]");
  function renderPreview() {
    const r = ranks.find((x) => x.id === pvRank);
    if (!r) return;
    const n = validName(pvName.value.trim()) ? pvName.value.trim() : (localStorage.getItem("bp_me") || "Steve");
    const pfx = `<span class="pfx" style="color:${esc(r.color)}">[${esc(r.name)}]</span>`;
    const msgCol = ["vip", "hunter", "legende"].includes(r.id) ? `style="color:${esc(r.color)}"` : "";
    $("[data-pv-head]").src = head(n, 16);
    $("[data-pv-tab]").innerHTML = `${pfx} ${esc(n)}`;
    $("[data-pv-chat]").innerHTML = `
      <p><span class="sys">${esc(n)} is de arena in gesprongen</span></p>
      <p>${pfx} ${esc(n)}: <span ${msgCol}>gg, wie durft een 1v1?</span></p>
      <p><span class="sys gold">${esc(n)} heeft een killstreak van 5!</span></p>`;
    $$("button", $("[data-pv-pick]")).forEach((b) => b.setAttribute("aria-checked", b.dataset.id === pvRank));
  }
  function initPreview() {
    pvName.value = localStorage.getItem("bp_me") || "";
    $("[data-pv-pick]").innerHTML = ranks.map((r) => `<button type="button" role="radio" data-id="${esc(r.id)}" style="--c:${esc(r.color)}">${esc(r.name)}</button>`).join("");
    renderPreview();
  }
  $("[data-pv-pick]").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) { pvRank = b.dataset.id; renderPreview(); } });
  pvName.addEventListener("input", renderPreview);

  /* Kopen */
  const dlg = $("[data-buy]"), bf = $("[data-buy-form]"), bmsg = $("[data-buy-msg]");
  let buying = null;
  const setMsg = (el, t, cls = "") => { el.textContent = t; el.className = `msg ${cls}`; };
  $("[data-ranks]").addEventListener("mouseover", (e) => {
    const c = e.target.closest(".rank"); const b = c && $("[data-buy-id]", c);
    if (b && b.dataset.buyId !== pvRank) { pvRank = b.dataset.buyId; renderPreview(); }
  });
  $("[data-ranks]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy-id]");
    if (b) openBuy(b.dataset.buyId);
  });
  const mcLabel = $("[data-mc-label]");
  function setGift(gift) {
    $$("[data-for]", bf).forEach((x) => x.setAttribute("aria-checked", (x.dataset.for === "gift") === gift));
    mcLabel.textContent = gift ? "Minecraft-naam van je vriend" : "Jouw Minecraft-naam";
    $("[data-gift-note]").hidden = !gift;
    const mc = bf.elements.mc;
    mc.value = gift ? "" : localStorage.getItem("bp_me") || "";
    mc.dispatchEvent(new Event("input"));
    if (gift) mc.focus();
  }
  $("[data-for-pick]").addEventListener("click", (e) => { const x = e.target.closest("[data-for]"); if (x) setGift(x.dataset.for === "gift"); });
  function openBuy(id, forName) {
    buying = ranks.find((r) => r.id === id);
    if (!buying) return;
    bf.style.setProperty("--c", buying.color);
    $("[data-buy-rank]").textContent = buying.name;
    $("[data-buy-price]").textContent = `${euro(buying.price_cents)} voor 30 dagen`;
    $("[data-buy-go]").textContent = `Betaal ${euro(buying.price_cents)}`;
    setMsg(bmsg, "");
    setGift(false);
    if (forName) bf.elements.mc.value = forName;
    $("[data-buy-face]").src = head(validName(bf.elements.mc.value) ? bf.elements.mc.value : "MHF_Steve", 36);
    dlg.showModal();
  }
  bf.elements.mc.addEventListener("input", (e) => { const n = e.target.value.trim(); $("[data-buy-face]").src = head(validName(n) ? n : "MHF_Steve", 36); });
  bf.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "pay") return;
    e.preventDefault();
    const mc = bf.elements.mc.value.trim();
    if (!validName(mc)) return setMsg(bmsg, "Vul je Minecraft-naam in: 3 tot 16 tekens, alleen letters, cijfers en _.", "bad");
    if (!bf.elements.ok.checked) return setMsg(bmsg, "Ga eerst akkoord met de voorwaarden.", "bad");
    const go = $("[data-buy-go]");
    go.disabled = true; setMsg(bmsg, "Betaling klaarzetten…");
    try {
      const r = await fetch(`${C.supabaseUrl}/functions/v1/bp-checkout`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ mc_name: mc, rank_id: buying.id }) });
      const d = await r.json();
      if (d.checkout_url) { location.href = d.checkout_url; return; }
      setMsg(bmsg, d.error || "Er ging iets mis. Probeer het later opnieuw.", "bad");
    } catch { setMsg(bmsg, "Geen verbinding. Check je internet en probeer het opnieuw.", "bad"); }
    go.disabled = false;
  });

  /* Media-aanvraag */
  const mdlg = $("[data-media-dlg]"), mf = $("[data-media]"), mmsg = $("[data-media-msg]");
  $("[data-open-media]").addEventListener("click", () => {
    if (!mf.elements.mc_name.value) mf.elements.mc_name.value = localStorage.getItem("bp_me") || "";
    setMsg(mmsg, ""); mdlg.showModal();
  });
  $("[data-close]", mf).addEventListener("click", () => mdlg.close());
  mf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(mf));
    if (!validName(f.mc_name.trim())) return setMsg(mmsg, "Vul een geldige Minecraft-naam in.", "bad");
    if (!/^https?:\/\/\S+\.\S+/.test(f.channel_url.trim())) return setMsg(mmsg, "Vul de volledige link naar je kanaal in, met https://.", "bad");
    const btn = $(".btn", mf);
    btn.disabled = true; setMsg(mmsg, "Versturen…");
    try {
      await rpc("bp_submit_media_request", {
        p_mc_name: f.mc_name.trim(), p_platform: f.platform, p_channel_url: f.channel_url.trim(),
        p_followers: f.followers.trim(), p_discord: f.discord.trim(), p_motivation: f.motivation.trim(),
      });
      mf.reset(); mdlg.close();
      toast("Aanvraag verstuurd. We laten via Discord weten of je de Media-rank krijgt.");
    } catch (err) { setMsg(mmsg, err.message, "bad"); }
    btn.disabled = false;
  });

  // Elke minuut nieuwe stats ophalen, zonder dat een open profiel verspringt
  setInterval(async () => {
    if (document.hidden) return;
    try {
      players = await rest("bp_players?select=name,kills,deaths,best_streak,finals_played,finals_won,points,favorite_kit,last_seen&order=points.desc&limit=1000");
      renderAll();
    } catch {}
  }, 60000);

  /* Tabbalk: laat zien in welke sectie je bent */
  const tabLinks = $$(".tabbar a");
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) tabLinks.forEach((l) => l.classList.toggle("on", l.getAttribute("href") === `#${en.target.id}`));
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["spelen", "stats", "top10", "ranks"].forEach((id) => io.observe(document.getElementById(id)));

  Promise.all([loadRanks(), loadPlayers()]).catch(() => {
    $("[data-board]").innerHTML = `<li class="empty">Stats laden lukt nu even niet. Ververs de pagina over een minuut.</li>`;
  });
})();

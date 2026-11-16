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
  $$("[data-copy-ip]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(C.serverIp); } catch {}
    const big = $(".ip");
    big.classList.add("copied");
    $("[data-ip-hint]").textContent = "Gekopieerd";
    toast(`${C.serverIp} gekopieerd. Plak het in Minecraft bij Multiplayer.`);
    setTimeout(() => { big.classList.remove("copied"); $("[data-ip-hint]").textContent = "Kopieer IP"; }, 2200);
  }));
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
    { key: "finals_played", label: "Finals gespeeld" },
    { key: "deaths", label: "Deaths" },
  ];
  const goPlayer = (n) => (location.hash = `speler/${encodeURIComponent(n)}`);

  async function loadPlayers() {
    players = await rest("bp_players?select=name,kills,deaths,best_streak,finals_played,finals_won,points,favorite_kit,last_seen&order=points.desc&limit=1000");
    $("#names").innerHTML = players.map((p) => `<option value="${esc(p.name)}">`).join("");
    renderPodium();
    renderBoard();
    renderWelcome();
    const sum = (k) => players.reduce((t, p) => t + (p[k] || 0), 0);
    $("[data-total-kills]").textContent = nf.format(sum("kills"));
    $("[data-total-wins]").textContent = nf.format(sum("finals_won"));
    route();
  }

  /* Podium */
  function renderPodium() {
    const top = players.slice(0, 3);
    const el = $("[data-podium]");
    if (!top.length) { $(".podium").hidden = true; return; }
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
    const list = [...players].filter((p) => p[stat] > 0).sort((a, b) => b[stat] - a[stat]).slice(0, 10);
    $("[data-board]").innerHTML = list.length
      ? list.map((p, i) => `<li data-name="${esc(p.name)}" tabindex="0" class="${p.name.toLowerCase() === me ? "me" : ""}">
          <span class="pos">${i + 1}</span>
          <img src="${head(p.name, 36)}" alt="" width="36" height="36" loading="lazy">
          <span class="nm">${esc(p.name)}</span>
          <span class="val">${nf.format(p[stat])}</span></li>`).join("")
      : `<li class="empty">Nog geen scores. Speel een potje en claim de eerste plek.</li>`;
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
  $("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); const n = input.value.trim(); if (n) goPlayer(n); });

  async function showProfile(name) {
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
        <h3>${esc(p.name)}<span data-chip></span></h3>
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
      </div>`;
    try {
      const r = await rpc("bp_active_rank", { p_mc_name: p.name });
      const rk = r?.[0] && ranks.find((x) => x.id === r[0].rank_id);
      if (rk) { const c = $("[data-chip]", box); c.className = "chip"; c.style.background = rk.color; c.textContent = rk.name; }
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
    const m = location.hash.match(/^#speler\/(.+)$/);
    if (m && players.length) { showProfile(decodeURIComponent(m[1])); $("#stats").scrollIntoView(); }
  }
  addEventListener("hashchange", route);

  /* Ranks */
  async function loadRanks() {
    ranks = await rest("bp_ranks?select=*&order=sort");
    $("[data-ranks]").innerHTML = ranks.filter((r) => r.purchasable).map((r) => `
      <article class="rank ${r.id === "vip" ? "pop" : ""}" style="--c:${esc(r.color)}">
        ${r.id === "vip" ? `<span class="badge">Populair</span>` : ""}
        <span class="tag">[${esc(r.name)}]</span>
        <p class="price">${euro(r.price_cents)}</p>
        <span class="per">per 30 dagen</span>
        <ul>${r.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <button class="buy" data-buy-id="${esc(r.id)}">Kies ${esc(r.name)}</button>
      </article>`).join("");
  }

  /* Kopen */
  const dlg = $("[data-buy]"), bf = $("[data-buy-form]"), bmsg = $("[data-buy-msg]");
  let buying = null;
  const setMsg = (el, t, cls = "") => { el.textContent = t; el.className = `msg ${cls}`; };
  $("[data-ranks]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy-id]");
    if (!b) return;
    buying = ranks.find((r) => r.id === b.dataset.buyId);
    bf.style.setProperty("--c", buying.color);
    $("[data-buy-rank]").textContent = buying.name;
    $("[data-buy-price]").textContent = `${euro(buying.price_cents)} voor 30 dagen`;
    $("[data-buy-go]").textContent = `Betaal ${euro(buying.price_cents)}`;
    setMsg(bmsg, "");
    const mc = bf.elements.mc;
    if (!mc.value) mc.value = localStorage.getItem("bp_me") || "";
    $("[data-buy-face]").src = head(validName(mc.value) ? mc.value : "MHF_Steve", 36);
    dlg.showModal();
  });
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

  Promise.all([loadRanks(), loadPlayers()]).catch(() => {
    $("[data-board]").innerHTML = `<li class="empty">Stats laden lukt nu even niet. Ververs de pagina over een minuut.</li>`;
  });
})();

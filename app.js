/* Bounty Practice – website-logica (geen frameworks nodig) */
(() => {
  const C = window.BP;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const H = { apikey: C.anonKey, Authorization: `Bearer ${C.anonKey}` };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("nl-NL");
  const head = (name, size = 64) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
  const body = (name) => `https://mc-heads.net/body/${encodeURIComponent(name)}/240`;
  const validName = (n) => /^[A-Za-z0-9_]{3,16}$/.test(n);

  async function rest(path) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/${path}`, { headers: H });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  async function rpc(fn, args) {
    const r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.message || "Er ging iets mis");
    return data;
  }

  /* ---------- IP, Discord, online-status ---------- */
  $$("[data-ip]").forEach((el) => (el.textContent = C.serverIp));
  $$("[data-discord]").forEach((el) => (el.href = C.discord));
  const ipBtn = $("[data-copy-ip]");
  ipBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(C.serverIp); } catch {}
    ipBtn.classList.add("copied");
    $("[data-ip-hint]").textContent = "Gekopieerd, tot in de arena!";
    setTimeout(() => { ipBtn.classList.remove("copied"); $("[data-ip-hint]").textContent = "Klik om te kopiëren"; }, 2200);
  });
  // Online-spelers via mcsrvstat (werkt zodra het echte IP erin staat)
  fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(C.serverIp)}`).then((r) => r.json()).then((d) => {
    if (!d?.online) return;
    const el = $("[data-online]");
    $("span", el).textContent = `${nf.format(d.players?.online ?? 0)} spelers online`;
    el.hidden = false;
  }).catch(() => {});

  /* ---------- Spelers laden ---------- */
  let players = [];
  const STATS = [
    { key: "kills", label: "Kills" },
    { key: "points", label: "Punten" },
    { key: "best_streak", label: "Hoogste killstreak" },
    { key: "finals_won", label: "Finals gewonnen" },
    { key: "finals_played", label: "Finals gespeeld" },
    { key: "deaths", label: "Deaths" },
  ];

  async function loadPlayers() {
    players = await rest("bp_players?select=name,kills,deaths,best_streak,finals_played,finals_won,points,favorite_kit,last_seen,first_join&order=points.desc&limit=1000");
    $("#names").innerHTML = players.map((p) => `<option value="${esc(p.name)}">`).join("");
    const top = players[0];
    if (top) {
      $("[data-poster-face]").src = head(top.name, 160);
      $("[data-poster-name]").textContent = top.name;
      $("[data-poster-points]").textContent = nf.format(top.points);
      $("[data-poster]").href = `#speler/${encodeURIComponent(top.name)}`;
    } else {
      $("[data-poster-name]").textContent = "Nog niemand";
      $("[data-poster-face]").src = head("MHF_Question", 160);
    }
    renderBoard(currentStat);
    route();
  }

  /* ---------- Top 10 ---------- */
  let currentStat = "kills";
  const tabs = $("[data-tabs]");
  tabs.innerHTML = STATS.map((s) => `<button class="tab" role="tab" data-stat="${s.key}" aria-selected="${s.key === currentStat}">${s.label}</button>`).join("");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-stat]");
    if (!b) return;
    currentStat = b.dataset.stat;
    $$(".tab", tabs).forEach((t) => t.setAttribute("aria-selected", t === b));
    renderBoard(currentStat);
  });

  function renderBoard(key) {
    const list = [...players].filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 10);
    $("[data-board]").innerHTML = list.length
      ? list.map((p, i) => `<li data-name="${esc(p.name)}" tabindex="0">
          <span class="pos">${i + 1}</span>
          <img src="${head(p.name, 40)}" alt="" width="40" height="40" loading="lazy">
          <span class="nm">${esc(p.name)}</span>
          <span class="val">${nf.format(p[key])}</span>
        </li>`).join("")
      : `<li class="empty">Nog geen scores. Speel een potje en claim de eerste plek.</li>`;
  }
  $("[data-board]").addEventListener("click", (e) => {
    const li = e.target.closest("[data-name]");
    if (li) location.hash = `speler/${encodeURIComponent(li.dataset.name)}`;
  });
  $("[data-board]").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset.name) location.hash = `speler/${encodeURIComponent(e.target.dataset.name)}`;
  });

  /* ---------- Speler zoeken + profiel ---------- */
  const form = $("[data-search]");
  const input = $("#q");
  let faceTimer;
  input.addEventListener("input", () => {
    clearTimeout(faceTimer);
    faceTimer = setTimeout(() => {
      const n = input.value.trim();
      $("[data-search-face]").src = validName(n) ? head(n, 48) : head("MHF_Steve", 48);
    }, 300);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = input.value.trim();
    if (n) location.hash = `speler/${encodeURIComponent(n)}`;
  });

  async function showProfile(name) {
    const box = $("[data-profile]");
    input.value = name;
    $("[data-search-face]").src = head(name, 48);
    const p = players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    box.hidden = false;
    if (!p) {
      box.innerHTML = `<p class="notfound">Geen stats gevonden voor <b>${esc(name)}</b>. Check de spelling, of join de server: je stats verschijnen na je eerste potje.</p>`;
      box.style.display = "block";
      return;
    }
    box.style.display = "";
    const kd = p.deaths ? (p.kills / p.deaths).toFixed(2).replace(".", ",") : nf.format(p.kills);
    const winrate = p.finals_played ? Math.round((p.finals_won / p.finals_played) * 100) + "%" : "–";
    const rankPos = players.findIndex((x) => x.name === p.name) + 1;
    box.innerHTML = `
      <img class="profile-body" src="${body(p.name)}" alt="Skin van ${esc(p.name)}" width="120">
      <div>
        <h3>${esc(p.name)}<span data-rank-tag></span></h3>
        <p class="profile-meta">#${rankPos} op punten${p.last_seen ? ` · laatst online ${new Date(p.last_seen).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}` : ""}</p>
        <div class="stat-grid">
          <div class="stat"><b>${nf.format(p.kills)}</b><span>Kills</span></div>
          <div class="stat"><b>${nf.format(p.deaths)}</b><span>Deaths</span></div>
          <div class="stat"><b>${kd}</b><span>K/D</span></div>
          <div class="stat"><b>${nf.format(p.best_streak)}</b><span>Hoogste killstreak</span></div>
          <div class="stat"><b>${nf.format(p.finals_played)}</b><span>Finals gespeeld</span></div>
          <div class="stat"><b>${nf.format(p.finals_won)}</b><span>Finals gewonnen (${winrate})</span></div>
          <div class="stat hl"><b>${nf.format(p.points)}</b><span>Punten</span></div>
          <div class="stat"><b>${esc(p.favorite_kit || "–")}</b><span>Favoriete kit</span></div>
        </div>
      </div>`;
    // Actieve rank erbij zetten
    try {
      const r = await rpc("bp_active_rank", { p_mc_name: p.name });
      const rank = r?.[0] && ranks.find((x) => x.id === r[0].rank_id);
      if (rank) {
        const t = $("[data-rank-tag]", box);
        t.className = "rank-tag";
        t.style.background = rank.color;
        t.textContent = rank.name;
      }
    } catch {}
  }

  function route() {
    const m = location.hash.match(/^#speler\/(.+)$/);
    if (m && players.length) {
      showProfile(decodeURIComponent(m[1]));
      $("#stats").scrollIntoView();
    }
  }
  addEventListener("hashchange", route);

  /* ---------- Ranks ---------- */
  let ranks = [];
  const euro = (c) => "€" + (c / 100).toFixed(2).replace(".", ",");
  async function loadRanks() {
    ranks = await rest("bp_ranks?select=*&order=sort");
    $("[data-ranks]").innerHTML = ranks.map((r) => `
      <article class="rank ${r.purchasable ? "" : "free"}" style="--c:${esc(r.color)}">
        <h3>${esc(r.name)}</h3>
        <p class="price">${r.purchasable ? `<b>${euro(r.price_cents)}</b> <small>per 30 dagen</small>` : `<b>Gratis</b> <small>op aanvraag</small>`}</p>
        <ul>${r.perks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        ${r.purchasable
          ? `<button class="btn btn-red" data-buy-id="${esc(r.id)}">Koop ${esc(r.name)}</button>`
          : `<a class="btn" href="#media">Aanvragen</a>`}
      </article>`).join("");
  }

  /* ---------- Kopen ---------- */
  const dlg = $("[data-buy]");
  const buyForm = $("[data-buy-form]");
  const buyMsg = $("[data-buy-msg]");
  let buying = null;
  $("[data-ranks]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy-id]");
    if (!b) return;
    buying = ranks.find((r) => r.id === b.dataset.buyId);
    buyForm.style.setProperty("--c", buying.color);
    $("[data-buy-rank]").textContent = buying.name;
    $("[data-buy-price]").textContent = `${euro(buying.price_cents)} voor 30 dagen`;
    $("[data-buy-go]").textContent = `Betaal ${euro(buying.price_cents)}`;
    buyMsg.textContent = ""; buyMsg.className = "form-msg";
    const mc = buyForm.elements.mc;
    if (!mc.value && validName(input.value.trim())) mc.value = input.value.trim();
    $("[data-buy-face]").src = head(validName(mc.value) ? mc.value : "MHF_Steve", 64);
    dlg.showModal();
  });
  buyForm.elements.mc.addEventListener("input", (e) => {
    const n = e.target.value.trim();
    $("[data-buy-face]").src = head(validName(n) ? n : "MHF_Steve", 64);
  });
  buyForm.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "pay") return;
    e.preventDefault();
    const mc = buyForm.elements.mc.value.trim();
    if (!validName(mc)) { buyMsg.textContent = "Vul je Minecraft-naam in (3 tot 16 tekens, alleen letters, cijfers en _)."; buyMsg.className = "form-msg bad"; return; }
    if (!buyForm.elements.ok.checked) { buyMsg.textContent = "Ga eerst akkoord met de voorwaarden."; buyMsg.className = "form-msg bad"; return; }
    const go = $("[data-buy-go]");
    go.disabled = true; buyMsg.textContent = "Betaling klaarzetten…"; buyMsg.className = "form-msg";
    try {
      const r = await fetch(`${C.supabaseUrl}/functions/v1/bp-checkout`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ mc_name: mc, rank_id: buying.id }) });
      const d = await r.json();
      if (d.checkout_url) { location.href = d.checkout_url; return; }
      buyMsg.textContent = d.error || "Er ging iets mis. Probeer het later opnieuw.";
      buyMsg.className = "form-msg bad";
    } catch {
      buyMsg.textContent = "Geen verbinding. Check je internet en probeer het opnieuw.";
      buyMsg.className = "form-msg bad";
    }
    go.disabled = false;
  });

  /* ---------- Media-aanvraag ---------- */
  const media = $("[data-media]");
  const mediaMsg = $("[data-media-msg]");
  media.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(media));
    if (!validName(f.mc_name.trim())) { mediaMsg.textContent = "Vul een geldige Minecraft-naam in."; mediaMsg.className = "form-msg bad"; return; }
    if (!/^https?:\/\/\S+\.\S+/.test(f.channel_url.trim())) { mediaMsg.textContent = "Vul de volledige link naar je kanaal in, met https://."; mediaMsg.className = "form-msg bad"; return; }
    const btn = $("button", media);
    btn.disabled = true; mediaMsg.textContent = "Versturen…"; mediaMsg.className = "form-msg";
    try {
      await rpc("bp_submit_media_request", {
        p_mc_name: f.mc_name.trim(), p_platform: f.platform, p_channel_url: f.channel_url.trim(),
        p_followers: f.followers.trim(), p_discord: f.discord.trim(), p_motivation: f.motivation.trim(),
      });
      media.reset();
      mediaMsg.textContent = "Aanvraag verstuurd. Het team laat via Discord weten of je de Media-rank krijgt.";
      mediaMsg.className = "form-msg ok";
    } catch (err) {
      mediaMsg.textContent = err.message;
      mediaMsg.className = "form-msg bad";
    }
    btn.disabled = false;
  });

  /* ---------- Start ---------- */
  Promise.all([loadRanks(), loadPlayers()]).catch(() => {
    $("[data-board]").innerHTML = `<li class="empty">Stats laden lukt nu even niet. Ververs de pagina over een minuut.</li>`;
  });
})();

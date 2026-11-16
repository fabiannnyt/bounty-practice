/* Gedeeld door alle pagina's: data-helpers, menu, tabbalk, IP kopiëren, meldingen */
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
  const ago = (d) => {
    const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
    if (s < 60) return "net";
    if (s < 3600) return `${Math.floor(s / 60)} min geleden`;
    if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`;
    const days = Math.floor(s / 86400);
    return days === 1 ? "gisteren" : `${days} dagen geleden`;
  };
  const dur = (min) => min < 60 ? `${min} min` : `${nf.format(Math.floor(min / 60))} uur`;
  const profileUrl = (n) => `./#speler/${encodeURIComponent(n)}`;
  const page = document.body.dataset.page || "home";

  /* Offline-melding: één keer tonen als de database niet bereikbaar is */
  let offlineShown = false;
  function offline() {
    if (offlineShown) return;
    offlineShown = true;
    const b = document.createElement("div");
    b.className = "offline";
    b.setAttribute("role", "status");
    b.innerHTML = `Stats laden lukt nu even niet. De rest van de site werkt gewoon. <button type="button">Opnieuw</button>`;
    $("button", b).onclick = () => location.reload();
    document.body.prepend(b);
  }
  async function rest(path) {
    let r;
    try { r = await fetch(`${C.supabaseUrl}/rest/v1/${path}`, { headers: H }); }
    catch (e) { offline(); throw e; }
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  async function rpc(fn, args = {}) {
    let r;
    try { r = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(args) }); }
    catch (e) { offline(); throw e; }
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || "Er ging iets mis");
    return d;
  }
  async function fn(name, body, extra = {}) {
    const r = await fetch(`${C.supabaseUrl}/functions/v1/${name}`, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...d };
  }

  /* Menu bovenin + tabbalk onderin (mobiel) – één keer gedefinieerd voor alle pagina's */
  const LINKS = [
    ["home", "./", "Spelen", '<path d="M7 4l12 8-12 8z" class="f"/>'],
    ["ranglijst", "ranglijst.html", "Ranglijst", '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>'],
    ["ranks", "./#ranks", "Ranks", '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" class="f"/>'],
    ["stemmen", "stemmen.html", "Stemmen", '<path d="M5 12l5 5L20 7"/>'],
    ["regels", "regels.html", "Regels", '<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>'],
  ];
  const nav = $(".nav");
  if (nav) {
    nav.innerHTML = `
      <a class="nav-brand" href="./" aria-label="Bounty Practice, home">
        <span class="wordmark"><span class="ls">Bounty</span><span class="lf">Bounty</span></span><span class="nav-sub">Practice</span>
      </a>
      <nav class="nav-links" aria-label="Hoofdmenu">
        ${LINKS.map(([id, href, label]) => `<a href="${href}"${id === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
      </nav>
      <span class="nav-online" data-nav-online hidden><i></i><b></b> online</span>
      <a class="nav-discord" data-discord href="#" target="_blank" rel="noopener" aria-label="Discord">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.7 3a19.6 19.6 0 0 0-4.9 1.5C.7 9.1-.2 13.6.3 18a19.8 19.8 0 0 0 6 3l1.3-2.1a12.8 12.8 0 0 1-2-1l.5-.4a14 14 0 0 0 12 0l.5.4-2 1 1.3 2.1a19.7 19.7 0 0 0 6-3c.6-5.1-.9-9.6-3.6-13.6ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>
      </a>
      <button class="nav-play" type="button" data-copy-ip>Speel nu</button>`;
    const tb = document.createElement("nav");
    tb.className = "tabbar";
    tb.setAttribute("aria-label", "Snel naar");
    tb.innerHTML = LINKS.slice(0, 4).map(([id, href, label, icon]) =>
      `<a href="${href}"${id === page ? ' class="on" aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${label}</a>`).join("");
    document.body.append(tb);
  }

  /* Footer */
  const foot = $(".foot");
  if (foot) foot.innerHTML = `
    <div class="foot-brand"><span class="wordmark"><span class="ls">Bounty</span><span class="lf">Bounty</span></span>
      <p>KitPvP en Finals van de Bounty SMP. Niet verbonden aan Mojang of Microsoft.</p></div>
    <div class="foot-cols">
      <div><b>Spelen</b><a href="./#spelen">Modi en kits</a><a href="ranglijst.html">Ranglijst</a><a href="./#finals">Finals-uitslagen</a><a href="stemmen.html">Stemmen</a></div>
      <div><b>Winkel</b><a href="./#ranks">Ranks</a><a href="./#faq">Vragen</a><a href="voorwaarden.html">Voorwaarden</a></div>
      <div><b>Community</b><a data-discord href="#" target="_blank" rel="noopener">Discord</a><a href="regels.html">Regels</a><a href="regels.html#melden">Speler melden</a><a href="regels.html#team">Team</a></div>
    </div>`;

  /* Toast */
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  document.body.append(toastEl);
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* IP + Discord overal invullen, IP kopiëren met één klik */
  $$("[data-ip]").forEach((el) => (el.textContent = C.serverIp));
  $$("[data-discord]").forEach((el) => (el.href = C.discord));
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy-ip]");
    if (!b) return;
    try { await navigator.clipboard.writeText(C.serverIp); } catch {}
    const hint = $(".ip-action", b);
    if (hint) { hint.textContent = "Gekopieerd"; b.classList.add("copied"); setTimeout(() => { hint.textContent = "Kopieer IP"; b.classList.remove("copied"); }, 2200); }
    toast(`${C.serverIp} gekopieerd. Plak het in Minecraft bij Multiplayer.`);
  });

  /* Live serverstatus uit de plugin (bp_server). Ouder dan 2 minuten = niet tonen. */
  let server = null;
  async function loadServer() {
    try {
      const [s] = await rest("bp_server?select=online,max_players,online_names,updated_at");
      server = s && Date.now() - new Date(s.updated_at) < 120000 ? s : null;
    } catch { server = null; }
    const el = $("[data-nav-online]");
    if (el) { el.hidden = !server; if (server) $("b", el).textContent = nf.format(server.online); }
    document.dispatchEvent(new CustomEvent("bp:server", { detail: server }));
  }
  loadServer();
  setInterval(() => !document.hidden && loadServer(), 30000);
  const isOnline = (n) => !!server?.online_names?.some((x) => x.toLowerCase() === String(n).toLowerCase());

  /* Bezoekersteller: alleen aantal per pagina per dag, geen cookies */
  try { if (!sessionStorage.getItem("bp_hit_" + page)) { sessionStorage.setItem("bp_hit_" + page, 1); rpc("bp_hit", { p_path: page }).catch(() => {}); } } catch {}

  /* PWA: offline-cache van de schil */
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  window.U = { C, $, $$, H, esc, nf, head, skin, validName, euro, ago, dur, profileUrl, rest, rpc, fn, toast, isOnline, getServer: () => server };
})();

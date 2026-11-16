/* Beheer: media-aanvragen, meldingen, events, nieuws, codes, team, uitdagingen, bestellingen, bezoekers */
(() => {
  const { $, $$, esc, euro, ago, fn, toast } = window.U;
  let pw = sessionStorage.getItem("bp_admin") || "";
  const call = (body) => fn("bp-admin", body, { "x-admin-password": pw });
  const T = {
    bp_media_requests: { label: "Media-aanvragen", status: ["nieuw", "goedgekeurd", "afgewezen"], cols: (r) => `<b>${esc(r.mc_name)}</b> · ${esc(r.platform)} · ${esc(r.followers || "?")} volgers<br><a href="${esc(r.channel_url)}" target="_blank" rel="noopener">${esc(r.channel_url)}</a><br><small>Discord: ${esc(r.discord || "–")} · ${ago(r.created_at)}</small>${r.motivation ? `<p>${esc(r.motivation)}</p>` : ""}` },
    bp_reports: { label: "Meldingen", status: ["nieuw", "bezig", "afgehandeld", "onterecht"], cols: (r) => `<b>${esc(r.target)}</b> · ${esc(r.reason)}<br><small>gemeld door ${esc(r.reporter)} · ${ago(r.created_at)}</small>${r.details ? `<p>${esc(r.details)}</p>` : ""}` },
    bp_events: { label: "Events", form: [["title", "Titel"], ["description", "Omschrijving"], ["starts_at", "Start", "datetime-local"], ["ends_at", "Einde", "datetime-local"]], cols: (r) => `<b>${esc(r.title)}</b>${r.active ? "" : " (verborgen)"}<br><small>${new Date(r.starts_at).toLocaleString("nl-NL")}</small><p>${esc(r.description || "")}</p>` },
    bp_news: { label: "Nieuws", form: [["title", "Titel"], ["body", "Tekst", "textarea"]], cols: (r) => `<b>${esc(r.title)}</b><br><small>${ago(r.created_at)}</small><p>${esc(r.body)}</p>` },
    bp_challenges: { label: "Uitdagingen", key: "day", form: [["day", "Dag", "date"], ["text", "Uitdaging"], ["reward", "Punten", "number"]], cols: (r) => `<b>${esc(r.day)}</b> · +${r.reward} punten<p>${esc(r.text)}</p>` },
    bp_coupons: { label: "Creator-codes", key: "code", form: [["code", "Code"], ["pct", "Korting %", "number"], ["creator", "Creator (MC-naam)"], ["max_uses", "Max. gebruik (leeg = onbeperkt)", "number"]], cols: (r) => `<b>${esc(r.code)}</b> · ${r.pct}% · ${esc(r.creator || "geen creator")}${r.active ? "" : " (uit)"}<br><small>${r.uses}${r.max_uses ? ` / ${r.max_uses}` : ""} keer gebruikt · omzet ${euro(r.omzet_cents || 0)}</small>` },
    bp_staff: { label: "Team", key: "name", form: [["name", "MC-naam"], ["role", "Rol"], ["sort", "Volgorde", "number"]], cols: (r) => `<b>${esc(r.name)}</b> · ${esc(r.role)}` },
    bp_pageviews: { label: "Bezoekers", key: "day", readonly: true, cols: (r) => `<b>${esc(r.day)}</b> · ${esc(r.path)} · ${r.views} bezoeken` },
    bp_orders: { label: "Bestellingen", readonly: true, cols: (r) => `<b>${esc(r.mc_name)}</b> · ${esc(r.rank_id)} · ${r.months * 30} dagen · ${euro(r.amount_cents)} · <i>${esc(r.status)}</i>${r.coupon ? ` · code ${esc(r.coupon)}` : ""}${r.gift_from ? ` · cadeau van ${esc(r.gift_from)}` : ""}<br><small>${ago(r.created_at)}${r.status === "paid" ? ` · ${r.delivered ? "uitgedeeld" : "nog niet uitgedeeld"}` : ""}</small>` },
  };
  let cur = "bp_media_requests";

  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    pw = e.target.elements.pw.value;
    const d = await call({ table: cur, action: "list" });
    if (d.ok) { sessionStorage.setItem("bp_admin", pw); start(d.rows); }
    else { const m = $("[data-login-msg]"); m.textContent = d.error || "Inloggen mislukt."; m.className = "msg bad"; }
  });
  function start(rows) {
    $("[data-login]").hidden = true;
    $("[data-panel]").hidden = false;
    $("[data-atabs]").innerHTML = Object.entries(T).map(([k, t]) => `<button role="tab" data-t="${k}" aria-selected="${k === cur}">${t.label}</button>`).join("");
    render(rows);
  }
  $("[data-atabs]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    cur = b.dataset.t;
    $$("[data-t]").forEach((x) => x.setAttribute("aria-selected", x === b));
    load();
  });
  async function load() { const d = await call({ table: cur, action: "list" }); d.ok ? render(d.rows) : toast(d.error || "Laden mislukt"); }
  function render(rows) {
    const t = T[cur], key = t.key || "id";
    const form = t.form ? `<form class="aform" data-add>${t.form.map(([k, l, type]) => type === "textarea" ? `<label class="field">${l}<textarea name="${k}" rows="3"></textarea></label>` : `<label class="field">${l}<input name="${k}" type="${type || "text"}"></label>`).join("")}<button class="btn" type="submit">Toevoegen</button></form>` : "";
    $("[data-abody]").innerHTML = form + `<ul class="alist">${rows.map((r) => `<li data-key="${esc(r[key])}"><div>${t.cols(r)}</div><div class="aact">
      ${t.status ? `<select data-status>${t.status.map((s) => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select>` : ""}
      ${"active" in r ? `<button class="btn-ghost sm" data-toggle="${r.active ? 0 : 1}">${r.active ? "Verbergen" : "Tonen"}</button>` : ""}
      ${"published" in r ? `<button class="btn-ghost sm" data-pub="${r.published ? 0 : 1}">${r.published ? "Verbergen" : "Publiceren"}</button>` : ""}
      ${t.readonly ? "" : `<button class="btn-ghost sm danger" data-del>Verwijder</button>`}</div></li>`).join("") || `<li class="empty">Niks hier.</li>`}</ul>`;
  }
  $("[data-abody]").addEventListener("change", async (e) => {
    if (!e.target.matches("[data-status]")) return;
    const d = await call({ table: cur, action: "update", key: e.target.closest("[data-key]").dataset.key, row: { status: e.target.value } });
    toast(d.ok ? "Opgeslagen" : d.error);
  });
  $("[data-abody]").addEventListener("click", async (e) => {
    const li = e.target.closest("[data-key]"); if (!li) return;
    const key = li.dataset.key;
    let d;
    if (e.target.matches("[data-toggle]")) d = await call({ table: cur, action: "update", key, row: { active: e.target.dataset.toggle === "1" } });
    else if (e.target.matches("[data-pub]")) d = await call({ table: cur, action: "update", key, row: { published: e.target.dataset.pub === "1" } });
    else if (e.target.matches("[data-del]")) { if (!confirm("Echt verwijderen? Dit kan niet terug.")) return; d = await call({ table: cur, action: "delete", key }); }
    else return;
    toast(d.ok ? "Opgeslagen" : d.error); load();
  });
  $("[data-abody]").addEventListener("submit", async (e) => {
    if (!e.target.matches("[data-add]")) return;
    e.preventDefault();
    const row = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v !== "").map(([k, v]) => [k, /_at$/.test(k) ? new Date(v).toISOString() : ["pct", "max_uses", "reward", "sort"].includes(k) ? Number(v) : k === "code" ? v.toUpperCase() : v]));
    const d = await call({ table: cur, action: "insert", row });
    toast(d.ok ? "Toegevoegd" : d.error); if (d.ok) load();
  });
  if (pw) call({ table: cur, action: "list" }).then((d) => (d.ok ? start(d.rows) : sessionStorage.removeItem("bp_admin")));
})();

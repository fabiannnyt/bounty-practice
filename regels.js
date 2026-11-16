/* Regels: speler melden + team */
(() => {
  const { $, esc, head, rest, rpc, validName, toast } = window.U;
  const f = $("[data-report]"), msg = $("[data-report-msg]");
  f.elements.reporter.value = localStorage.getItem("bp_me") || "";
  const t = new URLSearchParams(location.search).get("melden");
  if (t) f.elements.target.value = t;
  const set = (x, c = "") => { msg.textContent = x; msg.className = `msg ${c}`; };
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (!validName(d.reporter.trim()) || !validName(d.target.trim())) return set("Vul twee geldige Minecraft-namen in.", "bad");
    if (d.reporter.trim().toLowerCase() === d.target.trim().toLowerCase()) return set("Je kunt jezelf niet melden.", "bad");
    const b = $(".btn", f); b.disabled = true; set("Versturen…");
    try {
      await rpc("bp_report", { p_reporter: d.reporter.trim(), p_target: d.target.trim(), p_reason: d.reason, p_details: d.details.trim() });
      f.elements.target.value = ""; f.elements.details.value = "";
      set("Melding verstuurd. Het team kijkt ernaar.", "ok"); toast("Bedankt voor je melding.");
    } catch (err) { set(err.message, "bad"); }
    b.disabled = false;
  });
  rest("bp_staff?select=*&order=sort").then((s) => {
    if (!s.length) return;
    $("[data-team]").innerHTML = s.map((p) => `<li><img src="${head(p.name, 56)}" alt="" width="56" height="56" loading="lazy"><b>${esc(p.name)}</b><span>${esc(p.role)}</span></li>`).join("");
    $("[data-team-section]").hidden = false;
  }).catch(() => {});
})();

/* Stemmen: links + top stemmers */
(() => {
  const { C, $, esc, nf, head, rpc } = window.U;
  $("[data-votes]").innerHTML = C.voteSites.map((s, i) => `<li><span class="vote-n">${i + 1}</span><b>${esc(s.name)}</b><a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">Stem</a></li>`).join("");
  rpc("bp_top_voters").then((rows) => {
    $("[data-voters]").innerHTML = rows.length ? rows.map((r, i) => `<li><span class="pos">${i + 1}</span><img src="${head(r.name, 36)}" alt="" width="36" height="36" loading="lazy"><span class="nm">${esc(r.name)}</span><span class="val">${nf.format(r.votes)}</span></li>`).join("")
      : `<li class="empty">Nog geen stemmen deze maand. Stem en sta bovenaan.</li>`;
  }).catch(() => ($("[data-voters]").innerHTML = `<li class="empty">Laden lukt nu even niet.</li>`));
})();

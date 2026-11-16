# Bounty Practice – website

Promotiesite voor de Bounty Practice-server (KitPvP + Finals): top 3-podium, stats zoeken met "jouw doelwit" (wie je moet inhalen), top 10 per stat, ranks kopen via Mollie en de Media-rank aanvragen. De site onthoudt je naam (localStorage) en toont bij een volgend bezoek meteen je plek.

- Draait op **GitHub Pages** (elke push naar `main` publiceert automatisch, zie `.github/workflows/pages.yml`).
- Data en betalingen lopen via **Supabase** (project `bounty-takenbord`, tabellen met prefix `bp_`).

## Bestanden

| Bestand | Wat |
| --- | --- |
| `config.js` | **Server-IP en Discord-link (nu placeholders)** + Supabase-sleutel |
| `index.html` / `style.css` / `app.js` | De site |
| `bedankt.html` | Pagina waar Mollie je na het betalen naartoe stuurt |
| `voorwaarden.html` | Concept-voorwaarden voor de winkel |
| `bush.svg` | Pixel-blaadjes achter het logo |

## Database (Supabase)

| Tabel | Inhoud | Wie schrijft |
| --- | --- | --- |
| `bp_players` | Stats per speler (uuid, naam, kills, deaths, best_streak, finals_played, finals_won, points, favorite_kit) | KitPvP-plugin |
| `bp_ranks` | Ranks, prijzen (in centen), kleur, perks | Jij (Supabase dashboard) |
| `bp_orders` | Bestellingen + Mollie-status, `expires_at`, `delivered`, `removed` | Website + webhook + plugin |
| `bp_media_requests` | Media-aanvragen (status `nieuw` / `goedgekeurd` / `afgewezen`) | Website, team keurt goed |

Rank-id's (`donator`, `vip`, `hunter`, `legende`, `media`) zijn gelijk aan de LuckPerms-groepen die KitPvP gebruikt.

**Demo-data:** er staan 12 nep-spelers in (`is_demo = true`). Weghalen zodra de plugin echte stats stuurt:

```sql
delete from bp_players where is_demo;
```

## Mollie aanzetten

1. Maak een Mollie-account (op jouw naam / KvK) en kopieer de **API-key** (eerst `test_...`, later `live_...`).
2. Supabase dashboard → Edge Functions → Secrets → voeg toe:
   - `MOLLIE_API_KEY` = je Mollie-key
   - `SITE_URL` = `https://fabiannnyt.github.io/bounty-practice` (of je eigen domein later)
3. Klaar. Zonder key toont de site netjes "Betalen is nog niet actief".

Flow: site → `bp-checkout` (maakt bestelling + Mollie-betaling) → Mollie → `bp-mollie-webhook` (zet `status = paid`, `expires_at = +30 dagen`, stapelt bij verlenging) → `bedankt.html`.

## KitPvP-plugin koppelen (later)

De plugin praat met de Supabase REST API met de **service role key** (alleen in de plugin-config, nooit op de site).

```
URL:     https://ekioqxtazurafzyrnbxb.supabase.co/rest/v1/
Headers: apikey: <service_role_key>
         Authorization: Bearer <service_role_key>
         Content-Type: application/json
```

**1. Stats sturen** – bij quit, na een Finals-ronde en elke 5 minuten voor online spelers:

```
POST bp_players?on_conflict=uuid
Prefer: resolution=merge-duplicates
[{"uuid":"...","name":"FabiannnYT","kills":412,"deaths":198,"best_streak":23,
  "finals_played":41,"finals_won":17,"points":5230,"favorite_kit":"Krijger",
  "last_seen":"2026-11-16T22:00:00Z","updated_at":"2026-11-16T22:00:00Z"}]
```

Favoriete kit = de kit waarmee een speler de meeste kills heeft (plugin moet kills per kit bijhouden).

**2. Gekochte ranks geven** – elke 60 seconden:

```
GET   bp_orders?status=eq.paid&delivered=eq.false&select=id,mc_name,rank_id,expires_at
→ /kp giverank <mc_name> <rank_id>
PATCH bp_orders?id=eq.<id>   {"delivered":true,"delivered_at":"<nu>"}
```

**3. Verlopen ranks weghalen** – elke 10 minuten:

```
GET   bp_orders?status=eq.paid&removed=eq.false&expires_at=lt.<nu>&select=id,mc_name,rank_id
→ alleen /kp removerank als er géén andere betaalde order voor die speler + rank met expires_at > nu is
PATCH bp_orders?id=eq.<id>   {"removed":true,"removed_at":"<nu>"}
```

**4. Media-rank** – aanvragen staan in `bp_media_requests`. Keur goed in het dashboard en geef de rank met `/kp giverank <naam> media`.

## Nog te doen

- Echt server-IP en Discord-invite in `config.js`
- Originele logo-PNG in de site zetten (nu nagemaakt in CSS)
- Prijzen en perks checken in `bp_ranks`
- Voorwaarden laten nakijken voordat de winkel live gaat

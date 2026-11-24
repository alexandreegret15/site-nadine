// Calcule les prix médians au m² des maisons et appartements pour chaque commune de Normandie,
// à partir des ventes notariées DVF (DGFiP, data.gouv.fr) et des positions des communes (geo.api.gouv.fr).
// Usage : node estimation/build-prix.mjs [dossier_cache]   → écrit site/data/prix-communes.json
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DEPS = ["14", "27", "50", "61", "76"];
const ANNEES = (process.env.DVF_ANNEES || "2024,2025").split(",");
const CACHE = process.argv[2] || path.join(process.cwd(), ".cache-dvf");
const SORTIE = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "site", "data", "prix-communes.json");
const MIN_VENTES = 10;           // en dessous, on élargit aux ventes autour de la commune
const RAYONS = [5, 10, 15, 25];  // km
const MIN_PIECES = 6;            // ventes minimum pour un prix par nombre de pièces ou par taille de terrain
const TERRAINS = [300, 800, 1500, 3000]; // tranches de terrain (m²) pour les maisons : <300, 300-800, 800-1500, 1500-3000, >3000
const trancheTerrain = t => { let i = 0; while (i < TERRAINS.length && t >= TERRAINS[i]) i++; return i; };

fs.mkdirSync(CACHE, { recursive: true });

async function telecharger(url, fichier) {
  const f = path.join(CACHE, fichier);
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) return f;
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      return f;
    } catch (e) {
      if (essai === 4) throw new Error(url + " : " + e.message);
      await new Promise(res => setTimeout(res, 5000 * essai));
    }
  }
}

function lignesCsv(texte) {
  const out = []; let champ = "", ligne = [], q = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (q) { if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else q = false; } else champ += c; }
    else if (c === '"') q = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); out.push(ligne); ligne = []; champ = ""; }
    else if (c !== "\r") champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); out.push(ligne); }
  return out;
}

const mediane = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return R * Math.hypot(x, y); };

// 1. Communes (nom, codes postaux, centre)
const communes = [];
for (const d of DEPS) {
  const f = await telecharger(`https://geo.api.gouv.fr/departements/${d}/communes?fields=nom,code,centre,codesPostaux,population`, `geo-${d}.json`);
  for (const c of JSON.parse(fs.readFileSync(f, "utf8"))) {
    if (!c.centre) continue;
    communes.push({ code: c.code, nom: c.nom, cp: c.codesPostaux || [], lon: c.centre.coordinates[0], lat: c.centre.coordinates[1], pop: c.population || 0 });
  }
}

// 2. Ventes DVF : une seule maison ou un seul appartement par vente (dépendances tolérées)
const ventes = []; let dateMin = "9999", dateMax = "0000";
for (const a of ANNEES) for (const d of DEPS) {
  const f = await telecharger(`https://files.data.gouv.fr/geo-dvf/latest/csv/${a}/departements/${d}.csv.gz`, `${a}-${d}.csv.gz`);
  const rows = lignesCsv(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  const h = Object.fromEntries(rows[0].map((k, i) => [k, i]));
  const muts = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (r.length < 10) continue;
    const id = r[h.id_mutation];
    if (!muts.has(id)) muts.set(id, []);
    muts.get(id).push(r);
  }
  for (const rs of muts.values()) {
    const r0 = rs[0];
    if (r0[h.nature_mutation] !== "Vente") continue;
    const locaux = new Map(), parcelles = new Map(); let autre = false;
    for (const r of rs) {
      const st = parseFloat(r[h.surface_terrain]);
      if (st > 0) parcelles.set(r[h.id_parcelle] + "|" + r[h.code_nature_culture] + "|" + st, st);
      const t = r[h.type_local]; if (!t) continue;
      if (t === "Local industriel. commercial ou assimilé") autre = true;
      if (t !== "Maison" && t !== "Appartement") continue;
      locaux.set([r[h.id_parcelle], t, r[h.surface_reelle_bati], r[h.nombre_pieces_principales], r[h.lot1_numero]].join("|"), r);
    }
    if (autre || locaux.size !== 1) continue;
    const r = [...locaux.values()][0];
    const prix = parseFloat(r0[h.valeur_fonciere]), surf = parseFloat(r[h.surface_reelle_bati]);
    if (!(prix > 0 && surf >= 9)) continue;
    const m2 = prix / surf;
    if (m2 < 300 || m2 > 15000) continue;
    const date = r0[h.date_mutation];
    if (date < dateMin) dateMin = date; if (date > dateMax) dateMax = date;
    const terrain = [...parcelles.values()].reduce((a, b) => a + b, 0);
    ventes.push({ c: r[h.code_commune], d: r[h.code_departement], tr: trancheTerrain(terrain), t: r[h.type_local] === "Maison" ? "M" : "A", p: Math.min(5, Math.max(1, parseInt(r[h.nombre_pieces_principales]) || 0)) || null, m2, lat: parseFloat(r[h.latitude]), lon: parseFloat(r[h.longitude]) });
  }
}

// 3. Statistiques par commune, avec élargissement au secteur si trop peu de ventes
const parCommune = new Map();
for (const v of ventes) { const k = v.c + v.t; if (!parCommune.has(k)) parCommune.set(k, []); parCommune.get(k).push(v); }
const geoVentes = { M: ventes.filter(v => v.t === "M" && v.lat), A: ventes.filter(v => v.t === "A" && v.lat) };

function stats(liste) {
  const o = { m: Math.round(mediane(liste.map(v => v.m2))), n: liste.length, p: {} };
  for (let p = 1; p <= 5; p++) { const l = liste.filter(v => v.p === p); if (l.length >= MIN_PIECES) o.p[p] = [Math.round(mediane(l.map(v => v.m2))), l.length]; }
  if (!Object.keys(o.p).length) delete o.p;
  if (liste[0] && liste[0].t === "M") {
    o.t = {};
    for (let k = 0; k <= TERRAINS.length; k++) { const l = liste.filter(v => v.tr === k); if (l.length >= MIN_PIECES) o.t[k] = [Math.round(mediane(l.map(v => v.m2))), l.length]; }
    if (!Object.keys(o.t).length) delete o.t;
  }
  return o;
}

const sortie = [];
for (const c of communes) {
  const e = { c: c.code, n: c.nom, cp: c.cp.join(" "), y: +c.lat.toFixed(4), x: +c.lon.toFixed(4) };
  for (const t of ["M", "A"]) {
    const propres = parCommune.get(c.code + t) || [];
    if (propres.length >= MIN_VENTES) { e[t] = stats(propres); continue; }
    for (const r of RAYONS) {
      const l = geoVentes[t].filter(v => Math.abs(v.lat - c.lat) < r / 100 && km(c.lat, c.lon, v.lat, v.lon) <= r);
      if (l.length >= MIN_VENTES) { e[t] = { ...stats(l), r, nc: propres.length }; break; }
    }
  }
  sortie.push(e);
}
sortie.sort((a, b) => a.n.localeCompare(b.n, "fr"));

// Effet moyen du terrain par département (prix médian de la tranche / prix médian des maisons), utilisé quand la commune a trop peu de ventes
const ratioTerrain = {};
for (const d of DEPS) {
  const l = geoVentes.M.filter(v => v.d === d), med = mediane(l.map(v => v.m2));
  ratioTerrain[d] = [];
  for (let k = 0; k <= TERRAINS.length; k++) ratioTerrain[d].push(+(mediane(l.filter(v => v.tr === k).map(v => v.m2)) / med).toFixed(3));
}

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, JSON.stringify({
  source: "DVF (Demandes de valeurs foncières), DGFiP, via data.gouv.fr (geo-dvf) ; positions : geo.api.gouv.fr",
  periode: [dateMin, dateMax], tranchesTerrain: TERRAINS, ratioTerrain, calcule: new Date().toISOString().slice(0, 10), ventes: ventes.length, communes: sortie
}));
console.log(`${ventes.length} ventes retenues (${dateMin} → ${dateMax}), ${sortie.length} communes → ${SORTIE}`);

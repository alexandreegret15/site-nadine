// Annonces écrites directement dans les pages (lisibles par Google et par les IA sans JavaScript)
// et une page par bien dans site/biens/. Lit site/data/annonces.json (rempli chaque matin par le scraper).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const site = join(ici, "..", "site");
const fmt = new Intl.NumberFormat("fr-FR");
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sansAccent = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Noms officiels des communes de Normandie (avec accents), pour corriger « LA RIVIERE-SAINT-SAUVEUR »
let communes = null;
function nomOfficiel(ville, cp) {
  if (!communes) {
    try { communes = JSON.parse(readFileSync(join(site, "data", "prix-communes.json"), "utf8")).communes || []; } catch { communes = []; }
  }
  const cle = sansAccent(ville);
  const c = communes.find((x) => sansAccent(x.n) === cle && (!cp || x.cp === cp)) || communes.find((x) => sansAccent(x.n) === cle);
  if (c) return c.n;
  // À défaut : « LE HAVRE » → « Le Havre »
  return String(ville).toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// Phrases de fin d'annonce imposées par le réseau : on garde celles utiles à l'acheteur (prix, DPE,
// charges, risques) et on retire les répétitions (contact, mentions légales du réseau déjà en pied de page).
const COUPURES = ["Mandat n°", "Prix :", "DPE ", "Montant estimé", "Pour visiter", "Selon l'article", "Cette présente annonce",
  "Mandat réf", "Le professionnel garantit", "Copropriété de", "Charges annuelles", "Les informations sur les risques"];
const GARDER = /^(Prix :|DPE |Montant estimé|Copropriété de|Charges annuelles|Les informations sur les risques)/;

// « à Le Havre » → « au Havre », « à Les Andelys » → « aux Andelys »
export const aVille = (v) => (/^Le /.test(v) ? "au " + v.slice(3) : /^Les /.test(v) ? "aux " + v.slice(4) : "à " + v);

export function nettoyer(a) {
  let brut = String(a.description || "").replace(/^\s*Description\s*/i, "");
  // Anciennes données sans retours à la ligne : « quotidien.Situé » → deux phrases séparées
  if (!brut.includes("\n")) brut = brut.replace(/([.!?])(?=[A-ZÀ-Ý])/g, "$1\n");
  for (const c of COUPURES) brut = brut.split(c).join("\n" + c);
  const lignes = brut.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const iFin = lignes.findIndex((l) => COUPURES.some((c) => l.startsWith(c)));
  const corps = iFin < 0 ? lignes : lignes.slice(0, iFin);
  let mentions = iFin < 0 ? [] : lignes.slice(iFin).filter((l) => GARDER.test(l));
  // Prix écrit dans le texte différent du prix affiché (annonce baissée) : on garde seulement qui paie les honoraires
  mentions = mentions.map((l) => {
    if (!l.startsWith("Prix :")) return l.replace(/www\. georisques\. gouv\. fr/, "www.georisques.gouv.fr");
    const n = Number((l.match(/Prix : ([\d\s ]+)/)?.[1] || "").replace(/\D/g, ""));
    if (!a.prix || n === a.prix) return l;
    return /vendeur/i.test(l) ? "Honoraires à la charge du vendeur." : "Honoraires à la charge de l'acquéreur, selon le barème en vigueur.";
  });
  // Paragraphes (une ligne vide les sépare) et listes « - … »
  const blocs = [];
  let para = [];
  const pousser = () => { if (para.length) blocs.push({ p: para.join(" ") }); para = []; };
  for (const l of corps) {
    if (!l) { pousser(); continue; }
    if (/^- /.test(l)) { pousser(); const der = blocs[blocs.length - 1]; if (der?.ul) der.ul.push(l.slice(2)); else blocs.push({ ul: [l.slice(2)] }); continue; }
    if (/^\*\*.+\*\*$/.test(l)) { pousser(); blocs.push({ h: l.replace(/\*\*/g, "") }); continue; }
    para.push(l);
    if (!String(a.description).includes("\n")) pousser(); // ancien format : une phrase par paragraphe serait trop haché, on regroupe ci-dessous
  }
  pousser();
  // Ancien format : regroupe les phrases par 3 pour des paragraphes lisibles
  if (!String(a.description).includes("\n")) {
    const phrases = blocs.filter((b) => b.p).map((b) => b.p);
    blocs.length = 0;
    for (let i = 0; i < phrases.length; i += 3) blocs.push({ p: phrases.slice(i, i + 3).join(" ") });
  }

  // DPE / GES : ceux écrits dans l'annonce elle-même priment (la page du réseau affiche aussi
  // des biens similaires, dont le scraper pouvait prendre les étiquettes par erreur)
  const dpeTxt = String(a.description || "").match(/DPE\s*:?\s*([A-G])(?![a-zà-ÿ])[^A-Z]{0,40}?GES\s*:?\s*([A-G])(?![a-zà-ÿ])/);
  // Sans DPE écrit dans l'annonce (ex. plateau brut), on n'affiche rien plutôt qu'une étiquette douteuse
  const dpe = dpeTxt ? dpeTxt[1] : null, ges = dpeTxt ? dpeTxt[2] : null;
  // Terrain : la page du réseau affiche aussi des biens similaires, le chiffre repris peut être le leur.
  // On ne le garde que s'il figure dans le texte de l'annonce (jamais pour un appartement).
  const texteBrut = String(a.description || "").replace(/[\s\u00a0\u202f]/g, "");
  const terrain = a.terrain && !/^(appartement|studio|plateau|loft)/i.test(String(a.titre)) && texteBrut.includes(`${a.terrain}m²`) ? a.terrain : null;
  const typeMot = String(a.titre || "").trim().split(/\s+/)[0] || "Bien";
  const type = /^(maison|appartement|terrain|immeuble|plateau|studio|loft|propri[ée]t[ée])$/i.test(typeMot) ? typeMot : "Bien";
  let ville = a.ville ? nomOfficiel(a.ville, a.cp) : "";
  if (!ville) ville = String(a.titre || "").match(/^\S+\s+(.+?)\s+\d+\s+pi[eè]ce/i)?.[1] || "";
  const titre = String(a.titre || "Bien").replace(/pièce\(s\)/i, a.pieces > 1 ? "pièces" : "pièce");
  // Titre parlant, pour Google : « Maison 4 pièces de 87 m² à Honfleur »
  const typeAff = type === "Bien" ? (a.pieces ? "Bien" : titre) : type[0].toUpperCase() + type.slice(1).toLowerCase();
  const titreSeo = [typeAff, a.pieces ? `${a.pieces} pièce${a.pieces > 1 ? "s" : ""}` : "", a.surface ? `de ${fmt.format(a.surface)} m²` : "", ville ? aVille(ville) : ""].filter(Boolean).join(" ");
  const slug = [sansAccent(type === "Bien" ? "bien" : type), sansAccent(ville), String(a.ref).toLowerCase()].filter(Boolean).join("-");
  const resume = (blocs.find((b) => b.p)?.p || "").slice(0, 400);
  return { ...a, terrain, dpe, ges, ville, titre, titreSeo, type, slug, chemin: `biens/${slug}.html`, blocs, mentions, resume };
}

export function chargerAnnonces() {
  const f = join(site, "data", "annonces.json");
  if (!existsSync(f)) return { miseAJour: null, annonces: [] };
  const d = JSON.parse(readFileSync(f, "utf8"));
  return { miseAJour: d.miseAJour, annonces: (d.annonces || []).map(nettoyer) };
}

export const dateFR = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "");

// Carte d'un bien dans les listes (accueil, « Biens à vendre »). Lien vers la page du bien sur le site.
export function carte(a) {
  const photo = a.photos?.[0]
    ? `<picture>${a.vignette ? `<source srcset="${esc(a.vignette)}" type="image/webp">` : ""}<img src="${esc(a.photos[0])}" alt="${esc(a.titreSeo)}" loading="lazy" decoding="async" width="800" height="533"></picture>${a.photos.length > 1 ? `<span class="nb">${a.photos.length} photos</span>` : ""}`
    : "Photo indisponible";
  const specs = [a.surface && `${fmt.format(a.surface)} m²`, a.pieces && `${a.pieces} pièce${a.pieces > 1 ? "s" : ""}`, a.chambres && `${a.chambres} ch.`,
    a.terrain && `Terrain ${fmt.format(a.terrain)} m²`, `Réf. ${a.ref}`].filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join("");
  const prix = a.prix ? `${fmt.format(a.prix)} €${a.surface ? `<small>${fmt.format(Math.round(a.prix / a.surface))} €/m²</small>` : ""}` : "Prix sur demande";
  const cat = /^maison|propri/i.test(a.type) ? "maison" : /^appartement|studio|loft/i.test(a.type) ? "appartement" : "autre";
  return `<article class="bien" data-type="${cat}" data-ville="${esc(a.ville)}" data-pieces="${a.pieces || 0}" data-prix="${a.prix || 0}" data-surface="${a.surface || 0}">
  <div class="photo">${photo}${a.exclusivite ? `<span class="tag">Exclusivité</span>` : ""}</div>
  <div class="info">
    <h3>${esc(a.titreSeo || a.titre)}</h3>
    ${a.ville ? `<span class="lieu">${esc(a.ville)}${a.cp ? ` (${esc(a.cp)})` : ""}</span>` : ""}
    <div class="specs">${specs}</div>
    ${a.resume ? `<p class="desc">${esc(a.resume)}</p>` : ""}
    <div class="bottom"><span class="prix">${prix}</span>${a.dpe ? `<span class="dpe ${esc(a.dpe)}">DPE ${esc(a.dpe)}</span>` : ""}<a class="voir" href="${esc(a.chemin)}">Voir le bien →</a></div>
  </div>
</article>`;
}

export function listeHTML(d, limite) {
  const n = d.annonces.length;
  const maj = `<p id="maj">${n} bien${n > 1 ? "s" : ""} en vente${d.miseAJour ? ` · liste mise à jour le ${dateFR(d.miseAJour)}` : ""}.</p>`;
  const cartes = n ? d.annonces.slice(0, limite || n).map(carte).join("\n")
    : `<div class="vide">Aucun bien en vente en ce moment. Contactez-moi pour être prévenu des nouveautés.</div>`;
  return { maj, cartes, n };
}

// Barre de filtres de la page « Biens à vendre » (les cartes restent dans la page ; le tri se fait dans le navigateur)
export function filtresHTML(d) {
  const villes = new Map();
  for (const a of d.annonces) if (a.ville) villes.set(a.ville, (villes.get(a.ville) || 0) + 1);
  const optVilles = [...villes].sort((x, y) => x[0].localeCompare(y[0], "fr")).map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join("");
  return `<form class="filtres" id="filtres" aria-label="Filtrer les biens">
    <fieldset class="f-type"><legend>Type de bien</legend>
      <label><input type="radio" name="f-type" value="" checked><span>Tous</span></label>
      <label><input type="radio" name="f-type" value="maison"><span>Maison</span></label>
      <label><input type="radio" name="f-type" value="appartement"><span>Appartement</span></label>
      <label><input type="radio" name="f-type" value="autre"><span>Autre</span></label>
    </fieldset>
    <label>Commune<select id="f-ville"><option value="">Toutes</option>${optVilles}</select></label>
    <label>Pièces<select id="f-pieces"><option value="0">Peu importe</option><option value="1">1 et +</option><option value="2">2 et +</option><option value="3">3 et +</option><option value="4">4 et +</option><option value="5">5 et +</option></select></label>
    <label>Prix min (€)<input id="f-pmin" type="number" inputmode="numeric" min="0" step="5000" placeholder="Min"></label>
    <label>Prix max (€)<input id="f-pmax" type="number" inputmode="numeric" min="0" step="5000" placeholder="Max"></label>
    <label>Surface min (m²)<input id="f-smin" type="number" inputmode="numeric" min="0" step="5" placeholder="Min"></label>
    <label>Trier par<select id="f-tri"><option value="">Les plus récents</option><option value="prix-asc">Prix croissant</option><option value="prix-desc">Prix décroissant</option><option value="surface-desc">Surface décroissante</option></select></label>
    <div class="f-bas"><p id="f-compte" aria-live="polite">${d.annonces.length} bien${d.annonces.length > 1 ? "s" : ""}</p><button class="btn ghost" type="reset">Effacer les filtres</button></div>
  </form>
  <div class="vide" id="f-vide" hidden>Aucun bien ne correspond à ces critères. Élargissez la recherche ou <a href="contact.html">dites-moi ce que vous cherchez</a> : je vous préviens dès qu'un bien correspond.</div>`;
}

// Contenu de la page d'un bien
export function corpsBien(a) {
  const specs = [["Surface habitable", a.surface && `${fmt.format(a.surface)} m²`], ["Pièces", a.pieces], ["Chambres", a.chambres],
    ["Terrain", a.terrain && `${fmt.format(a.terrain)} m²`], ["DPE (énergie)", a.dpe], ["GES (climat)", a.ges], ["Référence", a.ref]]
    .filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const photos = (a.photos || []).map((p, i) => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="${esc(a.titreSeo)}, photo ${i + 1}" width="1200" height="800" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></a>`);
  const texte = a.blocs.map((b) => b.h ? `<h3>${esc(b.h)}</h3>` : b.ul ? `<ul>${b.ul.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>${esc(b.p)}</p>`).join("\n");
  const prix = a.prix ? `${fmt.format(a.prix)} €` : "Prix sur demande";
  return `<section class="bien-page"><div class="wrap">
  <nav class="ariane ariane-clair" aria-label="Fil d'Ariane"><a href="index.html">Accueil</a><span aria-hidden="true">›</span><a href="biens.html">Biens à vendre</a><span aria-hidden="true">›</span><span aria-current="page">${esc(a.titreSeo)}</span></nav>
  <div class="bien-tete">
    <div><h1>${esc(a.titreSeo)}</h1>${a.ville ? `<p class="lieu">${esc(a.ville)}${a.cp ? ` (${esc(a.cp)})` : ""}${a.exclusivite ? " · Exclusivité" : ""}</p>` : ""}</div>
    <p class="prix">${prix}${a.prix && a.surface ? `<small>${fmt.format(Math.round(a.prix / a.surface))} €/m² · honoraires inclus</small>` : ""}</p>
  </div>
  ${photos.length ? `<div class="galerie">${photos.slice(0, 5).join("")}</div>` : ""}
  ${photos.length > 5 ? `<details class="plus-photos"><summary>Voir toutes les photos (${photos.length})</summary><div class="galerie-toutes">${photos.join("")}</div></details>` : ""}
  <div class="bien-grille">
    <div class="bien-texte">
      <h2>Description</h2>
      ${texte}
      ${a.mentions.length ? `<h2>Informations utiles</h2><ul class="mentions">${a.mentions.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      <p class="note">Annonce rédigée par Nadine Malfilatre, conseillère immobilière Propriétés Privées. Fiche complète, diagnostics et barème : <a href="${esc(a.url)}" target="_blank" rel="noopener">voir l'annonce sur Propriétés Privées</a>.</p>
    </div>
    <aside class="bien-cote">
      <dl class="carac">${specs}</dl>
      <div class="bien-contact">
        <b>Ce bien vous intéresse ?</b>
        <p>Je vous le fais visiter et réponds à vos questions.</p>
        <a class="btn or" href="tel:+33681516289">06 81 51 62 89</a>
        <a class="btn ghost" href="contact.html?ref=${esc(a.ref)}">Écrire au sujet de ce bien</a>
      </div>
    </aside>
  </div>
  <div class="tout"><a class="btn ghost" href="biens.html">← Tous les biens à vendre</a></div>
</div></section>`;
}

// Données structurées d'un bien (correspondent au texte visible de la page)
export function grapheBien(a, url, idAgent) {
  const logement = /appartement|studio|loft/i.test(a.type) ? "Apartment" : /maison|propri/i.test(a.type) ? "SingleFamilyResidence" : "Accommodation";
  const abs = (p) => (/^https?:/.test(p) ? p : new URL(p, url.replace(/biens\/[^/]+$/, "")).href);
  return {
    "@type": "RealEstateListing",
    "@id": url + "#annonce",
    url,
    name: a.titreSeo,
    description: a.resume,
    image: (a.photos || []).slice(0, 6).map(abs),
    offers: { "@type": "Offer", price: a.prix || undefined, priceCurrency: "EUR", availability: "https://schema.org/InStock", seller: { "@id": idAgent } },
    about: {
      "@type": logement,
      name: a.titreSeo,
      ...(a.surface ? { floorSize: { "@type": "QuantitativeValue", value: a.surface, unitCode: "MTK" } } : {}),
      ...(a.pieces ? { numberOfRooms: a.pieces } : {}),
      ...(a.chambres ? { numberOfBedrooms: a.chambres } : {}),
      address: { "@type": "PostalAddress", addressLocality: a.ville || undefined, postalCode: a.cp || undefined, addressCountry: "FR" },
    },
  };
}

// Récupère les annonces de Nadine Malfilatre sur proprietes-privees.com
// et écrit site/data/annonces.json. Lancé une fois par jour par GitHub Actions.
//
// Règles de sécurité :
//  - si la récupération échoue ou ne trouve aucune annonce alors qu'il y en
//    avait la veille, on garde l'ancien fichier (le site n'est jamais vidé par erreur) ;
//  - requêtes espacées de 2 s, une seule passe par jour.

import * as cheerio from "cheerio";
import { readFile, writeFile, mkdir, access, readdir, rm } from "node:fs/promises";

const BASE = "https://www.proprietes-privees.com";
const PAGE_NEGO = process.env.PAGE_NEGO || `${BASE}/negociateur/nadine.malfilatre`;
const PORTRAIT = "https://images.proprietes-privees.com/negociateur/NMAL.png";
const SORTIE =new URL("../site/data/annonces.json", import.meta.url);
const UA = "SiteNadineMalfilatre/1.0 (mise a jour quotidienne de ses propres annonces)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function telecharger(url) {
  const rep = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" } });
  if (!rep.ok) throw new Error(`${url} → HTTP ${rep.status}`);
  return rep.text();
}

const nombre = (s) => (s ? Number(String(s).replace(/[^\d,]/g, "").replace(",", ".")) || null : null);

// 1. Liste des références présentes sur la page de la négociatrice
export function extraireReferences(html) {
  const refs = new Set();
  for (const m of html.matchAll(/\/annonces\/(\d{4,}[A-Z]{2,})/g)) refs.add(m[1]);
  return [...refs];
}

// 2. Détail d'une annonce
export function extraireAnnonce(html, ref) {
  const $ = cheerio.load(html);
  const meta = (p) => $(`meta[property="${p}"],meta[name="${p}"]`).attr("content") || "";
  // Texte visible, chaque balise séparée par un espace (évite "ExclusivitéPlateau")
  const corps = $("body").clone();
  corps.find("script,style,noscript").remove();
  const texte = cheerio.load(corps.html().replace(/></g, "> <")).text().replace(/\s+/g, " ");

  // Données structurées si le site en publie (prioritaires)
  let ld = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).text());
      for (const o of [].concat(j["@graph"] || j)) if (o.offers || o.floorSize || o.address) ld = o;
    } catch {}
  });

  const titre = ($("h1").first().text().trim() || ld.name || meta("og:title")).replace(/\s+/g, " ");

  const prix =
    nombre(ld.offers?.price) ||
    nombre(texte.match(/(\d{1,3}(?:[\s  ]\d{3})+)\s*€(?!\s*\/)/)?.[1]);

  const surface = nombre(ld.floorSize?.value) || nombre(texte.match(/(\d+(?:,\d+)?)\s*m²/)?.[1]);
  const pieces = nombre(texte.match(/(\d+)\s*(?:p\b|pièces?)/i)?.[1]);
  const chambres = nombre(texte.match(/(\d+)\s*chambres?/i)?.[1]);
  const terrain = nombre(texte.match(/terrain\s*(?:de\s*|:\s*)?(\d{1,3}(?:[\s  ]?\d{3})*)\s*m²/i)?.[1]);

  // Ville : bloc « .trade-location » (« LE HAVRE (76600) », précédé d'une icône), sinon premier
  // élément dont le texte a la forme « Ville (27210) ». L'icône <img> ne doit pas bloquer la lecture.
  const forme = /^([^()]{2,60}?)\s*\((\d{5})\)$/;
  let lieu = $(".trade-location").first().text().trim().match(forme);
  $("body *").each((_, el) => {
    if (lieu || $(el).children().not("img,svg,i").length) return;
    lieu = $(el).text().trim().match(forme);
  });
  const ville = ld.address?.addressLocality || lieu?.[1]?.trim() || "";
  const cp = ld.address?.postalCode || lieu?.[2] || "";

  const dpe = texte.match(/DPE\s*:?\s*([A-G])\b/)?.[1] || null;
  const ges = texte.match(/GES\s*:?\s*([A-G])\b/)?.[1] || null;

  // Photos : on garde la version originale, dans l'ordre, sans doublon
  const photos = new Map();
  const reImg = new RegExp(`https://images\\.proprietes-privees\\.com/annonce/${ref}/[\\w.-]+?-(\\d+)\\.jpe?g`, "g");
  for (const m of html.matchAll(reImg)) if (!photos.has(+m[1])) photos.set(+m[1], m[0]);

  // Description : paragraphe de « .trade-description » sans son titre « Description »,
  // en gardant les retours à la ligne (<br>) pour refaire les paragraphes sur le site.
  const blocDesc = $(".trade-description p").first().length ? $(".trade-description p").first() : $('[class*="description" i]').first().clone().find("h1,h2,h3").remove().end();
  const description =
    (blocDesc.html() || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/^\s*Description\s*/i, "").trim() ||
    ld.description ||
    meta("og:description");

  // DPE/GES écrits dans l'annonce elle-même (la page affiche aussi des biens similaires)
  const dpeTxt = description.match(/DPE\s*:?\s*([A-G])(?![a-zà-ÿ])[^A-Z]{0,40}?GES\s*:?\s*([A-G])(?![a-zà-ÿ])/);

  return {
    ref,
    url: `${BASE}/annonces/${ref}`,
    titre,
    ville,
    cp,
    prix,
    surface,
    pieces,
    chambres,
    // terrain seulement s'il est écrit dans l'annonce (sinon il peut venir d'un bien similaire affiché sur la page)
    terrain: terrain && description.replace(/[\s\u00a0\u202f]/g, "").includes(`${terrain}m²`) ? terrain : null,
    dpe: dpeTxt ? dpeTxt[1] : description ? null : dpe,
    ges: dpeTxt ? dpeTxt[2] : description ? null : ges,
    exclusivite: /exclusivit/i.test(texte.slice(0, 4000)),
    description,
    photos: [...photos.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]),
  };
}

async function main() {
  let ancien = { annonces: [] };
  try { ancien = JSON.parse(await readFile(SORTIE, "utf8")); } catch {}

  const refs = extraireReferences(await telecharger(PAGE_NEGO));
  console.log(`${refs.length} annonce(s) trouvée(s) : ${refs.join(", ")}`);

  if (refs.length === 0 && ancien.annonces.length > 0) {
    console.warn("Aucune annonce trouvée : page modifiée ou indisponible ? On garde les données d'hier.");
    process.exitCode = 1; // le workflow signale l'anomalie par e-mail
    return;
  }

  const annonces = [];
  for (const ref of refs) {
    await pause(2000);
    try {
      annonces.push(extraireAnnonce(await telecharger(`${BASE}/annonces/${ref}`), ref));
    } catch (e) {
      console.warn(`Annonce ${ref} ignorée : ${e.message}`);
      const hier = ancien.annonces.find((a) => a.ref === ref);
      if (hier) annonces.push(hier);
    }
  }

  // Copie des photos sur le site (accord du réseau obtenu) : le site ne dépend plus
  // des serveurs de Propriétés Privées pour afficher les images.
  const dossierPhotos = new URL("../site/photos/", import.meta.url);
  await mkdir(dossierPhotos, { recursive: true });
  for (const a of annonces) {
    const locales = [];
    for (const [i, src] of (a.photosSource || a.photos).entries()) {
      const nom = `photos/${a.ref}/${i + 1}.jpg`;
      const fichier = new URL(`../site/${nom}`, import.meta.url);
      try {
        await access(fichier); // déjà téléchargée un jour précédent
      } catch {
        try {
          await pause(500);
          const rep = await fetch(src, { headers: { "User-Agent": UA } });
          if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
          await mkdir(new URL(`../site/photos/${a.ref}/`, import.meta.url), { recursive: true });
          await writeFile(fichier, Buffer.from(await rep.arrayBuffer()));
        } catch (e) {
          console.warn(`Photo ${src} non copiée : ${e.message}`);
          locales.push(src); // repli : lien direct vers la photo d'origine
          continue;
        }
      }
      locales.push(nom);
    }
    a.photosSource = a.photosSource || a.photos;
    a.photos = locales;
  }
  // Portrait de Nadine (celui de sa page Propriétés Privées), rafraîchi chaque jour
  try {
    const rep = await fetch(PORTRAIT, { headers: { "User-Agent": UA } });
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    await mkdir(new URL("../site/img/", import.meta.url), { recursive: true });
    await writeFile(new URL("../site/img/nadine.png", import.meta.url), Buffer.from(await rep.arrayBuffer()));
  } catch (e) {
    console.warn(`Portrait non copié : ${e.message}`);
  }

  // Version WebP compressée (800 px) de la 1re photo de chaque bien et du portrait, pour un site plus rapide.
  // Facultatif : si la conversion échoue, le site garde simplement les JPG.
  try {
    const { default: sharp } = await import("sharp");
    for (const a of annonces) {
      if (!a.photos[0] || /^https?:/.test(a.photos[0])) continue;
      const nom = `photos/${a.ref}/vignette.webp`, fichier = new URL(`../site/${nom}`, import.meta.url);
      try { await access(fichier); } catch {
        await sharp(new URL(`../site/${a.photos[0]}`, import.meta.url).pathname).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 66 }).toFile(fichier.pathname);
      }
      a.vignette = nom;
    }
    const portrait = new URL("../site/img/nadine.png", import.meta.url).pathname;
    await sharp(portrait).webp({ quality: 82 }).toFile(portrait.replace(/\.png$/, ".webp"));
  } catch (e) {
    console.warn(`Conversion WebP ignorée : ${e.message}`);
  }

  // Supprime les photos des biens retirés de la vente
  for (const d of await readdir(dossierPhotos)) {
    if (!annonces.some((a) => a.ref === d)) await rm(new URL(d, dossierPhotos), { recursive: true });
  }

  const sortie = { miseAJour: new Date().toISOString(), source: PAGE_NEGO, annonces };
  await writeFile(SORTIE, JSON.stringify(sortie, null, 2) + "\n");
  console.log(`Écrit ${annonces.length} annonce(s) dans site/data/annonces.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });

// Construit les pages du site (site/*.html) à partir des fichiers de ce dossier :
// _entete.html et _pied.html sont communs à toutes les pages, <page>.html contient le corps de chaque page.
// Le style est dans site/css/site.css et le code dans site/js/site.js.
// À relancer après chaque modification d'une page : npm run pages
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { chargerAnnonces, listeHTML, filtresHTML, corpsBien, grapheBien, esc as escHtml } from "./annonces.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const site = join(ici, "..", "site");
export const SITE_URL = "https://immobilier-normandie-nm.fr/";
const lire = (f) => readFileSync(join(ici, f), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const PAGES = [
  { fichier: "index.html", titre: "Nadine Malfilatre, conseillère immobilière à Honfleur et sur la Côte Normande",
    description: "Nadine Malfilatre, conseillère immobilière Propriétés Privées à Honfleur : estimation offerte, vente et achat de maisons et appartements à Honfleur, Beuzeville, Pont-l'Évêque et sur toute la Côte Normande." },
  { fichier: "biens.html", nom: "Biens à vendre", titre: "Maisons et appartements à vendre à Honfleur et alentours | N. Malfilatre",
    description: "Les biens à vendre de Nadine Malfilatre, conseillère Propriétés Privées : maisons et appartements à Honfleur, Beuzeville et sur la Côte Normande, prix honoraires inclus." },
  { fichier: "estimation.html", nom: "Estimation", titre: "Estimation immobilière gratuite Côte Normande | N. Malfilatre",
    description: "Estimez gratuitement votre maison ou votre appartement en Normandie à partir des ventes notariées (DVF), puis obtenez un avis de valeur offert par Nadine Malfilatre." },
  { fichier: "qui-suis-je.html", nom: "Qui suis-je ?", titre: "Qui suis-je ? Nadine Malfilatre, conseillère immobilière",
    description: "Nadine Malfilatre, 25 ans d'expérience dans l'immobilier, conseillère Propriétés Privées sur la Côte Normande : parcours, services et secteur." },
  { fichier: "apporteur-affaires.html", nom: "Apporteur d'affaires", titre: "Apporteur d'affaires immobilier Côte Normande | N. Malfilatre",
    description: "Recommandez un proche qui souhaite vendre son bien à Nadine Malfilatre : si la vente se conclut, vous êtes rémunéré à la signature chez le notaire." },
  { fichier: "faq.html", nom: "Questions fréquentes", titre: "Questions fréquentes immobilier | Nadine Malfilatre", faq: true,
    description: "Estimation gratuite, honoraires, secteur couvert, apporteur d'affaires : les réponses de Nadine Malfilatre, conseillère immobilière sur la Côte Normande." },
  { fichier: "contact.html", nom: "Contact", titre: "Contact : Nadine Malfilatre, immobilier Côte Normande",
    description: "Contactez Nadine Malfilatre, conseillère immobilière Propriétés Privées sur la Côte Normande : 06 81 51 62 89, ou par le formulaire en ligne." },
];

// Gabarit commun : <head>, en-tête, pied de page. base = "../" pour les pages rangées dans un sous-dossier (biens/).
function documentHTML({ titre, description, url, graphe, corps, actif, image, base, entete, pied }) {
  const menu = actif ? entete.replace(`<a href="${actif}">`, `<a href="${actif}" aria-current="page">`) : entete;
  const img = image || `${SITE_URL}img/partage.jpg`;
  const heroPreload = corps.includes("img/port-honfleur.jpg")
    ? `<link rel="preload" as="image" href="img/port-honfleur.jpg" imagesrcset="img/port-honfleur-1024.webp 1024w, img/port-honfleur-1920.webp 1920w" imagesizes="100vw" fetchpriority="high">\n` : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${base ? `<base href="${base}">\n` : ""}<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#13243F">
<link rel="icon" href="img/logo-nm.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="img/logo-nm-180.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Nadine Malfilatre Immobilier">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
${image ? "" : `<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
`}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titre)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graphe }, null, 1)}
</script>
${heroPreload}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&family=Playfair+Display:wght@500;600;700&display=swap">
<link rel="stylesheet" href="css/site.css">
</head>
<body>

${menu}
<main id="accueil">
${corps}</main>

${pied}
<script src="js/site.js" defer></script>
</body>
</html>
`;
}

const fil = (elements) => ({ "@type": "BreadcrumbList", itemListElement: elements.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });

// Bloc « Avis clients » : vrais avis repris de la fiche Google (pages/_avis.json)
function avisHTML(av) {
  const etoiles = (n) => `<span class="etoiles" aria-label="${n} sur 5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
  return `<section class="avis" aria-labelledby="titre-avis"><div class="wrap">
  <div class="head centre"><span class="eyebrow">Avis clients</span><h2 id="titre-avis">Ils m'ont fait confiance</h2>
    <p><strong>${escHtml(av.note)}/5 sur ${escHtml(av.source)}</strong> · ${av.nombre} avis · <a href="${escHtml(av.lien)}" target="_blank" rel="noopener">Lire tous les avis sur Google</a></p></div>
  <div class="avis-liste">
${av.avis.map((x) => `    <figure class="avis-carte">${etoiles(x.note)}<blockquote>« ${escHtml(x.texte)} »</blockquote><figcaption><b>${escHtml(x.auteur)}</b> · avis Google, ${escHtml(x.date)}</figcaption></figure>`).join("\n")}
  </div>
  <p class="note centre">Sélection d'avis publiés sur la fiche Google de Nadine Malfilatre, reproduits sans modification. Note et nombre d'avis relevés le ${new Date(av.releve).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}. Google ne vérifie pas les avis.</p>
</div></section>`;
}

export function construirePages() {
  const entete = lire("_entete.html"), pied = lire("_pied.html");
  const agent = JSON.parse(lire("_agent.json")), faq = JSON.parse(lire("_faq.json")), avis = JSON.parse(lire("_avis.json"));
  const annonces = chargerAnnonces();
  for (const p of PAGES) {
    const url = SITE_URL + (p.fichier === "index.html" ? "" : p.fichier);
    const graphe = [agent];
    if (p.faq) graphe.push(faq);
    if (p.nom) graphe.push(fil([["Accueil", SITE_URL], [p.nom, url]]));
    // Annonces écrites dans la page (plus de chargement par JavaScript)
    let corps = lire(p.fichier).replace(/\{\{annonces(?::(\d+))?\}\}/g, (m, lim) => listeHTML(annonces, +lim || 0).cartes)
      .replace("{{maj}}", listeHTML(annonces).maj).replace("{{filtres}}", annonces.annonces.length > 1 ? filtresHTML(annonces) : "").replace("{{nb}}", String(annonces.annonces.length)).replace("{{avis}}", avisHTML(avis));
    if (p.fichier === "biens.html" && annonces.annonces.length) {
      graphe.push({ "@type": "ItemList", name: "Biens à vendre", itemListElement: annonces.annonces.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + a.chemin, name: a.titreSeo })) });
    }
    writeFileSync(join(site, p.fichier), documentHTML({ titre: p.titre, description: p.description, url, graphe, corps, actif: p.fichier, entete, pied }));
  }
  // Une page par bien : site/biens/<type>-<ville>-<ref>.html (dossier recréé à chaque fois : un bien vendu disparaît)
  rmSync(join(site, "biens"), { recursive: true, force: true });
  mkdirSync(join(site, "biens"), { recursive: true });
  const fmt = new Intl.NumberFormat("fr-FR");
  for (const a of annonces.annonces) {
    const url = SITE_URL + a.chemin;
    const description = [a.titreSeo + (a.cp ? ` (${a.cp})` : ""), a.prix && `${fmt.format(a.prix)} €`, a.chambres && `${a.chambres} chambres`,
      a.terrain && `terrain ${fmt.format(a.terrain)} m²`, a.dpe && `DPE ${a.dpe}`].filter(Boolean).join(", ") + ". À vendre avec Nadine Malfilatre, conseillère Propriétés Privées.";
    const image = a.photos?.[0] ? (/^https?:/.test(a.photos[0]) ? a.photos[0] : SITE_URL + a.photos[0]) : null;
    const graphe = [agent, fil([["Accueil", SITE_URL], ["Biens à vendre", SITE_URL + "biens.html"], [a.titreSeo, url]]), grapheBien(a, url, agent["@id"])];
    writeFileSync(join(site, a.chemin), documentHTML({ titre: `${a.titreSeo} | ${a.prix ? fmt.format(a.prix) + " €" : "À vendre"}`, description, url, graphe,
      corps: corpsBien(a), actif: "biens.html", image, base: "../", entete, pied }));
  }
  return { pages: PAGES, annonces: annonces.annonces };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = construirePages();
  console.log(`Pages : ${r.pages.length} pages et ${r.annonces.length} page(s) de biens écrites dans site/`);
}

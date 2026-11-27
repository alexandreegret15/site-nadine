// Construit les pages du site (site/*.html) à partir des fichiers de ce dossier :
// _entete.html et _pied.html sont communs à toutes les pages, <page>.html contient le corps de chaque page.
// Le style est dans site/css/site.css et le code dans site/js/site.js.
// À relancer après chaque modification d'une page : npm run pages
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const site = join(ici, "..", "site");
export const SITE_URL = "https://immobilier-normandie-nm.fr/";
const lire = (f) => readFileSync(join(ici, f), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const PAGES = [
  { fichier: "index.html", titre: "Nadine Malfilatre, conseillère immobilière Côte Normande",
    description: "Nadine Malfilatre, conseillère immobilière Propriétés Privées depuis 25 ans sur la Côte Normande : estimation offerte, vente et achat de maisons et appartements en Normandie." },
  { fichier: "biens.html", nom: "Biens à vendre", titre: "Maisons et appartements à vendre Côte Normande | N. Malfilatre",
    description: "Les biens à vendre de Nadine Malfilatre, conseillère Propriétés Privées : maisons, appartements et terrains sur la Côte Normande." },
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

export function construirePages() {
  const entete = lire("_entete.html"), pied = lire("_pied.html");
  const agent = JSON.parse(lire("_agent.json")), faq = JSON.parse(lire("_faq.json"));
  for (const p of PAGES) {
    const url = SITE_URL + (p.fichier === "index.html" ? "" : p.fichier);
    const graphe = [agent];
    if (p.faq) graphe.push(faq);
    if (p.nom) graphe.push({ "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: p.nom, item: url }] });
    // Lien actif du menu
    const menu = entete.replace(`<a href="${p.fichier}">`, `<a href="${p.fichier}" aria-current="page">`);
    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.titre)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#13243F">
<link rel="icon" href="img/logo-nm.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="img/logo-nm-180.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Nadine Malfilatre Immobilier">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(p.titre)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:image" content="${SITE_URL}img/partage.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.titre)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${SITE_URL}img/partage.jpg">
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graphe }, null, 1)}
</script>
<link rel="preload" as="image" href="img/port-honfleur.jpg" imagesrcset="img/port-honfleur-1024.webp 1024w, img/port-honfleur-1920.webp 1920w" imagesizes="100vw" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&family=Playfair+Display:wght@500;600;700&display=swap">
<link rel="stylesheet" href="css/site.css">
</head>
<body>

${menu}
<main id="accueil">
${lire(p.fichier)}</main>

${pied}
<script src="js/site.js" defer></script>
</body>
</html>
`;
    writeFileSync(join(site, p.fichier), html);
  }
  return PAGES;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`Pages : ${construirePages().length} pages écrites dans site/`);
}

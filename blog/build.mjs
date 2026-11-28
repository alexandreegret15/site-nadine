// Construit la rubrique Actualités à partir des fichiers Markdown du dossier articles/.
// Pour chaque article : site/blog/<nom>.html. Plus la liste site/blog/index.html
// et site/blog/articles.json (lu par la page d'accueil pour afficher les 3 derniers).
// L'en-tête, le pied de page et tout le style sont repris de site/index.html :
// une modification de la charte sur l'accueil s'applique donc aussi au blog.
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { PAGES } from "../pages/build.mjs";
import { chargerAnnonces } from "../pages/annonces.mjs";
import { chargerCommunes } from "../pages/communes.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossierArticles = join(racine, "articles");
const site = join(racine, "site");
const sortie = join(site, "blog");

// Adresse publique du site (balises canoniques, partage et sitemap.xml)
export const SITE_URL = "https://immobilier-normandie-nm.fr/";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Les images sont enregistrées en /img/... (racine du site) ; les pages du blog sont un dossier plus bas.
export const cheminImage = (src, prefixe = "../") => {
  if (!src) return "";
  if (/^(https?:)?\/\//.test(src) || src.startsWith("data:")) return src;
  return prefixe + src.replace(/^\/+/, "").replace(/^site\//, "");
};

export function dateISO(d) {
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);
  const m = String(d ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}
const dateFR = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function slugDepuis(fichier) {
  return fichier.replace(/\.md$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "article";
}

export function lireArticle(fichier, contenu) {
  const { data, content } = matter(contenu);
  const date = dateISO(data.date) || dateISO(fichier) || new Date().toISOString().slice(0, 10);
  let html = marked.parse(content || "");
  html = html.replace(/(src|href)="\/(img|photos)\//g, '$1="../$2/');
  const texte = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    slug: slugDepuis(fichier),
    titre: String(data.title || data.titre || "Sans titre").trim(),
    date,
    categorie: String(data.categorie || "Actualité").trim(),
    image: data.image ? String(data.image).trim() : "",
    alt: String(data.alt || "").trim(),
    aVerifier: [].concat(data.a_verifier || []).map(String),
    resume: String(data.resume || "").trim() || texte.slice(0, 180).replace(/\s\S*$/, "") + "…",
    brouillon: data.brouillon === true || data.brouillon === "true",
    minutes: Math.max(1, Math.round(texte.split(" ").length / 200)),
    mots: texte.split(" ").length,
    modifie: dateISO(data.modifie) || null,
    html,
  };
}

// --- Gabarit commun repris de la page d'accueil ---
function gabarit() {
  const accueil = readFileSync(join(site, "index.html"), "utf8");
  const prendre = (re, nom) => { const m = accueil.match(re); if (!m) throw new Error(`Bloc ${nom} introuvable dans site/index.html`); return m[0]; };
  // Polices + feuille de style commune (chemin corrigé : les pages du blog sont un dossier plus bas)
  const style = prendre(/<link rel="preload" href="fonts\/[\s\S]*?<link rel="stylesheet" href="css\/site\.css">/, "style").replace(/href="(css|fonts)\//g, 'href="../$1/');
  let header = prendre(/<header>[\s\S]*?<\/header>/, "header");
  let footer = prendre(/<footer>[\s\S]*?<\/footer>/, "footer");
  // Liens relatifs du site (biens.html, img/…) : un dossier plus haut ; ceux du blog restent sur place
  const relatifs = (t) => t.replace(/(href|src|srcset)="(?![a-z]+:|#|\/)([^"]+)"/g, (m, attr, chemin) =>
    `${attr}="${chemin.startsWith("blog/") ? chemin.slice(5) : "../" + chemin}"`);
  footer = relatifs(footer);
  header = relatifs(header);
  return { style, header, footer };
}

const cssBlog = `<style>
a.brand{text-decoration:none}
nav a[aria-current]{color:var(--accent-text)}
.blog-hero .wrap{padding-block:48px 40px}
.blog-hero h1{font-size:clamp(2rem,5vw,3rem);margin-block:10px 14px;color:var(--ink)}
.blog-hero p.lead{color:var(--muted);font-size:1.1rem;max-width:36em}
.articles{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:24px}
.carte-article{background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s}
.carte-article:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(19,36,63,.12)}
.carte-article .couv{aspect-ratio:16/10;background:linear-gradient(150deg,var(--band),var(--line));position:relative;overflow:hidden;display:grid;place-items:center}
.carte-article .couv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.carte-article .couv .motif{font-family:var(--display);font-size:3.4rem;color:var(--gold,var(--accent));line-height:1}
.carte-article .info{padding:18px;display:flex;flex-direction:column;gap:8px;flex:1}
.carte-article h3{font-size:1.2rem}
.carte-article p{color:var(--muted);font-size:.93rem}
.carte-article .lire{margin-top:auto;padding-top:10px;font-weight:700;color:var(--accent-text);font-size:.92rem}
.meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:.82rem;color:var(--muted)}
.cat{background:var(--accent);color:#fff;font-weight:700;font-size:.75rem;padding:3px 11px;border-radius:999px}
.article-hero .wrap{max-width:780px;padding-block:44px 36px}
.article-hero h1{font-size:clamp(2rem,5vw,3rem);margin-block:14px 14px}
.article-hero p.lead{color:var(--muted);font-size:1.12rem}
.retour{font-weight:700;font-size:.9rem;text-decoration:none}
.retour:hover{text-decoration:underline}
.corps .wrap{max-width:780px;padding-block:40px 24px}
.couverture{border-radius:20px;overflow:hidden;margin-bottom:32px;aspect-ratio:16/9;background:var(--band)}
.couverture img{width:100%;height:100%;object-fit:cover;object-position:center 30%}
.prose{font-size:1.08rem;line-height:1.75}
.prose>*+*{margin-top:1.1em}
.prose h2{font-size:1.6rem;margin-top:1.8em;color:var(--accent-text)}
.prose h3{font-size:1.25rem;margin-top:1.5em}
.prose ul,.prose ol{padding-left:1.3em}
.prose li+li{margin-top:.35em}
.prose li::marker{color:var(--accent)}
.prose img{border-radius:14px;margin-inline:auto}
.prose blockquote{margin:1.6em 0;padding:18px 22px;background:var(--band);border-left:5px solid var(--accent);border-radius:0 14px 14px 0;font-weight:700;color:var(--warm)}
.prose blockquote p{margin:0}
.prose hr{border:0;border-top:1px solid var(--line);margin-block:2em}
.prose table{border-collapse:collapse;width:100%;font-size:.95rem;display:block;overflow-x:auto}
.prose th,.prose td{border:1px solid var(--line);padding:8px 10px;text-align:left}
.appel{margin-top:44px;background:var(--accent);color:#fff;border-radius:20px;padding:28px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.appel h2{color:#fff;font-size:1.5rem}
.appel p{opacity:.92;margin-top:6px}
.appel .btn{background:var(--pp);color:#fff;border-color:var(--pp)}
.appel .btn:hover{background:#C8103F;border-color:#C8103F;color:#fff}
.autres .wrap{padding-block:48px 64px}
.brouillon{background:#FFF4D6;border:2px dashed var(--gold);border-radius:14px;padding:16px 20px;margin-bottom:28px;font-size:.95rem}
.brouillon ul{margin:8px 0 0;padding-left:1.2em}
.autres h2{margin-bottom:24px}
</style>`;

function page({ titre, description, corps, actif, image, chemin, graphe }) {
  const url = SITE_URL + "blog/" + (chemin || "");
  const imgAbs = image ? new URL(image, url).href : SITE_URL + "img/partage.jpg";
  const g = gabarit();
  const header = actif ? g.header.replace(/(<a href="index\.html")/, '$1 aria-current="page"') : g.header;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="../img/logo-nm.svg" type="image/svg+xml">
<meta property="og:type" content="${chemin ? "article" : "website"}">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imgAbs)}">
<meta name="twitter:card" content="summary_large_image">
${graphe ? `<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": graphe }, null, 1)}\n</script>\n` : ""}${g.style}
${cssBlog}
</head>
<body>
${header}
${corps}
${g.footer}
</body>
</html>
`;
}

function carte(a, prefixe = "") {
  const img = a.image ? `<img src="${esc(cheminImage(a.image, prefixe ? prefixe : "../"))}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<a class="carte-article" href="${prefixe}${a.slug}.html">
  <div class="couv"><span class="motif">“</span>${img}</div>
  <div class="info">
    <div class="meta"><span class="cat">${esc(a.categorie)}</span><time datetime="${a.date}">${dateFR(a.date)}</time></div>
    <h3>${esc(a.titre)}</h3>
    <p>${esc(a.resume)}</p>
    <span class="lire">Lire l'article →</span>
  </div>
</a>`;
}

const appel = `<div class="appel"><div><h2>Un projet immobilier ?</h2><p>Estimation offerte, sans engagement. Je vous réponds rapidement.</p></div>
<a class="btn" href="../contact.html">Me contacter</a></div>`;

export function construire() {
  const fichiers = existsSync(dossierArticles) ? readdirSync(dossierArticles).filter((f) => f.toLowerCase().endsWith(".md")) : [];
  const articles = fichiers
    .map((f) => lireArticle(f, readFileSync(join(dossierArticles, f), "utf8")))
    // Brouillons : jamais publiés ; visibles seulement dans l'aperçu (BROUILLONS=1 npm run blog)
    .filter((a) => !a.brouillon || process.env.BROUILLONS === "1")
    .sort((a, b) => b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre));

  // deux articles au même nom : on numérote
  const vus = new Map();
  for (const a of articles) { const n = vus.get(a.slug) || 0; vus.set(a.slug, n + 1); if (n) a.slug += "-" + (n + 1); }

  rmSync(sortie, { recursive: true, force: true });
  mkdirSync(sortie, { recursive: true });

  const liste = articles.length
    ? `<div class="articles">${articles.map((a) => carte(a, "")).join("\n")}</div>`
    : `<div class="vide">Aucun article pour le moment. Revenez bientôt !</div>`;
  writeFileSync(join(sortie, "index.html"), page({
    titre: "Actualités et conseils immobiliers · Nadine Malfilatre",
    chemin: "",
    description: "Conseils, actualités du marché et nouveautés de Nadine Malfilatre, conseillère immobilière sur la Côte Normande.",
    actif: true,
    graphe: [{ "@type": "Blog", "@id": SITE_URL + "blog/#blog", name: "Actualités et conseils immobiliers", url: SITE_URL + "blog/", inLanguage: "fr-FR",
      author: { "@id": SITE_URL + "#personne" }, blogPost: articles.filter((a) => !a.brouillon).map((a) => ({ "@id": SITE_URL + "blog/" + a.slug + ".html#article" })) }],
    corps: `<section class="blog-hero band"><div class="wrap">
  <span class="eyebrow">Actualités</span>
  <h1>Conseils et nouvelles de l'immobilier normand</h1>
  <p class="lead">Mes conseils pour vendre ou acheter, l'actualité du marché sur la Côte Normande, et les nouveautés de mon activité.</p>
</div></section>
<section><div class="wrap">${liste}</div></section>`,
  }));

  for (const a of articles) {
    const autres = articles.filter((x) => x !== a).slice(0, 3);
    const couv = a.image ? `<div class="couverture"><img src="${esc(cheminImage(a.image))}" alt="${esc(a.alt)}" onerror="this.parentNode.remove()"></div>` : "";
    writeFileSync(join(sortie, a.slug + ".html"), page({
      titre: `${a.titre} · Nadine Malfilatre`,
      chemin: a.slug + ".html",
      description: a.resume,
      image: a.image ? cheminImage(a.image) : "",
      actif: true,
      graphe: [{
        "@type": "BlogPosting", "@id": SITE_URL + "blog/" + a.slug + ".html#article", headline: a.titre, description: a.resume,
        datePublished: a.date, dateModified: a.modifie || a.date, inLanguage: "fr-FR",
        mainEntityOfPage: SITE_URL + "blog/" + a.slug + ".html",
        ...(a.image ? { image: new URL(cheminImage(a.image, ""), SITE_URL).href } : {}),
        author: { "@id": SITE_URL + "#personne", "@type": "Person", name: "Nadine Malfilatre", url: SITE_URL + "qui-suis-je.html" },
        publisher: { "@id": SITE_URL + "#nadine" },
        wordCount: a.mots,
      }, { "@type": "BreadcrumbList", itemListElement: [["Accueil", SITE_URL], ["Actualités", SITE_URL + "blog/"], [a.titre, SITE_URL + "blog/" + a.slug + ".html"]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) }],
      corps: `<section class="article-hero band"><div class="wrap">
  <a class="retour" href="index.html">← Toutes les actualités</a>
  <h1>${esc(a.titre)}</h1>
  <div class="meta"><span class="cat">${esc(a.categorie)}</span><time datetime="${a.date}">${dateFR(a.date)}</time><span>· ${a.minutes} min de lecture</span></div>
</div></section>
<section class="corps"><div class="wrap">
  ${a.brouillon ? `<div class="brouillon"><b>Brouillon, non publié : à relire par Nadine.</b>${a.aVerifier.length ? `<ul>${a.aVerifier.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : ""}
  ${couv}
  <article class="prose">
${a.html}
  </article>
  ${appel}
</div></section>
${autres.length ? `<section class="autres band"><div class="wrap"><h2>À lire aussi</h2><div class="articles">${autres.map((x) => carte(x, "")).join("\n")}</div></div></section>` : ""}`,
    }));
  }

  // Plan du site pour les moteurs de recherche (accueil + actualités)
  const auj = new Date().toISOString().slice(0, 10);
  const urls = [...PAGES.map((p) => [SITE_URL + (p.fichier === "index.html" ? "" : p.fichier), auj, p.fichier === "index.html" ? "1.0" : "0.8"]),
    [SITE_URL + "blog/", articles[0]?.date || auj, "0.6"],
    ...articles.filter((a) => !a.brouillon).map((a) => [SITE_URL + "blog/" + a.slug + ".html", a.date, "0.5"]),
    ...chargerCommunes().map((c) => [SITE_URL + c.fichier, auj, "0.8"]),
    // Une page par bien à vendre (date = dernière mise à jour des annonces)
    ...(() => { const d = chargerAnnonces(); const j = (d.miseAJour || auj).slice(0, 10); return d.annonces.map((a) => [SITE_URL + a.chemin, j, "0.7"]); })()];
  writeFileSync(join(site, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d, p]) => `  <url><loc>${esc(u)}</loc><lastmod>${d}</lastmod><priority>${p}</priority></url>`).join("\n")}
</urlset>
`);

  writeFileSync(join(sortie, "articles.json"), JSON.stringify({
    articles: articles.filter((a) => !a.brouillon).map(({ html, brouillon, aVerifier, alt, mots, modifie, ...reste }) => ({ ...reste, image: cheminImage(reste.image, ""), url: `blog/${reste.slug}.html` })),
  }, null, 2));
  return articles;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = construire();
  console.log(`Blog : ${a.length} article(s) publié(s) dans site/blog/`);
}

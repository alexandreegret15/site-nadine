// Pages « Immobilier à <commune> » : prix au m² tirés des ventes notariées (DVF, site/data/prix-communes.json),
// biens en vente dans la commune et alentours, questions fréquentes locales. Réglages dans pages/_communes.json.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { carte, esc } from "./annonces.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const fmt = new Intl.NumberFormat("fr-FR");
const eur = (n) => `${fmt.format(Math.round(n))} €`;
const TRANCHES = ["moins de 300 m²", "300 à 800 m²", "800 à 1 500 m²", "1 500 à 3 000 m²", "plus de 3 000 m²"];

export function chargerCommunes() {
  const conf = JSON.parse(readFileSync(join(ici, "_communes.json"), "utf8")).communes;
  const dvf = JSON.parse(readFileSync(join(ici, "..", "site", "data", "prix-communes.json"), "utf8"));
  const annee = (s) => s.slice(0, 4);
  const periode = `${annee(dvf.periode[0])}-${annee(dvf.periode[1])}`;
  return conf.map((c) => {
    const d = dvf.communes.find((x) => x.n === c.nom && x.cp === c.cp) || dvf.communes.find((x) => x.n === c.nom) || {};
    // Une statistique n'est publiée que si elle repose sur des ventes de la commune elle-même (pas élargie aux alentours)
    const propre = (s) => (s && !s.r ? s : null);
    return { ...c, M: propre(d.M), A: propre(d.A), periode, calcule: dvf.calcule };
  });
}

const ligneP = (s, cle, label) => (s?.p?.[cle] ? `<tr><td>${label}</td><td>${eur(s.p[cle][0])}/m²</td><td>${s.p[cle][1]}</td></tr>` : "");

export function corpsCommune(c, toutes, annonces) {
  const { nom } = c;
  const deNom = /^[AEIOUYÉÈÂ]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
  const phrasePrix = [c.M && `une maison s'est vendue en moyenne autour de ${eur(c.M.m)} le m² (prix médian, ${c.M.n} ventes)`,
    c.A && `un appartement autour de ${eur(c.A.m)} le m² (${c.A.n} ventes)`].filter(Boolean).join(", et ");
  const ex = c.M ? `Pour une maison de 100 m², cela donne un prix médian d'environ ${eur(c.M.m * 100)}, à ajuster selon l'état, le terrain et l'emplacement.` : "";
  const tableType = `<table><thead><tr><th>Type de bien</th><th>Prix médian</th><th>Ventes</th></tr></thead><tbody>
${c.M ? `<tr><td>Maison</td><td>${eur(c.M.m)}/m²</td><td>${c.M.n}</td></tr>` : ""}${c.A ? `<tr><td>Appartement</td><td>${eur(c.A.m)}/m²</td><td>${c.A.n}</td></tr>` : ""}
</tbody></table>`;
  const lignesPieces = (s, t) => ["1", "2", "3", "4", "5"].map((k) => ligneP(s, k, `${t} ${k === "5" ? "5 pièces et +" : k + (k === "1" ? " pièce" : " pièces")}`)).join("");
  const piecesHTML = lignesPieces(c.M, "Maison") + lignesPieces(c.A, "Appartement");
  const terrains = c.M?.t ? Object.entries(c.M.t).map(([k, v]) => `<tr><td>Maison, terrain de ${TRANCHES[+k]}</td><td>${eur(v[0])}/m²</td><td>${v[1]}</td></tr>`).join("") : "";
  // Biens de la commune, puis ceux du même code postal (alentours)
  const ici = annonces.filter((a) => a.ville === nom);
  const autour = annonces.filter((a) => a.ville !== nom && a.cp === c.cp);
  const biens = [...ici, ...autour];
  const comparaison = toutes.map((x) => `<tr><td>${x.nom === nom ? `<strong>${esc(x.nom)}</strong>` : `<a href="${x.fichier}">${esc(x.nom)}</a>`}</td><td>${x.M ? eur(x.M.m) + "/m²" : "–"}</td><td>${x.A ? eur(x.A.m) + "/m²" : "–"}</td></tr>`).join("");
  const faq = questionsCommune(c);
  return `<section class="page-hero">
  <img src="img/port-honfleur.jpg" srcset="img/port-honfleur-1024.webp 1024w, img/port-honfleur-1920.webp 1920w" sizes="100vw" alt="" width="1920" height="1159" fetchpriority="high" decoding="async">
  <div class="wrap">
    <nav class="ariane" aria-label="Fil d'Ariane"><a href="index.html">Accueil</a><span aria-hidden="true">›</span><a href="qui-suis-je.html#secteur">Mon secteur</a><span aria-hidden="true">›</span><span aria-current="page">${esc(nom)}</span></nav>
    <h1>Immobilier à ${esc(nom)} : prix au m² et biens à vendre</h1>
    <p class="lead">${esc(c.situation)} Nadine Malfilatre, conseillère Propriétés Privées, vous accompagne pour vendre, acheter ou estimer un bien à ${esc(nom)} (${esc(c.cp)}).</p>
  </div>
</section>
<section class="commune"><div class="wrap commune-grille">
  <div class="commune-texte">
    <h2>Prix de l'immobilier à ${esc(nom)}</h2>
    <p class="chapeau">À ${esc(nom)}, sur les ventes signées chez le notaire en ${c.periode}, ${phrasePrix}.</p>
    ${ex ? `<p>${ex}</p>` : ""}
    <div class="table-defile">${tableType}</div>
    ${piecesHTML ? `<h3>Selon le nombre de pièces</h3><div class="table-defile"><table><thead><tr><th>Bien</th><th>Prix médian</th><th>Ventes</th></tr></thead><tbody>${piecesHTML}</tbody></table></div>` : ""}
    ${terrains ? `<h3>Maisons selon la taille du terrain</h3><div class="table-defile"><table><thead><tr><th>Bien</th><th>Prix médian</th><th>Ventes</th></tr></thead><tbody>${terrains}</tbody></table></div>` : ""}
    <p class="note">Source : ventes de maisons et d'appartements enregistrées en ${c.periode} dans la base publique <a href="https://app.dvf.etalab.gouv.fr/" target="_blank" rel="noopener">DVF</a> (DGFiP), calcul du ${new Date(c.calcule).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}. Prix médian : la moitié des ventes s'est faite au-dessus, l'autre moitié en dessous. Les catégories de moins de 6 ventes ne sont pas affichées.</p>
    ${c.motNadine ? `<h2>Le marché ${esc(deNom)} vu par Nadine</h2><blockquote class="mot">« ${esc(c.motNadine)} »<cite>Nadine Malfilatre</cite></blockquote>` : ""}
  </div>
  <aside class="commune-cote">
    <div class="bien-contact">
      <b>Vous vendez à ${esc(nom)} ?</b>
      <p>Estimation en ligne en 30 secondes, puis avis de valeur offert après visite.</p>
      <a class="btn or" href="estimation.html">Estimer mon bien</a>
      <a class="btn ghost" href="tel:+33681516289">06 81 51 62 89</a>
    </div>
    <div class="carac comparer"><b>Prix médian au m² du secteur</b>
      <table><thead><tr><th>Commune</th><th>Maison</th><th>Appart.</th></tr></thead><tbody>${comparaison}</tbody></table>
    </div>
  </aside>
</div></section>
<section class="band"><div class="wrap" style="padding-block:56px">
  <div class="head"><span class="eyebrow">À vendre</span><h2>Biens à vendre à ${esc(nom)}${autour.length ? " et alentours" : ""}</h2></div>
  ${biens.length ? `<div class="biens">${biens.map(carte).join("\n")}</div>` : `<div class="vide">Aucun bien à ${esc(nom)} en ce moment. <a href="contact.html">Dites-moi ce que vous cherchez</a> : je vous préviens dès qu'un bien correspond.</div>`}
  <div class="tout"><a class="btn primary" href="biens.html">Voir tous les biens à vendre</a></div>
</div></section>
<section id="faq"><div class="wrap" style="padding-block:56px">
  <div class="head"><span class="eyebrow">Questions fréquentes</span><h2>Vendre ou acheter à ${esc(nom)}</h2></div>
  <div class="faq">
${faq.map((q) => `    <details><summary>${esc(q.q)}</summary><p>${esc(q.r)}</p></details>`).join("\n")}
  </div>
</div></section>`;
}

export function questionsCommune(c) {
  const q = [];
  if (c.M || c.A) q.push({ q: `Quel est le prix au m² à ${c.nom} ?`, r: [c.M && `Maisons : ${eur(c.M.m)} le m² en prix médian (${c.M.n} ventes)`, c.A && `appartements : ${eur(c.A.m)} le m² (${c.A.n} ventes)`].filter(Boolean).join(" ; ") + `, sur les ventes notariées de ${c.periode} (base DVF). Chaque bien reste différent : une visite permet un avis de valeur précis.` });
  q.push({ q: `Combien vaut ma maison à ${c.nom} ?`, r: `L'estimation en ligne donne une fourchette en 30 secondes à partir des ventes réelles de ${c.nom}. Pour un prix précis, Nadine Malfilatre se déplace et vous remet un avis de valeur écrit, gratuit et sans engagement.` });
  q.push({ q: `Nadine Malfilatre intervient-elle à ${c.nom} ?`, r: `Oui. Elle accompagne vendeurs et acquéreurs à ${c.nom} et sur la Côte Normande, se déplace chez vous et reste votre seule interlocutrice jusqu'à la signature chez le notaire. Téléphone : 06 81 51 62 89.` });
  return q;
}

export function grapheCommune(c, url) {
  return { "@type": "FAQPage", "@id": url + "#faq", mainEntity: questionsCommune(c).map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.r } })) };
}

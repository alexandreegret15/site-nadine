// Test hors ligne de la lecture des articles du blog.
import assert from "node:assert/strict";
import { lireArticle, slugDepuis, cheminImage, dateISO } from "./build.mjs";

assert.equal(slugDepuis("2026-11-18-Bienvenue-sur-mon-Site-é.md"), "bienvenue-sur-mon-site-e");
assert.equal(cheminImage("/img/blog/a.jpg"), "../img/blog/a.jpg");
assert.equal(cheminImage("/img/blog/a.jpg", ""), "img/blog/a.jpg");
assert.equal(cheminImage("https://x.fr/a.jpg"), "https://x.fr/a.jpg");
assert.equal(dateISO(new Date("2026-11-18")), "2026-11-18");

const a = lireArticle("2026-11-18-essai.md", `---
title: "Essai : l'été"
date: 2026-11-18
categorie: Conseil
brouillon: true
---
## Titre
Texte avec ![photo](/img/blog/p.jpg) et <strong>du HTML</strong>.`);
assert.equal(a.titre, "Essai : l'été");
assert.equal(a.date, "2026-11-18");
assert.equal(a.brouillon, true);
assert.match(a.html, /<h2>Titre<\/h2>/);
assert.match(a.html, /src="\.\.\/img\/blog\/p\.jpg"/);
assert.match(a.html, /<strong>du HTML<\/strong>/);
assert.ok(a.resume.length > 0);
console.log("Blog : tests OK");

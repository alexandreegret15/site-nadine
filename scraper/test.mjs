// Test hors ligne de l'extraction, sur une page imitant la structure observée le 03/11/2026.
// À compléter avec une vraie page enregistrée (curl … > scraper/exemple-annonce.html).
import assert from "node:assert/strict";
import { extraireReferences, extraireAnnonce } from "./fetch-annonces.mjs";

const nego = `<a href="/annonces/466586NMAL">Plateau</a><a href="/annonces/466586NMAL">x</a><a href="/annonces/470001NMAL">y</a>`;
assert.deepEqual(extraireReferences(nego), ["466586NMAL", "470001NMAL"]);

const img = (n) => `https://images.proprietes-privees.com/annonce/466586NMAL/PROPRIETES-PRIVEES-466586NMAL-${n}.jpg`;
const annonce = `<html><head><meta property="og:description" content="Grand grenier brut"></head><body>
<span>Exclusivité</span><h1>Plateau à aménager</h1><p>Beuzeville (27210)</p>
<p>99 900 €</p><p>1 040 €/m²</p><p>96 m²</p><p>1 p</p>
<img src="/_ipx/w_1536&f_jpeg/${img(2)}"><img src="${img(1)}"><img src="${img(2)}"><img src="${img(10)}">
<div class="annonce-description">Actuellement à l'état brut, ce plateau offre de nombreuses possibilités.</div>
</body></html>`;
const a = extraireAnnonce(annonce, "466586NMAL");
assert.equal(a.titre, "Plateau à aménager");
assert.equal(a.ville, "Beuzeville");
assert.equal(a.cp, "27210");
assert.equal(a.prix, 99900);
assert.equal(a.surface, 96);
assert.equal(a.pieces, 1);
assert.equal(a.exclusivite, true);
assert.deepEqual(a.photos, [img(1), img(2), img(10)]);
assert.match(a.description, /état brut/);
console.log("OK : extraction validée sur la page d'exemple");

// Code commun à toutes les pages du site (chaque bloc ne s'exécute que si sa section est présente).
var TEL = "06 81 51 62 89", MAIL = "n.malfilatre@proprietes-privees.com";
var fmt = new Intl.NumberFormat("fr-FR");
function el(tag, cls, txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

// Ville absente de certaines annonces : on la déduit du titre (« Appartement Le Havre 4 pièce(s) »).
function villeDe(a){
  if (a.ville) return a.ville;
  var m = String(a.titre || "").match(/^\S+\s+(.+?)\s+\d+\s+pi[eè]ce/i);
  return m ? m[1] : "";
}
function carte(a){
  var ville = villeDe(a), titre = String(a.titre || "Bien").replace(/pièce\(s\)/i, a.pieces > 1 ? "pièces" : "pièce");
  var art = el("article","bien");
  var ph = el("div","photo"); ph.textContent = "Photo indisponible";
  if (a.photos && a.photos.length){
    var pic = document.createElement("picture");
    if (a.vignette){ var so = document.createElement("source"); so.srcset = a.vignette; so.type = "image/webp"; pic.appendChild(so); }
    var img = el("img"); img.src = a.photos[0]; img.alt = titre + (ville ? " à " + ville : ""); img.loading = "lazy"; img.decoding = "async"; img.width = 800; img.height = 533;
    img.onerror = function(){ pic.remove(); };
    pic.appendChild(img); ph.appendChild(pic);
    if (a.photos.length > 1) ph.appendChild(el("span","nb", a.photos.length + " photos"));
  }
  if (a.exclusivite) ph.appendChild(el("span","tag","Exclusivité"));
  art.appendChild(ph);

  var info = el("div","info");
  info.appendChild(el("h3", null, titre));
  if (ville) info.appendChild(el("span","lieu", ville + (a.cp ? " (" + a.cp + ")" : "")));
  var specs = el("div","specs");
  if (a.surface) specs.appendChild(el("span", null, fmt.format(a.surface) + " m²"));
  if (a.pieces) specs.appendChild(el("span", null, a.pieces + (a.pieces > 1 ? " pièces" : " pièce")));
  if (a.chambres) specs.appendChild(el("span", null, a.chambres + " ch."));
  if (a.terrain) specs.appendChild(el("span", null, "Terrain " + fmt.format(a.terrain) + " m²"));
  specs.appendChild(el("span", null, "Réf. " + a.ref));
  info.appendChild(specs);
  var desc = String(a.description || "").replace(/^\s*Description\s*/i, "");
  if (desc) info.appendChild(el("p","desc", desc));

  var bottom = el("div","bottom");
  var prix = el("span","prix", a.prix ? fmt.format(a.prix) + " €" : "Prix sur demande");
  if (a.prix && a.surface) prix.appendChild(el("small", null, fmt.format(Math.round(a.prix / a.surface)) + " €/m²"));
  bottom.appendChild(prix);
  if (a.dpe) bottom.appendChild(el("span","dpe " + a.dpe, "DPE " + a.dpe));
  var lien = el("a","voir","Voir l'annonce →"); lien.href = a.url; lien.target = "_blank"; lien.rel = "noopener"; lien.setAttribute("aria-label", "Voir l'annonce : " + titre + (ville ? " à " + ville : ""));
  bottom.appendChild(lien);
  info.appendChild(bottom);
  art.appendChild(info);
  return art;
}

// ---- Annonces ----
(function(){
  if (!document.getElementById("liste")) return;
fetch("data/annonces.json", {cache:"no-store"})
  .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(function(d){
    var liste = document.getElementById("liste");
    var n = d.annonces.length;
    var date = new Date(d.miseAJour).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
    var nb = document.getElementById("nb-biens"); if (nb) nb.textContent = n;
    document.getElementById("maj").textContent = n + (n > 1 ? " biens en vente" : " bien en vente") + " · liste mise à jour le " + date + ".";
    if (!n){ liste.appendChild(el("div","vide","Aucun bien en vente en ce moment. Contactez-moi pour être prévenu des nouveautés.")); return; }
    var lim = +liste.getAttribute("data-limite") || n;
    d.annonces.slice(0, lim).forEach(function(a){ liste.appendChild(carte(a)); });
  })
  .catch(function(){
    document.getElementById("maj").textContent = "Les annonces n'ont pas pu être chargées. Réessayez dans un instant ou appelez-moi au 06 81 51 62 89.";
  });

})();

(function(){
  if (!document.getElementById("actus")) return;
// Trois derniers articles du blog (fichier généré par blog/build.mjs). Section masquée s'il n'y en a pas.
fetch("blog/articles.json", {cache:"no-store"})
  .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(function(d){
    var l = (d.articles || []).slice(0,3); if (!l.length) return;
    var box = document.getElementById("actus");
    l.forEach(function(a){
      var c = el("a","actu"); c.href = a.url;
      var cv = el("div","couv"); cv.appendChild(el("span",null,"\u201C"));
      if (a.image){ var i = el("img"); i.src = a.image; i.alt = ""; i.loading = "lazy"; i.onerror = function(){ i.remove(); }; cv.appendChild(i); }
      c.appendChild(cv);
      var inf = el("div","info"), m = el("div","meta");
      m.appendChild(el("span","cat",a.categorie));
      m.appendChild(el("span",null,new Date(a.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})));
      inf.appendChild(m); inf.appendChild(el("h3",null,a.titre)); inf.appendChild(el("p",null,a.resume));
      c.appendChild(inf); box.appendChild(c);
    });
    document.getElementById("actualites").hidden = false;
  })
  .catch(function(){});

})();

// Envoi des formulaires par Web3Forms (https://web3forms.com). La clé ci-dessous n'est pas secrète :
// elle est rattachée au compte Web3Forms d'Alexandre : les demandes arrivent dans son Gmail, qui les transfère à Nadine.
var WEB3FORMS_KEY = "a8670c8d-d84f-43ed-8e9e-0b35e9b24f22";
function envoyerDemande(donnees, msg, bouton, ok){
  bouton.disabled = true; msg.hidden = false; msg.textContent = "Envoi en cours…";
  var envoi = {access_key: WEB3FORMS_KEY, subject: donnees._subject, from_name: "Site Nadine Malfilatre Immobilier"};
  if (donnees._replyto) envoi.replyto = donnees._replyto;
  Object.keys(donnees).forEach(function(k){ if (k.charAt(0) !== "_") envoi[k] = donnees[k]; });
  // Au-delà de 15 s sans réponse du service, on abandonne et on propose l'envoi par e-mail.
  var ctl = window.AbortController ? new AbortController() : null;
  if (ctl) setTimeout(function(){ ctl.abort(); }, 15000);
  fetch("https://api.web3forms.com/submit", {method:"POST", signal: ctl ? ctl.signal : undefined, headers:{"Content-Type":"application/json","Accept":"application/json"}, body:JSON.stringify(envoi)})
    .then(function(r){ return r.json().then(function(j){ if(!r.ok || String(j.success) !== "true") throw new Error(j.message || r.status); }); })
    .then(function(){
      // Confirmation bien visible : le formulaire est remplacé par un encadré de remerciement.
      var form = bouton.form, box = document.createElement("div");
      box.className = "merci"; box.setAttribute("role", "status");
      box.innerHTML = '<span class="merci-ic" aria-hidden="true">✓</span><strong>Demande envoyée</strong><p></p>';
      box.querySelector("p").textContent = ok;
      form.parentNode.replaceChild(box, form);
      box.scrollIntoView({behavior: "smooth", block: "center"});
    })
    .catch(function(err){
      // Si le service d'envoi refuse (activation en attente, panne…), on propose d'envoyer la même demande
      // depuis la messagerie du visiteur : rien n'est perdu.
      if (window.console) console.warn("Formulaire :", err && err.message);
      var corps = Object.keys(donnees).filter(function(k){ return k.charAt(0) !== "_" && donnees[k]; })
        .map(function(k){ return k + " : " + donnees[k]; }).join("\n");
      var lien = "mailto:" + MAIL + "?subject=" + encodeURIComponent(donnees._subject.replace(/^Site : /, "")) + "&body=" + encodeURIComponent("Bonjour Nadine,\n\n" + corps + "\n\nMerci de me recontacter.");
      msg.textContent = "L'envoi automatique n'a pas abouti. Cliquez ici pour envoyer la même demande depuis votre messagerie, ou appelez Nadine au " + TEL + ". ";
      var a = document.createElement("a"); a.href = lien; a.className = "btn primary"; a.textContent = "Envoyer ma demande par e-mail"; a.style.marginTop = ".6rem";
      msg.appendChild(document.createElement("br")); msg.appendChild(a);
      bouton.disabled = false; });
}
(function(){
  if (!document.getElementById("f")) return;
document.getElementById("f").addEventListener("submit",function(e){
  e.preventDefault();
  var v=function(id){return document.getElementById(id).value.trim();};
  var m=document.getElementById("msg"),n=v("nom"),a=v("mail");
  m.hidden=false;
  if(!n||!a||a.indexOf("@")<1){m.textContent="Indiquez votre nom et une adresse e-mail valide.";return;}
  envoyerDemande({_subject:"Site : nouvelle demande de contact – " + v("prenom") + " " + n, _replyto:a,
    "Prénom":v("prenom"), "Nom":n, "Téléphone":v("tel"), "E-mail":a, "Projet":v("projet"), "Message":v("message")},
    m, e.target.querySelector("button"), "Merci ! Votre demande est bien envoyée, Nadine vous recontacte très vite.");
});

})();

(function(){
  if (!document.getElementById("fa")) return;
// Formulaire « apporteur d'affaires »
document.getElementById("fa").addEventListener("submit", function(e){
  e.preventDefault();
  var f = e.target, msg = f.querySelector(".msg"), v = function(n){ return f[n].value.trim(); };
  msg.hidden = false;
  if (!v("an") || (!v("at") && v("am").indexOf("@") < 1)) { msg.textContent = "Indiquez votre nom et un téléphone ou un e-mail pour que Nadine puisse vous joindre."; return; }
  if (!v("cn") || !v("ct")) { msg.textContent = "Indiquez le nom et le téléphone de la personne qui souhaite vendre."; return; }
  if (!f.ok.checked) { msg.textContent = "Cochez la case : la personne doit être d'accord pour être contactée."; return; }
  envoyerDemande({_subject:"Site : recommandation apporteur d'affaires – " + v("ap") + " " + v("an"), _replyto:v("am"),
    "Apporteur – Prénom":v("ap"), "Apporteur – Nom":v("an"), "Apporteur – Téléphone":v("at"), "Apporteur – E-mail":v("am"),
    "Vendeur recommandé – Nom":v("cn"), "Vendeur recommandé – Téléphone":v("ct"), "Commune du bien":v("cv")},
    msg, f.querySelector("button"), "Merci pour votre recommandation ! Nadine vous recontacte très vite pour vous expliquer la suite.");
});

})();

(function(){
  if (!document.getElementById("fe")) return;
// ---- Outil d'estimation ----
// Prix médians au m² calculés par estimation/build-prix.mjs à partir des ventes DVF (DGFiP, data.gouv.fr).
var COMMUNES = [], PERIODE = null, TRANCHES = [300,800,1500,3000], RATIO_T = {}, choisie = null, actif = -1;
var inp = document.getElementById("e-ville"), sugg = document.getElementById("e-sugg"), info = document.getElementById("e-ville-info"), btnLoc = document.getElementById("e-loc");
function sansAccent(t){ return t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[-'’]/g," ").replace(/\bst\b/g,"saint").replace(/\s+/g," ").trim(); }
function arr(x){ return Math.round(x/1000)*1000; }
function moisAnnee(d){ return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}); }

fetch("data/prix-communes.json").then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
  COMMUNES = d.communes; PERIODE = d.periode; TRANCHES = d.tranchesTerrain || TRANCHES; RATIO_T = d.ratioTerrain || {};
  COMMUNES.forEach(function(c){ c.k = sansAccent(c.n); });
  inp.disabled = false; btnLoc.disabled = false;
  info.textContent = "Tapez les premières lettres de votre commune, ou utilisez votre position.";
}).catch(function(){ info.textContent = "Les prix n'ont pas pu être chargés. Appelez-moi au " + TEL + " pour une estimation."; });

function choisir(c, via){
  choisie = c; inp.value = c.n + " (" + c.cp.split(" ")[0] + ")";
  fermer(); info.className = "aide ok";
  info.textContent = (via ? via + " : " : "") + c.n + ", " + c.cp + ".";
}
function fermer(){ sugg.hidden = true; inp.setAttribute("aria-expanded","false"); actif = -1; }
function proposer(){
  choisie = null; info.className = "aide"; info.textContent = "";
  var q = sansAccent(inp.value); sugg.textContent = "";
  if (q.length < 2) { fermer(); return; }
  var num = /^\d+$/.test(q), res = COMMUNES.filter(function(c){ return num ? c.cp.indexOf(q) >= 0 || c.c.indexOf(q) === 0 : (c.k.indexOf(q) === 0 || c.k.indexOf(" " + q) >= 0); });
  res.sort(function(a,b){ return (b.k.indexOf(q)===0) - (a.k.indexOf(q)===0) || a.n.length - b.n.length; });
  res = res.slice(0,8);
  if (!res.length) { sugg.appendChild(el("li",null,"Aucune commune de Normandie ne correspond.")); }
  res.forEach(function(c,i){
    var li = el("li"); li.setAttribute("role","option"); li.appendChild(el("span",null,c.n)); li.appendChild(el("small",null,c.cp));
    li.addEventListener("mousedown", function(e){ e.preventDefault(); choisir(c); });
    li._c = c; sugg.appendChild(li);
  });
  sugg.hidden = false; inp.setAttribute("aria-expanded","true");
}
inp.addEventListener("input", proposer);
inp.addEventListener("blur", function(){ setTimeout(fermer, 100); });
inp.addEventListener("keydown", function(e){
  var items = [].slice.call(sugg.querySelectorAll("li")).filter(function(l){ return l._c; });
  if (sugg.hidden || !items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); actif = (actif + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items.forEach(function(l,i){ l.setAttribute("aria-selected", i === actif); }); }
  else if (e.key === "Enter") { e.preventDefault(); choisir(items[Math.max(actif,0)]._c); }
  else if (e.key === "Escape") fermer();
});
function km(a,b,c,d){ var r=Math.PI/180, x=(d-b)*r*Math.cos((a+c)/2*r), y=(c-a)*r; return 6371*Math.hypot(x,y); }
btnLoc.addEventListener("click", function(){
  if (!navigator.geolocation) { info.className = "aide"; info.textContent = "La localisation n'est pas disponible sur cet appareil : tapez le nom de votre commune."; return; }
  info.className = "aide"; info.textContent = "Recherche de votre position…";
  navigator.geolocation.getCurrentPosition(function(pos){
    var la = pos.coords.latitude, lo = pos.coords.longitude, best = null, dmin = 1e9;
    COMMUNES.forEach(function(c){ var d = km(la,lo,c.y,c.x); if (d < dmin) { dmin = d; best = c; } });
    if (!best || dmin > 15) { info.textContent = "Vous semblez être hors de Normandie : tapez le nom de la commune du bien."; return; }
    choisir(best, "Commune la plus proche de votre position");
  }, function(){ info.textContent = "Position indisponible ou refusée : tapez le nom de votre commune."; }, {enableHighAccuracy:false, timeout:10000, maximumAge:600000});
});

// Terrain : uniquement pour une maison
var terrL = document.getElementById("e-terrain-l");
function majType(){ terrL.hidden = document.querySelector('input[name="e-type"]:checked').value !== "M"; }
[].forEach.call(document.querySelectorAll('input[name="e-type"]'), function(r){ r.addEventListener("change", majType); });
majType();
function trancheT(t){ var i = 0; while (i < TRANCHES.length && t >= TRANCHES[i]) i++; return i; }
function libTranche(i){ return i === 0 ? "moins de " + fmt.format(TRANCHES[0]) + " m²" : i === TRANCHES.length ? "plus de " + fmt.format(TRANCHES[i-1]) + " m²" : fmt.format(TRANCHES[i-1]) + " à " + fmt.format(TRANCHES[i]) + " m²"; }

document.getElementById("fe").addEventListener("submit", function(e){
  e.preventDefault();
  var err = document.getElementById("e-err"), res = document.getElementById("e-res");
  var type = document.querySelector('input[name="e-type"]:checked').value, nomType = type === "M" ? "maison" : "appartement";
  var surf = parseFloat(document.getElementById("e-surf").value), pieces = document.getElementById("e-pieces").value;
  var tv = document.getElementById("e-terrain").value.trim(), terrain = type === "M" && tv !== "" ? parseFloat(tv) : null;
  err.hidden = true;
  if (terrain !== null && !(terrain >= 0 && terrain <= 200000)) { err.textContent = "Indiquez une surface de terrain en m² (ou laissez le champ vide)."; err.hidden = false; return; }
  if (!choisie) { err.textContent = "Choisissez la commune dans la liste proposée (ou utilisez « Me localiser »)."; err.hidden = false; return; }
  if (!(surf >= 10 && surf <= 1000)) { err.textContent = "Indiquez une surface habitable entre 10 et 1 000 m²."; err.hidden = false; return; }
  res.textContent = "";
  var c = choisie, d = c[type];
  var lp = pieces ? (pieces === "5" ? "5 pièces ou plus" : pieces + (pieces === "1" ? " pièce" : " pièces")) : "";
  var resume = (type === "M" ? "Maison" : "Appartement") + " de " + fmt.format(surf) + " m²" + (lp ? ", " + lp : "") + (terrain !== null ? ", terrain de " + fmt.format(terrain) + " m²" : "") + " à " + c.n + " (" + c.cp.split(" ")[0] + ")";
  var val = null;
  if (d) {
    var parP = pieces && d.p && d.p[pieces], m2 = parP ? parP[0] : d.m, n = parP ? parP[1] : d.n;
    // Effet du terrain : prix médian des maisons de la même tranche de terrain dans la commune (ou moyenne du département), borné à -15 % / +20 %
    var coefT = 1, txtT = "";
    if (terrain !== null) {
      var k = trancheT(terrain), dep = c.c.slice(0,2), parT = d.t && d.t[k];
      var ratio = parT ? parT[0] / d.m : (RATIO_T[dep] ? RATIO_T[dep][k] : 1);
      coefT = Math.min(1.2, Math.max(0.85, ratio || 1));
      var pct = Math.round((coefT - 1) * 100);
      txtT = "Terrain de " + libTranche(k) + " : " + (pct === 0 ? "pas d'écart notable" : (pct > 0 ? "+" : "") + pct + " %") + " par rapport aux maisons de " + (parT ? (d.r ? "ce secteur" : c.n) + " (" + parT[1] + " ventes)" : "du département") + ".";
    }
    val = m2 * surf * coefT;
    var ou = d.r ? "dans un rayon de " + d.r + " km autour de " + c.n : "à " + c.n;
    res.appendChild(el("span","lbl","Estimation indicative"));
    res.appendChild(el("p","big", fmt.format(arr(val*0.9)) + " € à " + fmt.format(arr(val*1.1)) + " €"));
    res.appendChild(el("p",null, resume + "."));
    var lm2 = el("p","m2", "Prix médian " + (parP ? "des " + nomType + "s de " + lp : "des " + nomType + "s") + " " + ou + " : " + fmt.format(m2) + " €/m²"); res.appendChild(lm2);
    if (txtT) res.appendChild(el("p",null, txtT));
    var txt = "Calculé sur " + fmt.format(n) + " ventes signées chez le notaire entre " + moisAnnee(PERIODE[0]) + " et " + moisAnnee(PERIODE[1]) + ".";
    if (d.r) txt += " " + (d.nc ? "Seulement " + d.nc + (d.nc > 1 ? " ventes" : " vente") : "Aucune vente") + " de ce type dans la commune même : j'ai élargi aux communes voisines.";
    if (pieces && !parP) txt += " Pas assez de ventes de " + lp + " : le prix porte sur l'ensemble des " + nomType + "s.";
    res.appendChild(el("p","src", txt));
    var src = el("p","src","Source : base DVF (Demandes de valeurs foncières), DGFiP, publiée sur ");
    var a1 = el("a",null,"data.gouv.fr"); a1.href = "https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/"; a1.target = "_blank"; a1.rel = "noopener"; src.appendChild(a1);
    src.appendChild(document.createTextNode(". Ventes consultables une à une sur "));
    var a2 = el("a",null,"app.dvf.etalab.gouv.fr"); a2.href = "https://app.dvf.etalab.gouv.fr/"; a2.target = "_blank"; a2.rel = "noopener"; src.appendChild(a2);
    src.appendChild(document.createTextNode("."));
    res.appendChild(src);
  } else {
    res.appendChild(el("span","lbl","Estimation personnalisée"));
    res.appendChild(el("p",null, resume + "."));
    res.appendChild(el("p",null, "Il y a trop peu de ventes de ce type autour de cette commune pour calculer un prix fiable. Je vous fais une estimation sur mesure."));
  }
  res.appendChild(el("p","avert","Cette fourchette est indicative et automatique. Elle ne remplace pas un avis de valeur : l'état, les travaux, la vue, l'exposition ou l'emplacement exact peuvent faire varier le prix de 10 à 20 %."));

  var r = el("div","rappel");
  r.appendChild(el("h3",null,"Affinez avec Nadine, gratuitement"));
  r.appendChild(el("p",null,"Je me déplace chez vous et je vous remets un avis de valeur écrit, sans engagement."));
  var act = el("div","actions");
  var bt = el("a","btn primary","Appeler le " + TEL); bt.href = "tel:+33681516289"; act.appendChild(bt);
  var bm = el("a","btn ghost","Écrire un e-mail");
  var corps = "Bonjour Nadine,\n\nJe souhaite faire estimer mon bien : " + resume + ".\n" + (val ? "L'estimation en ligne indique entre " + fmt.format(arr(val*0.9)) + " € et " + fmt.format(arr(val*1.1)) + " €.\n" : "") + "\nMerci de me recontacter.";
  bm.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Demande d'estimation – " + c.n) + "&body=" + encodeURIComponent(corps); act.appendChild(bm);
  r.appendChild(act);
  var f = el("form"); f.noValidate = true;
  f.innerHTML = '<label>Prénom<input name="p" autocomplete="given-name"></label><label>Nom<input name="n" autocomplete="family-name" required></label><label>Téléphone<input name="t" type="tel" autocomplete="tel"></label><label>E-mail<input name="m" type="email" autocomplete="email"></label><label class="full consent"><input type="checkbox" name="c">J\'accepte que Nadine Malfilatre me recontacte au sujet de mon projet. Mes coordonnées ne sont utilisées pour rien d\'autre.</label><div class="full"><button class="btn primary" type="submit">Être rappelé(e)</button></div><p class="msg full" hidden></p>';
  f.addEventListener("submit", function(ev){
    ev.preventDefault();
    var msg = f.querySelector(".msg"); msg.hidden = false;
    if (!f.n.value.trim() || (!f.t.value.trim() && f.m.value.indexOf("@") < 1)) { msg.textContent = "Indiquez votre nom et un téléphone ou un e-mail."; return; }
    if (!f.c.checked) { msg.textContent = "Cochez la case pour accepter d'être recontacté(e)."; return; }
    envoyerDemande({_subject:"Site : demande d'estimation – " + f.p.value.trim() + " " + f.n.value.trim() + " (" + c.n + ")", _replyto:f.m.value.trim(),
      "Prénom":f.p.value.trim(), "Nom":f.n.value.trim(), "Téléphone":f.t.value.trim(), "E-mail":f.m.value.trim(),
      "Bien":resume, "Estimation en ligne": val ? fmt.format(arr(val*0.9)) + " € à " + fmt.format(arr(val*1.1)) + " €" : "non calculée"},
      msg, f.querySelector("button"), "Merci ! Votre demande est bien envoyée, Nadine vous rappelle très vite.");
  });
  r.appendChild(f);
  res.appendChild(r);
  if (window.innerWidth < 780) res.scrollIntoView({behavior:"smooth", block:"start"});
});

})();

# Site de Nadine Malfilatre, prototype

Site vitrine statique dont la liste des biens est reprise chaque jour depuis
sa page Propriétés Privées : https://www.proprietes-privees.com/negociateur/nadine.malfilatre

## Comment ça marche

1. Chaque matin à 6 h, GitHub Actions lance `scraper/fetch-annonces.mjs`.
   Le workflow tourne aussi à chaque modification du dépôt (ex. un nouvel article) et construit d'abord le blog.
   Si la reprise des annonces échoue, le site est quand même publié (blog à jour, annonces de la veille)
   et GitHub envoie l'e-mail d'échec.
2. Le script lit la page de Nadine, repère les références d'annonces (ex. `466586NMAL`),
   ouvre chaque fiche et en tire titre, ville, prix, surface, pièces, DPE, description et photos.
3. Le résultat est écrit dans `site/data/annonces.json` puis le dossier `site/` est publié
   sur GitHub Pages. La page affiche les biens à partir de ce fichier.
4. Garde-fous : si la page est indisponible ou ne renvoie plus aucune annonce, on garde
   les données de la veille et GitHub envoie un e-mail d'échec. Une annonce vendue
   disparaît simplement le lendemain.

Coût : 0 € (GitHub gratuit). Nom de domaine en option, environ 10 €/an (ex. nadine-malfilatre-immobilier.fr).

## Mise en route (≈ 20 min)

1. Créer un compte GitHub et un dépôt (ex. `site-nadine`), y déposer ce dossier.
2. Dépôt → Settings → Pages → Source : **GitHub Actions**.
3. Onglet Actions → « Mise à jour des annonces » → **Run workflow** pour un premier essai.
4. Le site est en ligne à `https://<compte>.github.io/site-nadine/`.
5. (Option) Settings → Pages → Custom domain pour brancher le nom de domaine.

## Écrire un article (Actualités), sans coder

Les articles sont des fichiers texte dans `articles/`. On les écrit avec **Pages CMS**, un éditeur
en ligne gratuit qui se branche sur le dépôt GitHub (réglages dans `.pages.yml`).

1. Aller sur https://app.pagescms.org et se connecter avec le compte GitHub du site
   (une seule fois : autoriser l'accès au dépôt `site-nadine`).
2. Ouvrir **Actualités** → **Ajouter** (ou cliquer sur un article pour le modifier).
3. Remplir : titre, date, catégorie, photo de couverture (facultative), résumé, texte.
   La barre d'outils du texte gère gras, titres, listes, liens et images.
4. **Enregistrer**. Le site se republie tout seul en 2 minutes environ.
   Cocher « Brouillon » pour enregistrer sans publier.

Nadine peut avoir son propre accès : l'inviter comme collaboratrice du dépôt
(Settings → Collaborators) ; elle crée un compte GitHub gratuit et se connecte à Pages CMS pareil.

Les deux articles fournis sont des exemples à modifier ou supprimer.
Le style des pages Actualités est repris automatiquement de `site/index.html`
(`blog/build.mjs`) : changer la charte de l'accueil change aussi le blog. La page d'accueil
affiche les 3 derniers articles et masque la rubrique s'il n'y en a aucun.

Plan B sans Pages CMS : sur github.com, dossier `articles/`, copier un fichier existant
et modifier le texte entre les `---` (titre, date…) puis le contenu en dessous.

## Tester en local

```bash
npm install
npm test            # vérifie l'extraction et la lecture des articles
npm run blog        # construit les pages Actualités dans site/blog/
npm run annonces    # récupère les vraies annonces
npx serve site      # ouvre le site sur http://localhost:3000
```

## À savoir

- Le script dépend de la mise en page de proprietes-privees.com : si le réseau la change,
  il faudra ajuster `extraireAnnonce`. Le premier `npm run annonces` sert de validation réelle.
- Photos : avec l'accord du réseau, le script copie les photos dans `site/photos/<réf>/`
  et supprime celles des biens retirés de la vente. Si une copie échoue, le site affiche
  la photo d'origine en lien direct.
- Formulaire de contact : à relier à un service d'envoi (Formspree, Web3Forms…) à la mise en ligne.

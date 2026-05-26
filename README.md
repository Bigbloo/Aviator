# Casino Bleu — Landing Page

Une landing page attractive pour **Casino Bleu**, conçue pour présenter une vidéo tutoriel, des captures de gains récents, une section FAQ interactive et un bouton d'appel à l'action affilié.

---

## Description

Ce projet est une page web statique (HTML/CSS/JS vanilla) sans dépendances externes ni framework. Elle est optimisée pour mobile et desktop, avec un design dégradé bleu-violet.

---

## Fonctionnalités

- 🎨 Design responsive adapté à tous les appareils (mobile-first)
- 🎬 Vidéo intégrée avec lecture automatique au scroll (IntersectionObserver)
- 🖼️ Carrousel automatique pour les captures de gains récents
- ❓ Section FAQ accordéon (ouverture/fermeture au clic)
- 🔗 Boutons d'appel à l'action liés à un lien d'affiliation

---

## Structure des fichiers

```
Casino-Bleu/
├── index.html          # Page principale (HTML + CSS + JS intégrés)
├── README.md           # Documentation du projet
├── .gitignore          # Fichiers ignorés par Git
└── assets/
    ├── Logo.jpg        # Logo affiché dans le header
    ├── CTA.png         # Image cliquable d'appel à l'action
    ├── Video.MP4       # Vidéo tutoriel principale
    ├── IMG-5902.png    # Capture de gain (carrousel)
    ├── IMG-5914.jpg    # Capture de gain (carrousel)
    └── IMG-5935.png    # Capture de gain (carrousel)
```

---

## Technologies utilisées

- **HTML5** — Structure de la page
- **CSS3** — Styles, animations, responsive design (media queries)
- **JavaScript vanilla** — Carrousel automatique, FAQ accordéon, lecture vidéo au scroll

Aucune dépendance externe, aucun framework, aucun bundler requis.

---

## Lancer le projet en local

Comme il s'agit d'un projet web **100% statique**, aucune installation n'est nécessaire.

### Option 1 — Ouvrir directement dans le navigateur

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd Casino-Bleu

# Ouvrir index.html dans votre navigateur
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Option 2 — Serveur local (recommandé pour éviter les restrictions CORS sur la vidéo)

Avec **Python** (inclus par défaut sur la plupart des systèmes) :

```bash
# Python 3
python3 -m http.server 8080

# Puis ouvrir dans le navigateur :
# http://localhost:8080
```

Avec **Node.js** (si installé) :

```bash
npx serve .
# Puis ouvrir l'URL affichée dans le terminal
```

---

## Hébergement

Ce projet est hébergé sur **GitHub Pages** / **Vercel** (site statique, aucune configuration serveur requise).

---

## Auteur

**Casino Bleu**

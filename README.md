# HOTAS Keybinding Viewer

Visualiseur web pour profils de bindings HOTAS (XML Star Citizen), avec mapping `js1/js2/js3` vers `Throttle` / `Joystick`, rendu par images et infobulles d'actions.

## Stack

- React
- Vite
- TypeScript

## Démarrage

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Pipeline images

Le projet inclut un script pour régénérer les assets depuis `sourcefiles/`:

```bash
npm run prepare:assets
```

Ce script:
- détoure les vues principales throttle + joystick (PNG transparents)
- copie des vues d'angles supplémentaires (WebP)

## Déploiement GitHub Pages

Le repo est prêt pour un déploiement automatique via GitHub Actions.

1. Pousser la branche `main` sur GitHub
2. Dans GitHub: `Settings -> Pages`
3. Dans `Build and deployment`, choisir `Source: GitHub Actions`
4. Le workflow `.github/workflows/deploy-pages.yml` publiera automatiquement `dist/`

URL finale attendue:
- `https://<ton-user>.github.io/hotas-keybinding-viewer/`

## Documentation interne

La doc technique maintenue est ici:

- `docs/PROJECT_DOCUMENTATION.md`

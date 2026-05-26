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

## Documentation interne

La doc technique maintenue est ici:

- `docs/PROJECT_DOCUMENTATION.md`

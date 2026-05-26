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
- génère les visuels app à partir de `sourcefiles/joydesign`
- découpe les vues combinées en panneaux `throttle` et `joystick`
- copie les vues de détail (grip, base top, multi-angle)

## Éditeur de zones (recommandé)

Pour placer précisément les actions sur les boutons:

1. Charger ton XML
2. Assigner `js` -> `Throttle` / `Joystick`
3. Activer `Enable zone editor`
4. Choisir un contrôle dans `Control List`
5. Cliquer-glisser sur l'image pour dessiner la zone du bouton

Les zones sont sauvegardées automatiquement en local (`localStorage`).

### Sauvegarde et partage des zones

Dans le panneau `Profile & Device Assignment`:

1. `Export zones JSON` pour télécharger toutes les zones actuelles
2. `Import zones JSON` pour recharger un export précédent
3. `Reset local zones` pour revenir aux zones par défaut du projet

Fichier de base du projet pour les visiteurs:
- `src/data/defaultZones.ts`

Workflow recommandé:
1. Tu dessines toutes les zones
2. Tu exportes le JSON
3. Tu me donnes ce JSON
4. Je l’intègre dans `src/data/defaultZones.ts` pour qu’il soit actif par défaut pour tout le monde

## Déploiement GitHub Pages

Le repo est prêt pour un déploiement automatique via GitHub Actions.

1. Pousser la branche `main` sur GitHub
2. Dans GitHub: `Settings -> Pages`
3. Dans `Build and deployment`, choisir `Source: Deploy from a branch`
4. Sélectionner `Branch: gh-pages` et `Folder: /(root)`
5. Le workflow `.github/workflows/deploy-pages.yml` publiera automatiquement `dist/` vers `gh-pages`

URL finale attendue:
- `https://<ton-user>.github.io/hotas-keybinding-viewer/`

## Documentation interne

La doc technique maintenue est ici:

- `docs/PROJECT_DOCUMENTATION.md`

## Notes récentes

- Correction des chemins d'assets pour GitHub Pages (`BASE_URL`) afin d'éviter les `404` sur les images.
- Nouveau thème visuel sombre sobre (noir/gris/blanc) avec accent turquoise léger.

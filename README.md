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

Quand `Enable zone editor` est actif:
- la liste inclut aussi les contrôles non bindés du XML actuel
- axes et boutons sont proposés pour pouvoir préparer un layout complet

### Zone multi-boutons (HAT / POV)

Tu peux maintenant associer plusieurs contrôles à **une seule zone physique**:

1. Sélectionner un contrôle et dessiner sa zone
2. Dans l'éditeur, utiliser `Link another control to this same zone`
3. Choisir un autre contrôle, puis sa direction:
   - `Left`
   - `Up`
   - `Right`
   - `Down`
   - `Center`
   - ou `Auto` (déduit de `hatX_up`, `povY_left`, etc.)
4. Cliquer `Link control to zone`

Cas pris en charge:
- HAT complet (`up/down/left/right` + éventuellement `center`)
- HAT partiel (ex: seulement `up/down/center`)

## Filtres preview (multi-sélection)

En mode preview (éditeur désactivé), tu peux filtrer les actions affichées avec:
- un parent (ex: `Spaceship`) qui inclut toutes ses sous-catégories
- des sous-catégories précises (ex: `Spaceship Weapons`)
- sélection multiple
- bouton `Clear modes`

### Affichage preview sans hover

En mode preview (éditeur désactivé):
- les infobulles sont affichées en permanence autour du device
- un trait relie chaque infobulle à la zone bouton/axe
- placement automatique gauche/droite/haut/bas pour limiter les chevauchements

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

## Dépannage: joystick inversé (ordre des périphériques)

Si Star Citizen inverse tes périphériques (ex: throttle devient `Joystick 2` au lieu de `Joystick 1`), tu peux corriger sans tout rebind:

1. Ouvre la console en jeu (`~`)
2. Liste les périphériques détectés:
```text
i_DumpDeviceInformation
```
3. Échange les bindings entre 2 slots joystick:
```text
pp_resortdevices joystick 1 2
```

Signification des paramètres:
- `joystick`: type de périphérique concerné
- `1` et `2`: numéros de slots joystick à permuter (swap des bindings entre ces deux slots)

Exemple RSI aussi documenté:
```text
pp_resortdevices joystick 4 1
pp_resortdevices joystick 5 2
```

Important:
- Cette commande corrige un **ordre inversé** des périphériques, pas une inversion d'axe.
- Pour un axe inversé (avant/arrière, Y, etc.), il faut régler l'inversion dans les options de contrôles du joystick concerné.

Source officielle RSI:
- https://support.robertsspaceindustries.com/hc/en-us/articles/360000183328-Create-export-and-import-custom-profiles

## Documentation interne

La doc technique maintenue est ici:

- `docs/PROJECT_DOCUMENTATION.md`

## Notes récentes

- Correction des chemins d'assets pour GitHub Pages (`BASE_URL`) afin d'éviter les `404` sur les images.
- Nouveau thème visuel sombre sobre (noir/gris/blanc) avec accent turquoise léger.

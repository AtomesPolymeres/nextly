# Divergences de ce fork

Fork agence de `nextlyhq/nextly`, branche `agency`, depuis le tag
`v0.0.2-alpha.66`.

**Une entrée par divergence.** À relire avant chaque synchronisation avec
l'amont, et à se demander pour chacune : _est-ce encore nécessaire ?_ La
plupart doivent finir supprimées parce que l'amont a livré — pas maintenues.
Ce qui suppose d'avoir ouvert l'issue correspondante.

---

## `@nextlyhq/builder` — sélecteur de média

**Pourquoi.** `SUPPORTED_PROP_TYPES` n'admettait pas `media`, et l'inspecteur
n'offre aucun point d'injection : ni registre de contrôles, ni fonction de
rendu qu'un hôte pourrait fournir. Un bloc déclarant un prop `media` —
`core/image` le fait pour son `mediaId` — affichait « Not editable here
(media) ».

Conséquence produit : **le client ne pouvait pas changer une image**. Sur un
site vitrine, c'est la moitié de ce qu'il vient faire.

Le contrôle existait pourtant : `MediaPickerDialog`, exporté par
`@nextlyhq/admin` et déjà utilisé par les champs upload et le texte riche. Il
n'était simplement pas branché.

**Fichiers.**

- `packages/builder/src/inspector.ts` — `"media"` ajouté à la liste
- `packages/builder/src/inspector-panel.tsx` — composant `MediaField`, et sa
  branche dans `PropField`
- `packages/builder/package.json` — `@nextlyhq/admin` en peer + dev

Pas de cycle : `admin` ne dépend pas de `builder`. Et dans une application
réelle `admin` est toujours présent, puisque c'est `plugin-page-builder/admin`
qui monte le builder.

**Ce qui est stocké** : l'ID du média, pas son URL. C'est ce que `core/image`
attend, et c'est ce qui donne un vrai lien — `alt`, largeur et hauteur suivent
à la lecture. Le contournement d'avant, coller une URL dans `src`, n'en garde
aucun.

**Upstream.** Issue à ouvrir.

**À supprimer quand** `media` entre dans `SUPPORTED_PROP_TYPES` en amont.

**Reste à faire.** `EDITABLE_EXPOSED_TYPES` dans
`packages/builder/src/instance-inspector.ts` exclut aussi `image` : une
propriété exposée de type image reste inéditable sur une instance de
composant. Même correctif à appliquer.

---

## Publication

### TOUJOURS `pnpm publish`, jamais `npm publish`

Les dépendances internes de ce monorepo s'écrivent `workspace:*`. C'est un
protocole **pnpm**, et il n'a de sens qu'à l'intérieur du workspace :
`pnpm publish` le remplace par le vrai numéro de version au moment de
publier, parce qu'un consommateur n'a pas ce workspace.

`npm publish` ne fait pas cette substitution — le protocole n'est pas le
sien. Le paquet part avec ses `workspace:*`, et toute installation échoue sur
`EUNSUPPORTEDPROTOCOL: Unsupported URL Type "workspace:"`.

**Erreur commise une fois**, et coûteuse : une version publiée est immuable.
Il a fallu supprimer la version sur GitHub (scope `delete:packages`) avant de
republier. `npm publish --dry-run` ne l'attrape pas : il vérifie la liste des
fichiers, pas le contenu du `package.json` publié.

Vérification après publication :

```bash
npm pack @atomespolymeres/builder@<version> --registry=https://npm.pkg.github.com
tar xzf *.tgz && grep -c "workspace:" package/package.json   # doit valoir 0
```

### Le renommage, au publish seulement

GitHub Packages exige que le scope corresponde au propriétaire du dépôt, donc
`@atomespolymeres/builder`. Mais renommer le paquet DANS le dépôt casserait
les 25 autres, qui l'importent sous `@nextlyhq/builder`. Le `package.json`
est donc renommé juste le temps de publier, puis restauré.

### La séquence complète

```bash
pnpm turbo build --filter=@nextlyhq/builder...   # le dist DOIT exister
# renommer package.json en @atomespolymeres/builder
NODE_AUTH_TOKEN=$(gh auth token) pnpm publish --tag alpha --no-git-checks \
  --registry=https://npm.pkg.github.com
# restaurer package.json
```

`--tag alpha` est obligatoire : npm refuse une préversion sans tag explicite.

### L'alias, côté template

```json
"@nextlyhq/builder": "npm:@atomespolymeres/builder@0.0.2-alpha.66"
```

avec `@atomespolymeres:registry=https://npm.pkg.github.com` dans son `.npmrc`.

**Garder le numéro de version de l'amont** : `plugin-page-builder` déclare
`"@nextlyhq/builder": "0.0.2-alpha.66"` en peer, et l'alias expose la version
du paquet aliasé. Un numéro différent ne satisferait plus ce peer.

Si npm garde l'ancienne résolution, retirer l'entrée du `package-lock.json`
et réinstaller — un alias ne réécrit pas un lockfile déjà résolu.

### Le déploiement

Dokploy aura besoin du token en variable d'environnement pour que `npm ci`
puisse récupérer le paquet privé.

**Garder le numéro de version de l'amont**, sinon les `peerDependencies` des
paquets qui en dépendent ne sont pas satisfaites.

## Synchroniser avec l'amont

```bash
git fetch upstream --tags
git rebase v0.0.2-alpha.XX      # le nouveau tag
pnpm install && pnpm turbo build --filter=@nextlyhq/builder...
```

Le `...` compte : les types se résolvent contre le `dist` BUILDÉ de `nextly`
et `admin`, et builder un paquet seul contre un `dist` absent produit des
`TS2305: Module 'nextly' has no exported member …` — le symptôme d'un dist
périmé, pas une vraie incompatibilité d'API.

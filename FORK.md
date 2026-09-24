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

**Étendu aux instances.** `EDITABLE_EXPOSED_TYPES` dans
`packages/builder/src/instance-inspector.ts` excluait `image` pour une raison
qui n'en était plus une — « an image needs a picker this package cannot
reach ». L'obstacle était la frontière de paquets, pas l'absence de contrôle,
et `plugin-sdk/admin` l'a levée. Une propriété exposée de type image
s'échange désormais sur chaque instance, par le même dialogue.

La ligne porte déjà son bouton « Reset », qui retire la surcharge ; le
contrôle n'offre donc pas de « Remove », qui écrirait une image VIDE — un
geste différent qui se lirait pareil.

**Non vérifié à l'exécution.** `instance-inspector-panel.test.tsx` fait partie
des fichiers en échec préexistant (`EventSource is not defined`), donc le
contrôle lui-même n'est couvert par aucun test qui tourne. Ce qui EST vérifié :
le drapeau `supported` de la ligne, par `instance-inspector.test.ts`, dont la
cassure a été confirmée.

---

## `@nextlyhq/plugin-page-builder` — l'image ne se dessinait pas dans l'admin

**Le symptôme.** Un `core/image` portant un `mediaId` s'affichait sur la page
publiée et restait invisible partout dans l'admin : rien dans le canvas
d'édition, rien dans la miniature de l'écran d'entrée. Sélectionner une image
avec le contrôle ajouté plus haut donnait donc un bloc vide, ce qui se lisait
comme un sélecteur cassé alors qu'il enregistrait correctement.

**La cause, décrite par l'amont lui-même.** `page-render-inputs.ts` portait une
section « What is NOT here » qui l'énonçait mot pour mot : aucune des deux
surfaces ne fournit de `context`, donc toutes deux retombent sur
`createStandaloneContext()`, dont le résolveur média répond `null`. Le commentaire
renvoyait la correction « à qui donnera à l'admin un contexte de rendu en
lecture seule ».

**Le correctif.** `packages/plugin-page-builder/src/admin/admin-render-context.ts`
est ce contexte. Il résout un identifiant contre la bibliothèque de médias de
l'admin, mémorise les résolutions réussies — le canvas se redessine à chaque
frappe et `renderImage` appelle `resolveMedia` à chaque rendu — et n'enregistre
jamais les échecs, pour qu'une coupure d'une seconde ne devienne pas une panne
durable.

Il est distribué depuis `pageRenderInputs`, et non aux deux points d'appel : la
lacune était la même des deux côtés, et c'est exactement la dérive silencieuse
que cette dérivation unique existe pour empêcher. `context` y est REQUIS en
sortie, donc aucune surface ne peut l'oublier.

Rien à changer dans `@nextlyhq/builder` : son canvas type déjà `render` comme
`Omit<PageRendererProps, "document" | "siteStyles">` et le déverse tel quel dans
`PageRenderer`.

**La frontière.** `getMediaById` est réexporté par `@nextlyhq/admin` puis par
`@nextlyhq/plugin-sdk/admin` — la même route sanctionnée que
`MediaPickerDialog`, et pour un besoin symétrique : le sélecteur ÉCRIT
l'identifiant, celui-ci le RELIT.

**Ce que ça ne résout pas.** `data` et `resolveEntryPath` restent ceux du
contexte autonome. Les blocs dynamiques et les liens vers des entrées se
dessinent dans l'admin exactement comme avant.

**Vérifié.** Sur le playground, même document et même page : sans le correctif
le canvas ne contient aucune balise `<img>` ; avec, il contient l'image à
1456×816 avec l'`alt` venu de la base — donc arrivé par `resolveMedia` et non
par le document. Cinq tests unitaires, chacun vu échouer pour sa propre raison.

**Upstream.** Issue à ouvrir — c'est la lacune que l'amont documentait.

**À supprimer quand** l'amont fournit lui-même un contexte de rendu d'admin.

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

### `provenance` doit être coupée pour un publish local

Chaque `package.json` porte `publishConfig.provenance: true`. La provenance
s'appuie sur l'OIDC du runner GitHub Actions ; hors CI il n'y a pas de
fournisseur, et npm refuse AVANT de téléverser quoi que ce soit :

```
npm error code EUSAGE
npm error Automatic provenance generation not supported for provider: null
```

Elle se coupe donc en même temps que le renommage ci-dessous, et se restaure
avec lui. L'échec est propre — rien n'est publié — mais il frappe les trois
paquets d'affilée si on ne le sait pas.

### Le renommage, au publish seulement

GitHub Packages exige que le scope corresponde au propriétaire du dépôt, donc
`@atomespolymeres/builder`. Mais renommer le paquet DANS le dépôt casserait
les 25 autres, qui l'importent sous `@nextlyhq/builder`. Le `package.json`
est donc renommé juste le temps de publier, puis restauré.

### La séquence complète

```bash
pnpm turbo build --filter=@nextlyhq/builder...   # le dist DOIT exister
# renommer en @atomespolymeres/builder ET mettre publishConfig.provenance à false
NODE_AUTH_TOKEN=$(gh auth token) pnpm publish --tag alpha --no-git-checks \
  --registry=https://npm.pkg.github.com
# restaurer package.json
```

**`NODE_AUTH_TOKEN` sert aussi à INSTALLER.** Le `~/.npmrc` écrit
`//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`, donc un `npm install`
dans un shell où la variable est absente échoue en `401 Unauthorized` sur le
premier paquet de l'orga — pas sur un problème de droits.

`--tag alpha` est obligatoire : npm refuse une préversion sans tag explicite.

### Les versions : tout le fork monte ENSEMBLE, en `-agency.N`

Une version publiée est IMMUABLE, donc republier un correctif au-dessus d'une
version déjà sortie demande un nouveau numéro :

```
0.0.2-alpha.66-agency.1   # premier jeu de correctifs au-dessus d'alpha.66
0.0.2-alpha.66-agency.2   # le suivant
0.0.2-alpha.67-agency.1   # l'amont est monté, le compteur repart à 1
```

La filiation reste lisible dans le numéro, sans table de correspondance à
tenir à la main.

**Le numéro est celui du FORK, pas d'un paquet.** Au moment de publier, TOUS
les paquets forkés prennent le même, y compris ceux que le correctif ne touche
pas. C'est pnpm qui l'impose, et de la meilleure façon : il convertit
`workspace:*` en la version que le paquet lié porte à cet instant, donc les
peers se nomment mutuellement au même numéro et se satisfont.

Mesuré, en posant `0.0.2-alpha.66-agency.2` sur les cinq paquets et en
empaquetant `plugin-page-builder` :

```
version du paquet : 0.0.2-alpha.66-agency.2
  @nextlyhq/admin      -> 0.0.2-alpha.66-agency.2
  @nextlyhq/builder    -> 0.0.2-alpha.66-agency.2
  @nextlyhq/plugin-sdk -> 0.0.2-alpha.66-agency.2
  @nextlyhq/ui         -> ^0.0.2-alpha.66-agency.2
```

**Publier un seul paquet en `-agency` ne marche que s'il est une FEUILLE**, et
la première tentative s'est arrêtée là. `plugin-page-builder` en est une :
rien ne le nomme en peer, son numéro est libre, et c'est pourquoi
`0.0.2-alpha.66-agency.1` a pu être publié seul. `builder` n'en est pas une —
il est nommé dans les peers publiés de `plugin-page-builder` — donc un
correctif qui le touche ne peut PAS voyager seul.

**Et l'ensemble entraîne `ui`, où rien ne change.** Le peer y est un caret, et
un caret sur une préversion n'accepte pas un numéro antérieur. Vérifié avec le
résolveur lui-même (`semver.satisfies`) :

```
NON  ui AMONT (0.0.2-alpha.66)          contre ^0.0.2-alpha.66-agency.2
OK   ui FORKÉ (0.0.2-alpha.66-agency.2) contre ^0.0.2-alpha.66-agency.2
NON  builder AMONT                      contre le peer exact
OK   builder FORKÉ                      contre le peer exact
```

Donc cinq paquets à publier et cinq alias côté template, dès qu'un paquet
non-feuille bouge. C'est le prix de posséder la chaîne ; il est connu d'avance
plutôt que découvert sur un `ERESOLVE` en déploiement.

À vérifier après chaque publication d'ensemble :

```bash
node -e "const j=require('./package/package.json');console.log(j.version, j.peerDependencies)"
# la version du paquet et TOUS ses peers @nextlyhq/* doivent porter le même -agency.N
```

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

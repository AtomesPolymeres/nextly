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

Ces paquets sont publiés sous `@agency/*` et substitués par alias npm dans le
template :

```json
"@nextlyhq/builder": "npm:@agency/builder@0.0.2-alpha.66"
```

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

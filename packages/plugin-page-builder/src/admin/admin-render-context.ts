/**
 * AGENCY: le contexte de rendu EN LECTURE SEULE des surfaces d'admin.
 *
 * Deux surfaces dessinent le document d'une page — le canvas d'édition et la
 * miniature de l'écran d'entrée — et toutes deux prétendent montrer ce qu'un
 * visiteur obtient. Aucune ne fournissait de `context`, donc toutes deux
 * retombaient sur `createStandaloneContext()`, dont le résolveur média répond
 * `null` : un `core/image` portant un identifiant de média ne dessinait rien
 * dans le canvas ni dans la miniature, alors que la page publiée l'affiche.
 *
 * Ce module est la réponse à cette lacune : il donne à l'admin le contexte de
 * rendu en lecture seule dont `page-render-inputs` disait qu'il manquait.
 *
 * ## Ce qu'il ne résout PAS
 *
 * `data` et `resolveEntryPath` restent ceux du contexte autonome — un
 * fournisseur vide et un chemin absent. Les blocs dynamiques et les liens vers
 * des entrées se dessinent donc dans l'admin exactement comme avant, et ce
 * module ne prétend pas le contraire. Seul le média est comblé, parce que seul
 * le média a un point de lecture d'admin qui répond sans contexte de requête.
 *
 * @module @nextlyhq/plugin-page-builder/admin/admin-render-context
 */
import {
  createStandaloneContext,
  type PageContext,
  type ResolvedMedia,
} from "@nextlyhq/blocks-react";
import { getMediaById } from "@nextlyhq/plugin-sdk/admin";

/**
 * Les résolutions déjà obtenues, par identifiant de média.
 *
 * Indispensable, pas une optimisation de confort : le canvas se redessine à
 * chaque frappe, et `renderImage` appelle `resolveMedia` à chaque rendu. Sans
 * mémoire, éditer un titre déclencherait une requête réseau par image de la
 * page et par caractère tapé.
 *
 * La PROMESSE est mise en cache, pas la valeur : deux images partageant un
 * identifiant, ou deux rendus se succédant avant la première réponse,
 * partagent alors une seule requête au lieu d'en lancer deux.
 *
 * Au niveau du module plutôt que par surface, parce que le canvas et la
 * miniature montrent la même page du même site : deux caches feraient deux
 * requêtes pour répondre deux fois la même chose.
 */
const resolved = new Map<string, Promise<ResolvedMedia | null>>();

/**
 * Traduit l'enregistrement de l'admin vers ce que le moteur de rendu attend.
 *
 * `width` et `height` sont `number | null` côté admin et absents-ou-nombre
 * côté rendu, et la différence compte : `renderImage` n'écrit l'attribut que
 * s'il est défini, or `width={null}` traversé tel quel poserait un attribut
 * vide et annulerait la réservation de place qui évite le saut de mise en page.
 */
function toResolvedMedia(media: {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}): ResolvedMedia {
  return {
    url: media.url,
    ...(media.altText === null || media.altText === undefined
      ? {}
      : { alt: media.altText }),
    ...(typeof media.width === "number" ? { width: media.width } : {}),
    ...(typeof media.height === "number" ? { height: media.height } : {}),
  };
}

/**
 * Résout un identifiant de média contre la bibliothèque de l'admin.
 *
 * Un échec répond `null` — la posture indulgente que `renderImage` traite déjà
 * comme une décision délibérée : il retombe sur `props.src`, et ne dessine rien
 * s'il n'y en a pas. Un média supprimé laisse donc un trou dans l'aperçu au
 * lieu de faire tomber l'éditeur.
 *
 * L'échec n'est PAS mémorisé. Une coupure réseau d'une seconde, ou un média
 * téléversé juste après la première tentative, resterait autrement invisible
 * jusqu'au rechargement complet de la page — le cache transformerait un
 * incident passager en panne durable.
 */
function resolveMedia(id: string): Promise<ResolvedMedia | null> {
  const known = resolved.get(id);
  if (known !== undefined) return known;

  const pending = getMediaById(id)
    .then(toResolvedMedia)
    .catch(() => {
      resolved.delete(id);
      return null;
    });

  resolved.set(id, pending);
  return pending;
}

/**
 * Le contexte que les deux surfaces d'admin dessinent avec.
 *
 * UNE instance partagée, et non une fabrique appelée par surface. Le contexte
 * ne porte aucun état propre à une surface, et le renderer compare l'identité
 * de ses props : un objet reconstruit à chaque rendu redéclencherait le travail
 * qu'il permet justement d'éviter.
 *
 * Construit par `createStandaloneContext` plutôt qu'écrit à la main, pour que
 * tout champ que le moteur ajoutera arrive ici avec sa valeur par défaut au
 * lieu de manquer silencieusement.
 */
export const adminRenderContext: PageContext = createStandaloneContext({
  resolveMedia,
});

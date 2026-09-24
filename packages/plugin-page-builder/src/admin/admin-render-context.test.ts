/**
 * AGENCY: ce que le contexte de rendu de l'admin répond, et ce qu'il retient.
 *
 * Trois propriétés, chacune capable de passer inaperçue parce que son
 * manquement dessine une page plausible plutôt qu'une erreur :
 *
 * La TRADUCTION. L'admin type `width` et `height` en `number | null`, le moteur
 * les veut absents-ou-nombre. Laisser passer `null` pose un attribut vide sur
 * le `<img>` et annule la réservation de place qui évite le saut de mise en
 * page — l'image s'affiche, et la page bouge sous l'auteur.
 *
 * La MÉMOIRE. Le canvas se redessine à chaque frappe et `renderImage` appelle
 * `resolveMedia` à chaque rendu. Sans elle, une requête réseau par image et par
 * caractère tapé, ce qu'aucune capture d'écran ne révèle.
 *
 * L'OUBLI DES ÉCHECS. C'est le piège de la mémoire précédente : une coupure
 * d'une seconde mise en cache pour toujours transforme un incident passager en
 * panne durable, jusqu'au rechargement complet de l'admin.
 *
 * Les modules sont réimportés à chaque cas parce que le cache vit au niveau du
 * MODULE : un `vi.resetModules()` oublié ferait passer le cas de l'oubli des
 * échecs grâce à l'état laissé par le cas précédent.
 *
 * @module admin/admin-render-context.test
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMediaById = vi.fn();

vi.mock("@nextlyhq/plugin-sdk/admin", () => ({
  getMediaById: (id: string): Promise<unknown> => getMediaById(id),
}));

/** Un enregistrement complet, dont chaque cas ne modifie que ce qu'il teste. */
const RECORD = {
  id: "media-1",
  url: "/uploads/sakura.png",
  altText: "sakura",
  width: 1456,
  height: 816,
};

/**
 * Le contexte, fraîchement évalué — donc avec un cache vide.
 *
 * Le module est réimporté plutôt que réinitialisé de l'extérieur : le cache est
 * privé, et un test qui le vide par un autre moyen testerait ce moyen.
 */
async function freshContext(): Promise<{
  resolveMedia: (id: string) => Promise<unknown>;
}> {
  vi.resetModules();
  const module = await import("./admin-render-context");
  return module.adminRenderContext;
}

beforeEach(() => {
  getMediaById.mockReset();
});

describe("adminRenderContext.resolveMedia", () => {
  it("traduit l'enregistrement de l'admin vers la forme du moteur", async () => {
    getMediaById.mockResolvedValue(RECORD);
    const context = await freshContext();

    await expect(context.resolveMedia("media-1")).resolves.toEqual({
      url: "/uploads/sakura.png",
      alt: "sakura",
      width: 1456,
      height: 816,
    });
  });

  it("omet les dimensions nulles au lieu de les transmettre", async () => {
    getMediaById.mockResolvedValue({
      ...RECORD,
      altText: null,
      width: null,
      height: null,
    });
    const context = await freshContext();
    const resolved = await context.resolveMedia("media-1");

    /*
     * Sur les CLÉS et non sur les valeurs. `toEqual` traite une clé absente et
     * une clé valant `undefined` comme équivalentes, donc une traduction qui
     * poserait `width: undefined` passerait — et `renderImage` teste
     * `usable?.width === undefined`, si bien que le défaut se verrait ailleurs.
     */
    expect(Object.keys(resolved as object).sort()).toEqual(["url"]);
  });

  it("ne relit pas un média déjà résolu", async () => {
    getMediaById.mockResolvedValue(RECORD);
    const context = await freshContext();

    await context.resolveMedia("media-1");
    await context.resolveMedia("media-1");

    expect(getMediaById).toHaveBeenCalledTimes(1);
  });

  it("partage une seule requête entre deux appels simultanés", async () => {
    getMediaById.mockResolvedValue(RECORD);
    const context = await freshContext();

    // Lancés AVANT tout `await`, sinon le premier aurait le temps de peupler
    // le cache et le cas ne testerait plus la simultanéité.
    await Promise.all([
      context.resolveMedia("media-1"),
      context.resolveMedia("media-1"),
    ]);

    expect(getMediaById).toHaveBeenCalledTimes(1);
  });

  it("répond null sur un échec sans le mémoriser", async () => {
    getMediaById.mockRejectedValueOnce(new Error("réseau coupé"));
    getMediaById.mockResolvedValue(RECORD);
    const context = await freshContext();

    await expect(context.resolveMedia("media-1")).resolves.toBeNull();

    // La seconde tentative doit REPARTIR : un échec mis en cache rendrait
    // l'image invisible jusqu'au rechargement de l'admin.
    await expect(context.resolveMedia("media-1")).resolves.toEqual({
      url: "/uploads/sakura.png",
      alt: "sakura",
      width: 1456,
      height: 816,
    });
    expect(getMediaById).toHaveBeenCalledTimes(2);
  });
});

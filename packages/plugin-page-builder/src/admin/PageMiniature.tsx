"use client";

/**
 * The page itself, drawn small, on the screen an author reaches it from.
 *
 * The same `PageRenderer` that draws the published page. That is the property
 * worth protecting rather than an implementation convenience: a preview with
 * its own rendering path is a second implementation of "what does this page
 * look like", and the two drift in the direction nobody tests — the preview
 * stops matching the page while both look correct in isolation. `canvas.tsx`
 * makes the same argument for the editing surface, and it applies here for the
 * same reason.
 *
 * ## It is a picture, and it is inert
 *
 * Everything drawn inside is `inert` and `aria-hidden`. Not decoration: a page
 * is full of links, buttons and headings, and left reachable they would put a
 * whole second document into the tab order of a form — an author tabbing out of
 * the title field would walk into a miniature of their own page. The accessible
 * account is the text beside it, which says what the field holds and offers the
 * one action there is.
 *
 * ## `transform`, never `zoom`
 *
 * A deliberate divergence from the canvas, which uses `zoom`. `zoom`
 * participates in layout, and the canvas needs that: hit-testing, drag geometry
 * and the drop indicator are all positioned in the scaled box's own
 * coordinates. Nothing here is interactive, so participation buys nothing and
 * costs a reflow of the whole rendered tree on every resize.
 *
 * `transform` alone does NOT keep the scaled content out of the flow, which is
 * the trap: it removes the element from painting and leaves it in layout, so a
 * statically positioned child declared at the compose width stretches every
 * ancestor to that width. The scaled element is absolutely positioned for that
 * reason, and only then is the frame's measured width the column's width.
 *
 * ## An unmeasurable container renders UNSCALED
 *
 * A container reports zero width before layout, and in any environment that
 * does not lay out at all. Scaling by the measured ratio there multiplies the
 * page by zero and draws nothing — a blank frame that looks exactly like a page
 * with no content. Rendering unscaled instead is wrong only in how much of the
 * page is visible, and it is wrong visibly, which is the better failure.
 *
 * @module @nextlyhq/plugin-page-builder/admin/PageMiniature
 */
import type { BlockDocument } from "@nextlyhq/blocks-engine";
import {
  PageRenderer,
  previewContainerStyle,
  type PageRendererProps,
} from "@nextlyhq/blocks-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { entryBlockResolver } from "./entry-block-resolver";
import type { PageRenderInputs } from "./page-render-inputs";

/**
 * The width the page is composed at before being scaled down.
 *
 * A desktop tier. A page laid out for desktop, rendered at the few hundred
 * pixels a form column offers, would draw its MOBILE layout — a truthful
 * rendering of a viewport the author was not looking at, which reads as the
 * page being wrong rather than as the preview being narrow.
 */
const DEFAULT_RENDER_WIDTH = 1280;

/**
 * AGENCY: la hauteur que la miniature ne dépasse pas, en multiples de sa
 * largeur.
 *
 * La boîte tenait sa hauteur d'un `aspect-[16/10]` fixe, ce qui coupait toute
 * page plus haute que ce rapport — une page de cinq sections ne se voyait
 * qu'au tiers, et l'auteur ne pouvait pas savoir si le reste existait.
 *
 * Laisser la hauteur suivre librement le contenu était l'autre extrême, et le
 * docblock ci-dessus dit pourquoi il a été écarté : le formulaire défilerait
 * devant un aperçu pleine longueur. La miniature s'ajuste donc au contenu
 * JUSQU'À cette borne, puis rétrécit l'échelle pour faire tenir le reste.
 *
 * Un multiple de la LARGEUR plutôt qu'un nombre de pixels, parce que la
 * colonne du formulaire change de largeur avec la fenêtre : une borne absolue
 * donnerait un aperçu presque carré sur un grand écran et très allongé sur un
 * petit.
 */
const MAX_HEIGHT_RATIO = 1.6;

export interface PageMiniatureProps {
  /** The document to draw. */
  document: BlockDocument;
  /**
   * The site's compiled sheet.
   *
   * Spelled as the renderer's own prop type so the two cannot drift. The caller
   * decides whether it is ready; this draws whatever it is handed.
   */
  siteStyles: PageRendererProps["siteStyles"];
  /**
   * Everything else this site's rendering depends on — its breakpoints, the
   * container its responsive rules are compiled against, its remote-host policy
   * and its document caps.
   *
   * Taken as one bundle from `pageRenderInputs` rather than as loose props, so
   * this surface cannot be given three of the four. The canvas is handed the
   * same bundle.
   */
  render: PageRenderInputs;
  /** The width to compose at before scaling. Defaults to a desktop tier. */
  renderWidth?: number;
  /**
   * AGENCY: la hauteur maximale de la miniature, en multiples de sa largeur.
   *
   * Exposé plutôt que constant parce que la bonne borne dépend de la surface :
   * une colonne de formulaire et une vignette de liste ne supportent pas la
   * même hauteur.
   */
  maxHeightRatio?: number;
}

/**
 * @param props - the document, the site's sheet, and the width to compose at
 * @returns a clipped, inert, scaled rendering of the page
 */
export function PageMiniature({
  document,
  siteStyles,
  render,
  renderWidth = DEFAULT_RENDER_WIDTH,
  maxHeightRatio = MAX_HEIGHT_RATIO,
}: PageMiniatureProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  /*
   * AGENCY: la hauteur NATURELLE de la page, à la largeur de composition.
   *
   * Mesurée sur l'élément mis à l'échelle, dont la largeur est fixée à
   * `renderWidth` — donc indépendante de celle de la boîte. C'est ce qui
   * empêche la boucle que cette mesure invite : la hauteur de la boîte est
   * dérivée de celle-ci, et si celle-ci en dépendait à son tour, chaque
   * ajustement en déclencherait un autre.
   */
  const [contentHeight, setContentHeight] = useState(0);
  const scaled = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;

    // Zéro veut dire « pas encore mis en page », jamais « large de zéro ».
    // Voir le docblock du module.
    const measure = (): void => setFrameWidth(element.clientWidth);

    measure();

    // Guarded rather than assumed: this component renders in the admin, in
    // tests, and anywhere a host embeds the form, and an environment without
    // the observer must still draw the page rather than throw on the way in.
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /*
   * AGENCY: la hauteur du contenu, observée séparément.
   *
   * Un effet distinct parce que le déclencheur l'est : la largeur de la boîte
   * change quand la FENÊTRE bouge, la hauteur du contenu quand le DOCUMENT
   * change. Les réunir ferait remesurer l'un à chaque événement de l'autre.
   */
  useLayoutEffect(() => {
    const element = scaled.current;
    if (!element) return;

    const measure = (): void => setContentHeight(element.scrollHeight);

    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [renderWidth]);

  /*
   * AGENCY: l'échelle, et la hauteur qui en découle.
   *
   * Deux contraintes, dont on prend la plus sévère. La LARGEUR donne l'échelle
   * habituelle — la page composée à `renderWidth` tient dans la colonne. La
   * HAUTEUR n'intervient que sur une page assez longue pour dépasser la borne,
   * et la rétrécit alors juste assez pour qu'elle tienne entière.
   *
   * Avant la mise en page, `frameWidth` vaut zéro : l'échelle reste à 1 et la
   * page se dessine non réduite. Réduire par le rapport mesuré multiplierait
   * la page par zéro et ne dessinerait rien — une boîte vide, impossible à
   * distinguer d'une page sans contenu.
   */
  const widthScale = frameWidth > 0 ? frameWidth / renderWidth : 1;
  const maxHeight = frameWidth * maxHeightRatio;
  const needsShrinking =
    contentHeight > 0 &&
    maxHeight > 0 &&
    contentHeight * widthScale > maxHeight;
  const scale = needsShrinking ? maxHeight / contentHeight : widthScale;
  /*
   * La boîte prend la hauteur de ce qu'elle montre, au lieu d'un rapport fixe.
   *
   * `undefined` tant que rien n'est mesuré, ce qui laisse la classe
   * `aspect-[16/10]` décider — le même repli que l'échelle non réduite, et
   * pour la même raison : une hauteur de zéro est indiscernable d'une page
   * vide.
   */
  const frameHeight =
    contentHeight > 0 && frameWidth > 0 ? contentHeight * scale : undefined;

  /*
   * Held apart from the measured scale, which changes on every frame of a
   * resize.
   *
   * Rebuilt inline, each observer callback would rerun the whole render beneath
   * it — sanitisation, migration, every block, and the stylesheet compile — for
   * a page whose content did not change and whose wrapper only needed a new
   * transform. On a large document that is visible jank, and it re-enters any
   * asynchronous block resolver the page has. The canvas holds its page the
   * same way and for the same reason.
   */
  const page = useMemo(
    () => (
      <PageRenderer
        // Spread rather than listed field by field: the bundle owns which
        // inputs describe this site's rendering, and a surface restating them
        // here would silently stop forwarding one it never heard of.
        {...render}
        document={document}
        blocks={entryBlockResolver()}
        siteStyles={siteStyles}
      />
    ),
    [render, document, siteStyles]
  );

  return (
    <div
      ref={frame}
      data-slot="page-miniature"
      /*
       * AGENCY: la hauteur vient du CONTENU, plus d'un rapport fixe.
       *
       * `aspect-[16/10]` reste dans les classes comme repli avant la mesure,
       * et le rapport doit être COUPÉ dès qu'une hauteur est posée — pas
       * seulement laissé de côté.
       *
       * Mesuré ici, et c'est une boucle d'emballement, pas un défaut
       * cosmétique : un `aspect-ratio` dont la hauteur est fixée calcule la
       * LARGEUR au lieu de la déduire. La largeur mesurée donnait l'échelle,
       * l'échelle donnait la hauteur, la hauteur redonnait la largeur — la
       * boîte a atteint 16 777 174 pixels de large en une poignée de trames.
       *
       * `overflow-hidden` demeure : la page est réduite pour tenir, mais un
       * bloc qui déborde de sa propre boîte ne doit pas déborder de celle-ci.
       */
      className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-background"
      {...(frameHeight === undefined
        ? {}
        : { style: { height: `${frameHeight}px`, aspectRatio: "auto" } })}
    >
      <div
        ref={scaled}
        data-slot="page-miniature-scaled"
        /*
         * ABSOLUTE, and this is load-bearing rather than cosmetic.
         *
         * `transform` takes an element out of the PAINTING flow and leaves it
         * in the LAYOUT flow, so a statically positioned 1280px child still
         * contributes 1280px of intrinsic width to its ancestors — measured:
         * the frame's own `clientWidth` came back as 1280 rather than the
         * column's width, the scale computed from it was therefore 1, and the
         * page drew full-size and overflowed the form. Taking it out of flow is
         * what makes the frame's width a property of the COLUMN, which is the
         * width the scale has to be computed from.
         */
        className="absolute left-0 top-0"
        style={{
          width: `${renderWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          /*
           * The container the compiled responsive rules resolve against, on the
           * element whose width they must answer for — the COMPOSED width, not
           * the clipped frame's. `@media` asks the window, so without this a
           * miniature composed at a desktop width gets whichever tier the admin
           * window happens to be in. `previewContainerStyle` supplies the
           * `container-type` beside the name, because a named container left at
           * the default `normal` is not a size-query container and every rule
           * the compile emitted stays inert.
           */
          ...previewContainerStyle(render.styleContext.previewContainer),
        }}
      >
        <div
          data-slot="page-miniature-surface"
          inert
          aria-hidden="true"
          /*
           * A submit raised anywhere in the page cannot reach the form this
           * miniature sits inside.
           *
           * The entry screen is a `<form>`, and a page holding a form block
           * emits one too — so the preview contains a nested form, which is
           * invalid HTML. What that costs depends on how the document was
           * built, and only one path is live here:
           *
           * PARSED from HTML source, the inner `</form>` closes the OUTER form
           * early. Measured on this exact shape: a control after the nested
           * form reports `input.form === null` — no owner, so it submits
           * nothing. The admin ships no form markup and builds its tree through
           * the DOM, so it does not take that path today.
           *
           * BUILT through the DOM, which is what happens here, a real nested
           * form exists and controls keep their nearest-ancestor owner. The
           * live risk is a submit from the previewed page reaching the entry
           * form, and this is what refuses it.
           *
           * Captured on the WAY DOWN rather than bubbling, so it lands before
           * any handler inside the page, and matched by the EVENT rather than
           * by a block's name: a host's own form-rooted block raises the same
           * event and is refused by the same line, where a check for
           * `core/form` would have let it through.
           */
          onSubmitCapture={event => event.preventDefault()}
        >
          {page}
        </div>
      </div>
    </div>
  );
}

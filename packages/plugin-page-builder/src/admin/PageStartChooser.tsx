"use client";

/**
 * The "start from a pattern" surface: what a NEW page opens on, before the
 * empty canvas.
 *
 * The library has always held full-page patterns, and nothing offered them.
 * The insert panel leaves them out on purpose — a page placed inside the page
 * it is meant to be — and its own comment named the missing surface: the one
 * "the design calls for". Without it a page pattern was stored and
 * unreachable, and every new page began blank.
 *
 * ## Only on a page that has nothing yet
 *
 * Mounted by the editor only while the page it OPENED with is empty, and gone
 * the moment the document holds anything. Starting from a pattern replaces the
 * root forest, which on an empty page loses nothing and on any other page would
 * throw away work. The editor, not this file, keeps that promise, because the
 * editor is what knows what the page opened as.
 *
 * ## The blank page stays one click away
 *
 * Always offered, below the patterns, and the ONLY thing offered when the
 * library has no page patterns this page may take: then the surface does not
 * draw at all, and the author meets the empty canvas as before. A chooser with
 * nothing to choose is a dialog in the way.
 *
 * ## What it offers is what the planner accepts
 *
 * Each pattern is planned against the page before it is offered, by the same
 * planner the choice then applies, and one it refuses is left out. The insert
 * panel makes the same promise for the same reason: an offer the apply then
 * refuses is a click that does nothing.
 *
 * @module @nextlyhq/plugin-page-builder/admin/PageStartChooser
 */
import type { BlockDocument } from "@nextlyhq/blocks-engine";
import type { SavedPattern } from "@nextlyhq/builder";
import { Button } from "@nextlyhq/ui";
import { useEffect, useMemo } from "react";

import type { PageRenderInputs } from "./page-render-inputs";
import { PageMiniature } from "./PageMiniature";
import type { LibraryReadState } from "./pattern-library-client";

/** A page pattern the surface may offer: one with a document to place. */
export interface PageStart {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly document: BlockDocument;
}

export interface PageStartChooserProps {
  /** The page patterns this page may take, as the library read them. */
  readonly patterns: readonly SavedPattern[];
  /** Where that read stands. */
  readonly state: LibraryReadState;
  /** Ask the library again. */
  readonly retry: () => void;
  /**
   * Whether the planner accepts this pattern as the page's start. Asked of
   * every candidate before it is offered.
   */
  readonly accepts: (pattern: PageStart) => boolean;
  /** Start the page from this pattern. */
  readonly onChoose: (pattern: PageStart) => void;
  /** Start from the empty page instead. */
  readonly onBlank: () => void;
  /**
   * How to draw a pattern's miniature — the canvas's own inputs, so a tile
   * shows the page the author will get. Absent, tiles are named only.
   */
  readonly preview?: {
    readonly siteStyles: React.ComponentProps<
      typeof PageMiniature
    >["siteStyles"];
    readonly render: PageRenderInputs;
  };
}

/**
 * The candidates a surface may offer: a document, and nodes to place.
 *
 * A row with no document is legal in the collection and places nothing, so it
 * is not a start; the insert catalogue skips it for the same reason.
 */
export function pageStartsFrom(
  patterns: readonly SavedPattern[]
): readonly PageStart[] {
  return patterns.flatMap(pattern => {
    const document = pattern.document;
    if (!document || !Array.isArray(document.nodes)) return [];
    if (document.nodes.length === 0) return [];
    return [
      {
        id: pattern.id,
        title: pattern.title,
        ...(pattern.description ? { description: pattern.description } : {}),
        document,
      },
    ];
  });
}

export function PageStartChooser({
  patterns,
  state,
  retry,
  accepts,
  onChoose,
  onBlank,
  preview,
}: PageStartChooserProps): React.JSX.Element | null {
  const starts = useMemo(
    () => pageStartsFrom(patterns).filter(accepts),
    [patterns, accepts]
  );

  // Nothing to choose from, and nothing coming: the empty canvas is the answer,
  // so the surface closes itself rather than asking a question with one reply.
  const nothingToOffer = state === "ready" && starts.length === 0;
  useEffect(() => {
    if (nothingToOffer) onBlank();
  }, [nothingToOffer, onBlank]);
  if (nothingToOffer) return null;

  return (
    <div
      className="nx-pb-start"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nx-pb-start-title"
    >
      <div className="nx-pb-start__panel">
        <header className="nx-pb-start__header">
          <h2 id="nx-pb-start-title" className="nx-pb-start__title">
            Start this page from a template
          </h2>
          <p className="nx-pb-start__lede">
            Pick a ready-made page and change its words and images. You can
            still start from a blank page.
          </p>
        </header>

        {state === "pending" && starts.length === 0 ? (
          <p className="nx-pb-start__note" role="status">
            Loading templates…
          </p>
        ) : null}

        {state === "unavailable" ? (
          <p className="nx-pb-start__note" role="status">
            The templates could not be loaded.{" "}
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          </p>
        ) : null}

        {starts.length > 0 ? (
          <ul className="nx-pb-start__grid" aria-label="Page templates">
            {starts.map(start => (
              <li key={start.id}>
                <button
                  type="button"
                  className="nx-pb-start__tile"
                  onClick={() => onChoose(start)}
                >
                  {preview ? (
                    <span className="nx-pb-start__preview" aria-hidden="true">
                      <PageMiniature
                        // Drawn as the page it will become: the stored kind is
                        // `pattern`, and the renderer draws pages.
                        document={{ ...start.document, kind: "page" }}
                        siteStyles={preview.siteStyles}
                        render={preview.render}
                        maxHeightRatio={1.25}
                      />
                    </span>
                  ) : null}
                  <span className="nx-pb-start__name">{start.title}</span>
                  {start.description ? (
                    <span className="nx-pb-start__description">
                      {start.description}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="nx-pb-start__footer">
          <Button type="button" variant="outline" onClick={onBlank}>
            Start from a blank page
          </Button>
        </footer>
      </div>
    </div>
  );
}

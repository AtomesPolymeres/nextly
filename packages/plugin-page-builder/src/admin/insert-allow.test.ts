/**
 * What the insert panel may offer under a field's `allow`.
 *
 * The separating property is not "the list got shorter" — any filter does
 * that — but "nothing offered produces a node the save refuses". So each tier
 * is checked against the validator's own verdict on what an insert from it
 * writes, and each removal is paired with the control that keeps the same
 * entry when the list admits it.
 *
 * @module admin/insert-allow.test
 */

import type { BlockNode } from "@nextlyhq/blocks-engine";
import { COMPONENT_INSTANCE_TYPE } from "@nextlyhq/blocks-engine";
import { coreBlocks } from "@nextlyhq/blocks-react/blocks";
import type { SavedComponent, SavedPattern } from "@nextlyhq/builder";
import { describe, expect, it } from "vitest";

import { validateBlocksValue } from "../fields/blocks-validator";

import {
  offerableComponentsUnder,
  offerableDefinitions,
  offerablePatternsUnder,
} from "./insert-allow";

/** The names a filtered definition list offers. */
function namesUnder(allow: readonly string[] | undefined): string[] {
  return (offerableDefinitions(allow, coreBlocks) ?? []).map(d => d.name);
}

/** A saved pattern whose forest is `nodes`. */
function pattern(id: string, nodes: BlockNode[]): SavedPattern {
  return {
    id,
    title: id,
    document: { formatVersion: 1, kind: "pattern", nodes },
  } as SavedPattern;
}

/** A node of `type`, with optional children in its default slot. */
function node(id: string, type: string, children?: BlockNode[]): BlockNode {
  return {
    id,
    type,
    version: 1,
    props: {},
    ...(children === undefined ? {} : { slots: { children } }),
  } as BlockNode;
}

describe("the block tier", () => {
  it("leaves the panel's own default in charge when the field declares no list", () => {
    // `undefined`, not the whole registry: the panel reads that as
    // "everything registered" and keeps its own snapshot.
    expect(offerableDefinitions(undefined, coreBlocks)).toBeUndefined();
  });

  it("offers only the admitted types, wildcards read as the validator reads them", () => {
    expect(namesUnder(["core/heading", "core/text"]).sort()).toEqual([
      "core/heading",
      "core/text",
    ]);
    // The control for the narrowing above: a namespace pattern admits the
    // whole namespace, so the same filter is not simply dropping everything.
    expect(namesUnder(["core/*"])).toHaveLength(coreBlocks.length);
  });

  it("withholds a container whose seeded children the list refuses", () => {
    // `core/columns` arrives with two `core/column` children. Offered under a
    // list naming only the container, the click lands two nodes the save
    // refuses.
    expect(namesUnder(["core/columns"])).not.toContain("core/columns");
    // Admitted once its children are.
    expect(namesUnder(["core/columns", "core/column"])).toContain(
      "core/columns"
    );
  });

  it("offers an empty palette for an empty list", () => {
    // An empty list admits nothing — the validator's reading — and is not the
    // same answer as no list at all.
    expect(offerableDefinitions([], coreBlocks)).toEqual([]);
  });
});

describe("the pattern tier", () => {
  const allow = ["core/section", "core/heading"];
  const clean = pattern("clean", [
    node("s", "core/section", [node("h", "core/heading")]),
  ]);
  const nested = pattern("nested", [
    node("s", "core/section", [node("q", "core/quote")]),
  ]);

  it("withholds a pattern holding a refused type anywhere in its forest", () => {
    const offered = offerablePatternsUnder([clean, nested], allow);
    expect(offered.map(p => p.id)).toEqual(["clean"]);

    // The separating check: the validator refuses exactly the one withheld.
    const verdict = (p: SavedPattern) =>
      validateBlocksValue(
        { ...p.document, kind: "page" },
        "content",
        "Content",
        { allow }
      ).map(issue => issue.code);
    expect(verdict(nested)).toContain("DISALLOWED_BLOCK_TYPE");
    expect(verdict(clean)).not.toContain("DISALLOWED_BLOCK_TYPE");
  });

  it("hands back the same list when nothing is removed, or no list is declared", () => {
    const patterns = [clean];
    expect(offerablePatternsUnder(patterns, allow)).toBe(patterns);
    expect(offerablePatternsUnder(patterns, undefined)).toBe(patterns);
  });
});

describe("the component tier", () => {
  const components = [{ id: "hero", title: "Hero" }] as SavedComponent[];

  it("offers every component when instances are admitted, none otherwise", () => {
    expect(
      offerableComponentsUnder(components, [
        COMPONENT_INSTANCE_TYPE,
        "core/text",
      ])
    ).toBe(components);
    expect(offerableComponentsUnder(components, ["core/text"])).toEqual([]);
    expect(offerableComponentsUnder(components, undefined)).toBe(components);
  });
});

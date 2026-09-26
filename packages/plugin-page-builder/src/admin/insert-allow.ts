/**
 * What the insert panel may offer under a field's `allow`.
 *
 * The panel draws whatever it is handed and defaults to every registered
 * block, every saved pattern and every component. The field's `allow` was
 * enforced at SAVE only, so a palette ignoring it offered a block, accepted
 * the insert, let the author work on it, and then had the save refuse the
 * whole document with `DISALLOWED_BLOCK_TYPE` — work lost to a rule the author
 * was never shown.
 *
 * Each tier is judged by what an insert from it would actually WRITE into the
 * document, because that is what the save judges:
 *
 * - a block by its own type AND the children it is seeded with — a container
 *   whose declared default child is outside the list would land a node the
 *   save refuses, from a tile that looked allowed;
 * - a pattern by every node of its forest, since it is copied in whole;
 * - a component by the single instance node placing it writes. Its content
 *   lives in the components collection and is not part of this document, so
 *   `allow` has no say over which component — only over whether instances are
 *   admitted at all.
 *
 * Every function answers its input UNCHANGED when there is no `allow`, and
 * when nothing was removed: the panel memoises its catalogue on these
 * identities.
 *
 * The predicate is `fields/blocks-allow`, the validator's own — not a copy.
 *
 * @module admin/insert-allow
 */

import {
  allBlocks,
  COMPONENT_INSTANCE_TYPE,
  expandSlotDefaults,
  type AnyBlockDefinition,
  type BlockNode,
} from "@nextlyhq/blocks-engine";
import type { SavedComponent, SavedPattern } from "@nextlyhq/builder";

import { disallowedTypesIn, isAllowedBlockType } from "../fields/blocks-allow";

/**
 * The block definitions the panel may offer, or `undefined` for "everything
 * registered" — the panel's own default, left in charge when the field
 * declares no list.
 *
 * Seeded children are expanded against the SAME definitions the panel builds
 * its insert from (it consults the supplied list over the registry, and this
 * list is a subset of the registry), so what is judged here is the subtree
 * the click produces.
 */
export function offerableDefinitions(
  allow: readonly string[] | undefined,
  definitions: readonly AnyBlockDefinition[] = allBlocks()
): readonly AnyBlockDefinition[] | undefined {
  if (allow === undefined) return undefined;
  const byName = new Map(definitions.map(d => [d.name, d]));
  const source = { get: (type: string) => byName.get(type) };
  return definitions.filter(definition => {
    if (!isAllowedBlockType(definition.name, allow)) return false;
    const seeded = expandSlotDefaults(definition.name, source);
    if (seeded === undefined) return true;
    const children: BlockNode[] = Object.values(seeded).flat();
    return disallowedTypesIn(children, allow).size === 0;
  });
}

/** The saved patterns the panel may offer: those whose whole forest is admitted. */
export function offerablePatternsUnder(
  patterns: readonly SavedPattern[],
  allow: readonly string[] | undefined
): readonly SavedPattern[] {
  if (allow === undefined) return patterns;
  const kept = patterns.filter(pattern => {
    // A row with no document places nothing and the catalogue already skips
    // it; it is not this rule's to judge.
    const nodes = pattern.document?.nodes;
    return !Array.isArray(nodes) || disallowedTypesIn(nodes, allow).size === 0;
  });
  return kept.length === patterns.length ? patterns : kept;
}

/** The components the panel may offer: all of them, or none. */
export function offerableComponentsUnder(
  components: readonly SavedComponent[],
  allow: readonly string[] | undefined
): readonly SavedComponent[] {
  if (allow === undefined) return components;
  return isAllowedBlockType(COMPONENT_INSTANCE_TYPE, allow) ? components : [];
}

/**
 * What a blocks field's `allow` admits, as ONE predicate.
 *
 * Two readers ask it: the validator, which refuses a stored document holding a
 * type outside the list, and the admin's insert panel, which must not offer
 * one. Given two implementations they would agree until one learned a new
 * spelling — and the disagreement is the worst kind for an author, who is
 * offered a block, places it, works on it, and has the save refuse it with
 * `DISALLOWED_BLOCK_TYPE`. So both import this file, and React-free, so the
 * validator can.
 *
 * @module fields/blocks-allow
 */

import { walkNodes, type BlockNode } from "@nextlyhq/blocks-engine";

/**
 * Exact name match, or a namespace match for a `namespace/*` pattern.
 *
 * The wildcard binds to the namespace separator rather than to raw characters:
 * `core/*` matches `core/heading` and never `coreevil/banner`. A bare prefix
 * test would quietly admit any namespace that merely starts with the same
 * letters, which is a wider policy than the declaration reads as.
 */
export function isAllowedBlockType(
  type: string,
  allow: readonly string[]
): boolean {
  return allow.some(pattern => {
    if (!pattern.endsWith("/*")) return type === pattern;
    return type.startsWith(pattern.slice(0, -1));
  });
}

/**
 * Every node type in a forest that the list does not admit, nested ones
 * included.
 *
 * The whole forest rather than its roots, because that is what a save judges:
 * a pattern whose section is allowed but whose quote inside it is not is
 * refused exactly like a quote placed at the root.
 */
export function disallowedTypesIn(
  nodes: BlockNode[],
  allow: readonly string[]
): Set<string> {
  const disallowed = new Set<string>();
  walkNodes(nodes, node => {
    if (
      typeof node.type === "string" &&
      !isAllowedBlockType(node.type, allow)
    ) {
      disallowed.add(node.type);
    }
  });
  return disallowed;
}

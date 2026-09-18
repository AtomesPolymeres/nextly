import { describe, expect, it } from "vitest";

import { toSnakeName } from "./field-transformers";

/**
 * The rule an auto-derived Name follows when a Label carries punctuation.
 *
 * A field Name is a database column name and an API response key, so it may
 * carry only `a-z`, `0-9` and `_`. The derivation once translated the Label
 * character-by-character — every space, period, apostrophe or colon became
 * its own underscore — so "phone no." named the column "phone_no_" and a
 * punctuation-only label produced a name of pure underscores. The rule the
 * builder already applies everywhere else (`startingFieldName`,
 * `toKebabName`) is the one followed here: a RUN of anything that is not a
 * letter or a digit collapses to one underscore, and nothing dangles at
 * either end.
 *
 * @module lib/builder/to-snake-name.test
 */
describe("toSnakeName", () => {
  it("drops trailing punctuation rather than leaving a dangling underscore", () => {
    expect(toSnakeName("phone no.")).toBe("phone_no");
  });

  it("collapses a run of special characters into a single underscore", () => {
    expect(toSnakeName("Author's: Note;")).toBe("author_s_note");
  });

  it("trims separator runs at the start as well", () => {
    expect(toSnakeName("*Main Title*")).toBe("main_title");
  });

  it("leaves already-clean names untouched (the save path re-derives them)", () => {
    expect(toSnakeName("already_snake_name")).toBe("already_snake_name");
    expect(toSnakeName("line_2_address")).toBe("line_2_address");
  });

  it("reduces a punctuation-only label to nothing, not a row of underscores", () => {
    expect(toSnakeName("?!")).toBe("");
  });
});

/**
 * A recovery point nobody can date is not described (agency #48).
 *
 * The indicator branched on `lastSavedAt` being truthy, and an invalid `Date`
 * is an object: it took the "recovery point stored" branch and computed an age
 * from `NaN`. The label says which branch was taken, so it is what these read —
 * the tooltip itself only renders on hover.
 */
import { describe, it, expect } from "vitest";

import { render, screen } from "@admin/__tests__/utils";

import { AutoSaveIndicator } from "../AutoSaveIndicator";

describe("AutoSaveIndicator with a date it cannot read", () => {
  it("does not claim a recovery point for an invalid date", () => {
    render(
      <AutoSaveIndicator
        lastSavedAt={new Date(Number.NaN)}
        isSaving={false}
        isDirty
      />
    );

    expect(screen.getByText(/not saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it("still describes a recovery point it can date", () => {
    render(
      <AutoSaveIndicator
        lastSavedAt={new Date(Date.now() - 3 * 60_000)}
        isSaving={false}
        isDirty
      />
    );

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });
});

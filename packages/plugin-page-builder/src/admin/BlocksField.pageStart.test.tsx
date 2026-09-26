// @vitest-environment jsdom

/**
 * A NEW page opens on the patterns it may start from, not on a blank canvas
 * (agency #52) — and the blank page stays one click away.
 *
 * The chooser's own behaviour is in `PageStartChooser.test`. This asks what
 * that file cannot: whether the EDITOR mounts it for a new page and only for
 * one, and whether a choice reaches the document the editor holds.
 *
 * The same harness as `BlocksField.savePattern.test`, for its reason: the real
 * shell needs a measured DOM to draw, and what is under test is what this
 * component does around it.
 *
 * @module admin/BlocksField.pageStart.test
 */
import { ShortcutProvider } from "@nextlyhq/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIBRARY_ROUTE_PATH } from "../library-contract";

import { OPEN_BUILDER_ACTION } from "./PageBuilderCard";

/** The rows the pattern route answers with, for the test in hand. */
let library: unknown[] = [];

const pagePattern = (id: string, title: string, text: string) => ({
  id,
  title,
  granularity: "page",
  document: {
    formatVersion: 1,
    kind: "pattern",
    nodes: [{ id: `${id}-t`, type: "core/text", version: 1, props: { text } }],
  },
});

vi.mock("@nextlyhq/builder/shell", async importOriginal => {
  const real = await importOriginal<Record<string, unknown>>();
  const nothing = (): null => null;
  const passthrough = ({
    children,
  }: {
    children?: React.ReactNode;
  }): React.JSX.Element => <>{children}</>;
  return {
    ...real,
    /*
      Stands in for the shell, but keeps the ONE thing below it depends on: the
      real shell provides the shortcut context, and the verbs provider reads it.
      A plain div here fails with "useShortcuts must be called inside a
      ShortcutProvider" — a failure about the harness rather than the subject.
    */
    BuilderShell: ({
      children,
    }: {
      children?: React.ReactNode;
    }): React.JSX.Element => (
      <ShortcutProvider>
        <div>{children}</div>
      </ShortcutProvider>
    ),
    /*
      The REAL provider, wrapped to record what it was handed. Replacing it
      outright would remove the context the palette and the context menu read,
      so the case would fail for a reason that is not the verb — and, worse, a
      recorder that never published the verb could not tell a verb that reaches
      the chain from one that merely reaches this mock.
    */
    BlockKeyboardActions: (props: {
      children?: React.ReactNode;
    }): React.JSX.Element => {
      const Real = real.BlockKeyboardActions as React.ComponentType<
        typeof props
      >;
      return <Real {...props} />;
    },
    BlockToolbar: nothing,
    BreakpointManager: nothing,
    BreakpointSwitcher: nothing,
    InspectorPanel: nothing,
    InsertPanel: nothing,
    LayersPanel: nothing,
    TokensStudio: nothing,
    BlockContextMenu: passthrough,
  };
});

vi.mock("@nextlyhq/plugin-sdk/admin", () => ({
  loadInlineRichTextEditor: () => new Promise<never>(() => {}),
  usePluginClientConfig: () => ({}),
  // No document around the field: the state every case here was written
  // against, and the one that offers every component.
  useDocumentIdentity: () => null,
  // Nor a language the field could know: the component read asks for the
  // app default.
  useDocumentLocale: () => null,
  // The pattern library answers with `library`; every other read with
  // nothing, which is how the component tier looks on a site with none.
  usePluginRoute: ({ path }: { path: string }) => ({
    data:
      path === LIBRARY_ROUTE_PATH
        ? { items: library, meta: { count: library.length, truncated: false } }
        : undefined,
    pending: false,
    error: null,
    refetch: () => {},
  }),
  // The write the form makes. Never called by these cases — they stop at the
  // form appearing — but the module the form imports resolves it at load, so a
  // mock that omitted it would fail the import rather than the assertion.
  usePluginRouteMutation: () => ({
    write: async () => ({
      message: "Pattern created.",
      item: { id: "p1" },
    }),
    pending: false,
    error: null,
  }),
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
  useDocumentCheckpoint: () => ({ schedule: () => {} }),
  useEntryFieldsPanel: () => null,
  useReportUnsavedWork: () => {},
  useSuppressAdminChrome: () => {},
  useDocumentStatus: () => null,
  validationIssues: () => [],
  /*
   * The admin's canonical mutation-warning toast, which the form reports a
   * committed-but-partly-failed save through. Recorded rather than stubbed to
   * nothing: what it is CALLED with is the assertion — the array carries
   * failures and advisories, and one message for both would report a
   * successful notice as a failure.
   */
  toastMutationResult: (
    message: string,
    warnings: readonly { severity: string }[] | undefined
  ) => {
    void message;
    void warnings;
  },
  useSingleDocument: () => ({ data: undefined, isPending: false, error: null }),
  useUpdateSingleDocument: () => ({
    mutateAsync: async () => ({ success: true }),
    isPending: false,
  }),
}));

const { BlocksField } = await import("./BlocksField");

function Host({ value }: { value?: unknown }): React.JSX.Element {
  const { control } = useForm({ defaultValues: { body: value } });
  return <BlocksField name="body" control={control} />;
}

function openEditor(value?: unknown): void {
  render(<Host value={value} />);
  fireEvent.click(screen.getByRole("button", { name: OPEN_BUILDER_ACTION }));
}

const chooser = () =>
  screen.queryByRole("dialog", { name: /start this page from a template/i });

beforeEach(() => {
  library = [
    pagePattern("contact", "Contact — Vitrine", "Écrivez-nous"),
    pagePattern("tarifs", "Tarifs — Vitrine", "Nos offres"),
    {
      id: "hero",
      title: "Hero",
      granularity: "section",
      document: { formatVersion: 1, kind: "pattern", nodes: [] },
    },
  ];
});

afterEach(cleanup);

describe("a new page", () => {
  it("opens on its page patterns, each by name", () => {
    openEditor();

    expect(chooser()).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /Contact — Vitrine/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Tarifs — Vitrine/ })
    ).toBeTruthy();
    // A section is inserted into a page, never offered as one.
    expect(screen.queryByRole("button", { name: /^Hero/ })).toBeNull();
  });

  it("starts from the chosen pattern, placing its blocks", () => {
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: /Contact — Vitrine/ }));

    expect(chooser()).toBeNull();
    // On the canvas: the pattern's own text, so the page holds its blocks.
    expect(screen.getByText("Écrivez-nous")).toBeTruthy();
    expect(screen.queryByText("Nos offres")).toBeNull();
  });

  it("keeps the blank page one click away", () => {
    openEditor();

    fireEvent.click(
      screen.getByRole("button", { name: /start from a blank page/i })
    );

    expect(chooser()).toBeNull();
    expect(screen.queryByText("Écrivez-nous")).toBeNull();
  });

  it("goes straight to the canvas when the library has no page to offer", () => {
    library = [];
    openEditor();

    expect(chooser()).toBeNull();
  });
});

describe("a page that already has content", () => {
  it("is not offered a start, which would replace it", () => {
    // The control. Starting from a pattern replaces the root forest, so
    // offering it here would put an author's page one click from gone.
    openEditor({
      formatVersion: 1,
      kind: "page",
      nodes: [
        { id: "mine", type: "core/text", version: 1, props: { text: "À moi" } },
      ],
    });

    expect(chooser()).toBeNull();
  });
});

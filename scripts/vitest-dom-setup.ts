/**
 * The two test-environment rules, made boundaries rather than conventions.
 *
 * Both were previously left to each file to remember, and both fail SILENTLY
 * and in the reassuring direction — a file that forgets either one passes.
 *
 * ## Renders are torn down between cases
 *
 * `@testing-library/react` unmounts automatically only when something has
 * registered its cleanup. Nothing did. A file without its own `afterEach`
 * therefore accumulates every render into ONE document, and `querySelector`
 * answers with the FIRST case's element — so later cases assert against a tree
 * belonging to a test that has already finished, and agree with it.
 *
 * ## `act` is reported as configured
 *
 * Measured, and NOT what the name suggests: `React.act` runs and flushes its
 * queue whether or not `IS_REACT_ACT_ENVIRONMENT` is set. What the flag decides
 * is whether React reports the environment as unconfigured — a `console.error`
 * that a suite full of expected output scrolls straight past, and that nothing
 * fails on.
 *
 * So the cost of missing it is not a test that does nothing; it is a warning
 * nobody reads, on every file that drives React itself. The testing library
 * sets the flag only around its own `act`-wrapped calls, so anything driving
 * React directly — a mocked component's callback, a bare `act` in a test — is
 * left without it.
 *
 * ## `ResizeObserver` exists
 *
 * jsdom does not implement it, and several design-system components are built
 * on Radix primitives that measure themselves through it — a radio group, a
 * checkbox, a scroll area. Without it the component throws during layout
 * effects, so the failure is a `ReferenceError` from inside `react-dom` rather
 * than anything naming the control under test.
 *
 * A stub rather than a polyfill: nothing here asserts on resize behaviour, and
 * the components need the constructor to exist rather than to report. Installed
 * only when the runtime has none, so a real implementation is never replaced.
 *
 * ## AGENCY: `EventSource` existe
 *
 * Même motif que `ResizeObserver`, et même raison de le traiter ici plutôt que
 * fichier par fichier. jsdom ne l'implémente pas, et le module admin y touche à
 * l'ÉVALUATION — donc l'échec arrive à l'import du fichier de test, avant la
 * collecte : `0 test`, un `ReferenceError` qui ne nomme rien de ce qui est
 * testé, et une suite entière qui disparaît du décompte sans qu'aucune
 * assertion n'ait échoué.
 *
 * Sept fichiers tombaient ainsi — quatre dans `builder`, trois dans
 * `plugin-page-builder` — et la parade employée ailleurs est un
 * `vi.mock("@nextlyhq/plugin-sdk/admin")` par fichier, que ces sept n'ont pas.
 * Une règle que chaque fichier doit se rappeler est exactement ce que ce
 * module existe pour supprimer.
 *
 * Un bouchon, pas un polyfill : rien ici n'assied quoi que ce soit sur du
 * Server-Sent Events. Ce qui est attendu, c'est que le constructeur existe.
 * `readyState` vaut `CONNECTING` et rien n'émet jamais, ce qui est la seule
 * réponse honnête d'un flux qui ne se connectera pas — préférable à `OPEN`,
 * qui ferait croire à une connexion établie.
 *
 * ## Guarded, because most files here have no DOM
 *
 * Both packages that load this run `environment: "node"` and opt into jsdom
 * per file, so the majority of files that load it have no `document`. The work is done only
 * where there is one, and the testing library is imported only there: pulling
 * `react-dom` into a runtime that cannot host it would turn a setup file meant
 * to protect the DOM suites into a reason the node ones cannot start.
 *
 * ## One copy, outside every package
 *
 * Loaded by each package's vitest config by relative path rather than copied
 * into each one. Two copies of a rule this quiet is how a later fix reaches one
 * package and leaves the other silently on the old behaviour — and the whole
 * point of these two rules is that nothing tells you when they are missing.
 *
 * Here rather than in a package because it is dev tooling, not published
 * source: a shared module inside `packages/` would be a new entry in a
 * 25-package lockstep release for thirty lines no consumer ever loads. It also
 * imports `vitest`, so it cannot live in a package whose layering guard counts
 * anything in `src` that is not a test as source.
 */
import { afterEach } from "vitest";

if ("document" in globalThis) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  if (!("EventSource" in globalThis)) {
    (globalThis as { EventSource?: unknown }).EventSource = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readonly readyState = 0;
      readonly url: string;
      onopen: unknown = null;
      onmessage: unknown = null;
      onerror: unknown = null;
      constructor(url: string) {
        this.url = url;
      }
      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return false;
      }
      close(): void {}
    };
  }
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}

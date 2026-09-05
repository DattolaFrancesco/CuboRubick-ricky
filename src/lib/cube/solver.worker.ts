import Cube from "cubejs";

/**
 * Web Worker che risolve il cubo con `cubejs` (Kociemba a due fasi).
 *
 * Gira fuori dal thread principale perché `initSolver()` costruisce delle
 * tabelle di pruning e blocca ~1 secondo alla prima chiamata. Dopo, ogni
 * `solve()` è nell'ordine dei millisecondi.
 *
 * Protocollo:
 *   in : { id, facelets }   facelets = 54 caratteri, ordine URFDLB
 *   out: { id, solution }   oppure { id, error }
 */

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; facelets: string }>) => void) | null;
  postMessage: (msg: unknown) => void;
};

let initialized = false;

ctx.onmessage = (e) => {
  const { id, facelets } = e.data;
  try {
    if (!initialized) {
      Cube.initSolver();
      initialized = true;
    }
    const solution = Cube.fromString(facelets).solve();
    ctx.postMessage({ id, solution });
  } catch (err) {
    ctx.postMessage({ id, error: (err as Error).message ?? String(err) });
  }
};

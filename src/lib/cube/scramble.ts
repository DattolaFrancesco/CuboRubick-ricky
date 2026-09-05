import { ALL_FACES, FACE_GEOMETRY } from "./moves";
import type { Move } from "./types";

/**
 * Genera una sequenza di mosse casuali per mescolare il cubo.
 *
 * Regole per una mescolata "sensata":
 *  - non due mosse di fila sulla stessa faccia (si annullerebbero/combinerebbero);
 *  - non tre mosse di fila sullo stesso asse (es. R L R): ridondante.
 * Ogni mossa è oraria, antioraria o doppia con uguale probabilità.
 */
export function randomScramble(length = 20): Move[] {
  const moves: Move[] = [];
  let lastFace: string | null = null;
  let lastAxis: number | null = null;
  let sameAxisRun = 0;

  while (moves.length < length) {
    const face = ALL_FACES[Math.floor(Math.random() * ALL_FACES.length)];
    if (face === lastFace) continue;

    const axis = FACE_GEOMETRY[face].axis;
    if (axis === lastAxis && sameAxisRun >= 2) continue;

    sameAxisRun = axis === lastAxis ? sameAxisRun + 1 : 1;
    lastAxis = axis;
    lastFace = face;

    const r = Math.floor(Math.random() * 3);
    moves.push(
      r === 0
        ? { face, dir: 1 }
        : r === 1
          ? { face, dir: -1 }
          : { face, dir: 1, double: true },
    );
  }

  return moves;
}

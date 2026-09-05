import { multiplyMat, roundVec, rotationMat, applyMat } from "./math";
import type { Cubie, CubeState, FaceId, Move } from "./types";

/**
 * Definizione geometrica di ogni faccia:
 *  - `axis`: asse attorno a cui ruota lo strato (0=X, 1=Y, 2=Z)
 *  - `sign`: valore della coordinata (lungo `axis`) dei cubetti dello strato,
 *            ovvero anche il verso della normale uscente della faccia
 *
 * Verso di rotazione: una mossa "dir = 1" è oraria GUARDANDO la faccia da fuori.
 * Con la convenzione destrorsa questo equivale a ruotare di `-sign` quarti di
 * giro attorno all'asse (quindi quarterTurns = -sign * dir).
 * Esempio: U (sign +1) oraria dall'alto => Ry(-90°); D (sign -1) => Ry(+90°).
 */
export const FACE_GEOMETRY: Record<FaceId, { axis: 0 | 1 | 2; sign: 1 | -1 }> = {
  R: { axis: 0, sign: 1 },
  L: { axis: 0, sign: -1 },
  U: { axis: 1, sign: 1 },
  D: { axis: 1, sign: -1 },
  F: { axis: 2, sign: 1 },
  B: { axis: 2, sign: -1 },
};

export const ALL_FACES: FaceId[] = ["U", "D", "L", "R", "F", "B"];

/** Trova la faccia dato l'asse (0/1/2) e il segno dello strato (±1). */
export function faceFromAxisSign(axis: 0 | 1 | 2, sign: 1 | -1): FaceId {
  for (const face of ALL_FACES) {
    const g = FACE_GEOMETRY[face];
    if (g.axis === axis && g.sign === sign) return face;
  }
  throw new Error(`Nessuna faccia per axis=${axis} sign=${sign}`);
}

/**
 * Quarti di giro (attorno all'asse positivo della faccia) equivalenti alla mossa.
 * Utile per l'animazione: l'angolo continuo è quarterTurns · 90°.
 */
export function moveQuarterTurns(move: Move): number {
  const { sign } = FACE_GEOMETRY[move.face];
  const base = -sign * move.dir;
  return move.double ? base * 2 : base;
}

/**
 * Applica una mossa allo stato e restituisce un NUOVO stato (immutabile).
 *
 * Passi:
 *  1. individua i 9 cubetti dello strato (coordinata lungo l'asse == sign)
 *  2. per ciascuno: ruota la posizione e pre-moltiplica l'orientamento per la
 *     matrice di rotazione dello strato (local->world segue la rotazione del mondo)
 *  3. i cubetti fuori dallo strato restano invariati
 */
export function applyMove(state: CubeState, move: Move): CubeState {
  const { axis, sign } = FACE_GEOMETRY[move.face];
  const rot = rotationMat(axis, moveQuarterTurns(move));

  const cubies: Cubie[] = state.cubies.map((cubie) => {
    if (cubie.position[axis] !== sign) return cubie; // fuori dallo strato

    return {
      ...cubie,
      position: roundVec(applyMat(rot, cubie.position)),
      // pre-moltiplicazione: prima l'orientamento locale, poi la rotazione dello strato
      orientation: multiplyMat(rot, cubie.orientation),
    };
  });

  return { cubies };
}

/** Applica una sequenza di mosse in ordine. */
export function applyMoves(state: CubeState, moves: Move[]): CubeState {
  return moves.reduce(applyMove, state);
}

/** Inverte una mossa (U -> U', U' -> U, U2 -> U2). */
export function invertMove(move: Move): Move {
  return move.double ? move : { ...move, dir: (move.dir * -1) as 1 | -1 };
}

/** Inverte una sequenza (ordine invertito + ogni mossa invertita). */
export function invertSequence(moves: Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}

// ---------------------------------------------------------------------------
// Notazione di Singmaster: "U", "U'", "U2", "R", ...
// ---------------------------------------------------------------------------

/** Converte una mossa in stringa ("U", "R'", "F2"). */
export function moveToString(move: Move): string {
  if (move.double) return `${move.face}2`;
  return move.dir === 1 ? move.face : `${move.face}'`;
}

/** Converte una sequenza in stringa separata da spazi. */
export function sequenceToString(moves: Move[]): string {
  return moves.map(moveToString).join(" ");
}

/** Parsa un singolo token ("U", "R'", "F2") in Move. Lancia se non valido. */
export function parseMove(token: string): Move {
  const m = /^([UDLRFB])(['2]?)$/.exec(token.trim());
  if (!m) throw new Error(`Mossa non valida: "${token}"`);
  const face = m[1] as FaceId;
  if (m[2] === "2") return { face, dir: 1, double: true };
  return { face, dir: m[2] === "'" ? -1 : 1 };
}

/** Parsa una sequenza ("R U R' U'") in Move[]. */
export function parseSequence(text: string): Move[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(parseMove);
}

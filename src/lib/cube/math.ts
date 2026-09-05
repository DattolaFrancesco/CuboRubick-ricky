import type { Vec3 } from "./types";

/**
 * Piccola algebra lineare a valori INTERI per il modello del cubo.
 *
 * Tutte le rotazioni in gioco sono multipli di 90°, quindi lavoriamo solo con
 * matrici 3x3 di interi (elementi in {-1,0,1}). Niente errori di
 * arrotondamento: lo stato del cubo resta sempre esatto.
 *
 * Le matrici sono array di 9 numeri in ordine row-major:
 *   [ m00, m01, m02, m10, m11, m12, m20, m21, m22 ]
 */

export const IDENTITY_3X3: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Prodotto matrice 3x3 (a) per vettore colonna (v). */
export function applyMat(m: number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Prodotto tra due matrici 3x3: risultato = a · b. */
export function multiplyMat(a: number[], b: number[]): number[] {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[r * 3 + k] * b[k * 3 + c];
      out[r * 3 + c] = s;
    }
  }
  return out;
}

/**
 * Matrice di rotazione intera di `quarterTurns` × 90° attorno a un asse.
 * `axis`: 0 = X, 1 = Y, 2 = Z. Convenzione destrorsa (regola della mano destra).
 */
export function rotationMat(axis: 0 | 1 | 2, quarterTurns: number): number[] {
  // Normalizza in {0,1,2,3}
  const q = ((quarterTurns % 4) + 4) % 4;
  const c = [1, 0, -1, 0][q]; // cos(q·90°)
  const s = [0, 1, 0, -1][q]; // sin(q·90°)
  if (axis === 0) {
    // rotazione attorno a X
    return [1, 0, 0, 0, c, -s, 0, s, c];
  }
  if (axis === 1) {
    // rotazione attorno a Y
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  }
  // rotazione attorno a Z
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Arrotonda le componenti di un vettore all'intero più vicino (pulizia numerica). */
export function roundVec(v: Vec3): Vec3 {
  return [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];
}

/** Uguaglianza esatta tra vettori interi. */
export function vecEquals(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

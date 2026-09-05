import { roundVec } from "./math";
import { faceFromAxisSign } from "./moves";
import type { Move, Vec3 } from "./types";

/**
 * Traduce un gesto di trascinamento sulla superficie del cubo nella mossa
 * corrispondente (uno dei 12 quarti di giro U/D/L/R/F/B e inversi).
 *
 * Idea geometrica:
 *  - `faceNormal` è la normale (nel mondo) del quadratino toccato: individua
 *    quale delle 6 facce stiamo trascinando.
 *  - `dragDir` è la direzione del trascinamento nello spazio del mondo; la
 *    "snappiamo" all'asse dominante fra i due perpendicolari alla normale.
 *  - L'asse di rotazione dello strato è  faceNormal × dragDir  (prodotto
 *    vettoriale): perpendicolare sia alla faccia che alla direzione di drag.
 *  - Lo strato interessato è quello che contiene il cubetto toccato lungo
 *    quell'asse. Se è lo strato centrale (coordinata 0) la mossa è una slice:
 *    per ora non gestita (lo spec chiede solo le facce esterne).
 *
 * Ritorna `null` se il gesto è ambiguo o riguarda lo strato centrale.
 */
export function resolveDragMove(params: {
  cubiePosition: Vec3;
  faceNormal: Vec3;
  dragDir: Vec3;
}): Move | null {
  const n = roundVec(params.faceNormal);
  const nAxis = n.findIndex((c) => Math.abs(c) === 1);
  if (nAxis < 0) return null;

  // asse dominante del drag fra i due perpendicolari alla normale
  const drag = dominantAxis(params.dragDir, nAxis);
  if (!drag) return null;
  const dragVec: Vec3 = [0, 0, 0];
  dragVec[drag.index] = drag.sign;

  // rotAxis = n × dragVec  ->  uno dei ±X/±Y/±Z
  const rotAxis: Vec3 = [
    n[1] * dragVec[2] - n[2] * dragVec[1],
    n[2] * dragVec[0] - n[0] * dragVec[2],
    n[0] * dragVec[1] - n[1] * dragVec[0],
  ];
  const kAxis = rotAxis.findIndex((c) => Math.abs(c) === 1);
  if (kAxis < 0) return null;
  const rotSign: 1 | -1 = rotAxis[kAxis] >= 0 ? 1 : -1;

  const layer = Math.round(params.cubiePosition[kAxis]);
  if (layer === 0) return null; // slice: non gestita

  const face = faceFromAxisSign(kAxis as 0 | 1 | 2, layer as 1 | -1);
  // vogliamo che lo strato ruoti di +90° attorno a rotAxis (segue il drag).
  // moveQuarterTurns = -sign * dir  deve valere  rotSign  =>  dir = -rotSign/layer
  const dir = ((-rotSign / layer) | 0) as 1 | -1;
  return { face, dir };
}

/** Componente assiale di modulo massimo di `v`, escludendo l'asse `exclude`. */
function dominantAxis(
  v: Vec3,
  exclude: number,
): { index: number; sign: 1 | -1 } | null {
  let index = -1;
  let max = 1e-6;
  for (let i = 0; i < 3; i++) {
    if (i === exclude) continue;
    if (Math.abs(v[i]) > max) {
      max = Math.abs(v[i]);
      index = i;
    }
  }
  if (index < 0) return null;
  return { index, sign: v[index] >= 0 ? 1 : -1 };
}

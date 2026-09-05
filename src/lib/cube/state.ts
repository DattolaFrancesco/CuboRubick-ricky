import { COLOR_TO_FACE, FACE_COLOR } from "./colors";
import { IDENTITY_3X3, applyMat } from "./math";
import {
  SOLVER_FACE_ORDER,
  type Cubie,
  type CubeState,
  type FaceId,
  type Sticker,
  type StickerColor,
  type Vec3,
} from "./types";

/**
 * Le 6 direzioni locali di un cubetto e la faccia del cubo a cui corrispondono
 * quando il cubo è risolto (orientamento identità).
 */
const LOCAL_DIRECTIONS: { normal: Vec3; face: FaceId }[] = [
  { normal: [1, 0, 0], face: "R" },
  { normal: [-1, 0, 0], face: "L" },
  { normal: [0, 1, 0], face: "U" },
  { normal: [0, -1, 0], face: "D" },
  { normal: [0, 0, 1], face: "F" },
  { normal: [0, 0, -1], face: "B" },
];

/**
 * Indice 0..8 del quadratino (facelet) all'interno della sua faccia.
 *
 * Usa l'ordine di lettura (sinistra->destra, alto->basso) con l'orientamento
 * standard usato dai solver di Kociemba:
 *   U: guardata dall'alto con la faccia F in basso
 *   D: guardata dal basso con la faccia F in alto
 *   F/B/R/L: guardate di fronte con U in alto
 *
 * (x, y, z) è la posizione del cubetto che porta il facelet, con componenti in
 * {-1, 0, 1}. Il risultato è deterministico e stabile: viene "congelato"
 * nell'id dello sticker alla creazione del cubo.
 */
export function faceletIndex(face: FaceId, x: number, y: number, z: number): number {
  switch (face) {
    case "U":
      return (z + 1) * 3 + (x + 1);
    case "D":
      return (1 - z) * 3 + (x + 1);
    case "F":
      return (1 - y) * 3 + (x + 1);
    case "B":
      return (1 - y) * 3 + (1 - x);
    case "R":
      return (1 - y) * 3 + (1 - z);
    case "L":
      return (1 - y) * 3 + (z + 1);
  }
}

/** Costruisce il cubo risolto: 27 cubetti, ognuno con i suoi 6 sticker. */
export function createSolvedCube(): CubeState {
  const cubies: Cubie[] = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const position: Vec3 = [x, y, z];

        const stickers: Sticker[] = LOCAL_DIRECTIONS.map(({ normal, face }) => {
          // Lo sticker è "esterno" (colorato) solo se la componente di posizione
          // lungo la sua normale vale ±1 e combacia con la direzione.
          const along =
            normal[0] !== 0 ? x : normal[1] !== 0 ? y : z;
          const dirSign =
            normal[0] !== 0 ? normal[0] : normal[1] !== 0 ? normal[1] : normal[2];
          const isOuter = along === dirSign;

          const color: StickerColor = isOuter ? FACE_COLOR[face] : null;
          // id stabile: lettera faccia + indice facelet nello stato risolto.
          const id = isOuter ? `${face}${faceletIndex(face, x, y, z)}` : `in-${x},${y},${z}-${normal.join("")}`;

          return { id, color, localNormal: normal };
        });

        cubies.push({
          id: `${x},${y},${z}`,
          position,
          orientation: [...IDENTITY_3X3],
          stickers,
        });
      }
    }
  }

  return { cubies };
}

/** Normale di uno sticker nel sistema di riferimento del MONDO. */
export function stickerWorldNormal(cubie: Cubie, sticker: Sticker): Vec3 {
  return applyMat(cubie.orientation, sticker.localNormal);
}

/** True se il cubo è risolto: ogni faccia mostra un solo colore. */
export function isSolved(state: CubeState): boolean {
  const byFace = new Map<string, Set<StickerColor>>();
  for (const cubie of state.cubies) {
    for (const sticker of cubie.stickers) {
      if (sticker.color === null) continue;
      const n = applyMat(cubie.orientation, sticker.localNormal);
      // Solo le facce esterne (una componente ±1, il resto 0) contano.
      const key = normalKey(n, cubie.position);
      if (!key) continue;
      if (!byFace.has(key)) byFace.set(key, new Set());
      byFace.get(key)!.add(sticker.color);
    }
  }
  for (const colors of byFace.values()) {
    if (colors.size > 1) return false;
  }
  return true;
}

/**
 * Serializza lo stato in stringa "facelet" di 54 caratteri nell'ordine dei
 * solver di Kociemba (min2phase / cubejs): U R F D L B, ogni faccia letta
 * sinistra->destra, alto->basso con l'orientamento standard.
 *
 * Ogni carattere è la LETTERA della faccia a cui appartiene quel colore (il
 * colore di un centro non si sposta mai): bianco=U, rosso=R, verde=F, ...
 */
export function toFacelets(state: CubeState): string {
  const grid: Record<FaceId, string[]> = {
    U: Array(9).fill("."),
    R: Array(9).fill("."),
    F: Array(9).fill("."),
    D: Array(9).fill("."),
    L: Array(9).fill("."),
    B: Array(9).fill("."),
  };

  for (const cubie of state.cubies) {
    const [x, y, z] = cubie.position;
    for (const sticker of cubie.stickers) {
      if (sticker.color === null) continue;
      const worldNormal = applyMat(cubie.orientation, sticker.localNormal);
      const face = normalKey(worldNormal, cubie.position);
      if (!face) continue; // sticker interno
      grid[face][faceletIndex(face, x, y, z)] = COLOR_TO_FACE[sticker.color];
    }
  }

  return SOLVER_FACE_ORDER.map((f) => grid[f].join("")).join("");
}

/** Chiave "U"/"D"/... se lo sticker guarda verso l'esterno del cubo, altrimenti null. */
function normalKey(worldNormal: Vec3, position: Vec3): FaceId | null {
  const n: Vec3 = [
    Math.round(worldNormal[0]),
    Math.round(worldNormal[1]),
    Math.round(worldNormal[2]),
  ];
  if (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) !== 1) return null;
  if (n[0] === 1 && position[0] === 1) return "R";
  if (n[0] === -1 && position[0] === -1) return "L";
  if (n[1] === 1 && position[1] === 1) return "U";
  if (n[1] === -1 && position[1] === -1) return "D";
  if (n[2] === 1 && position[2] === 1) return "F";
  if (n[2] === -1 && position[2] === -1) return "B";
  return null;
}

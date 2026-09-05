/**
 * Tipi condivisi per il modello logico del cubo di Rubik.
 *
 * Il modello è "a cubetti" (cubie-based): il cubo 3x3 è composto da 27 cubetti,
 * ciascuno con una posizione discreta in {-1,0,1}^3 e un orientamento (rotazione
 * di multipli di 90°). Ogni faccia esterna di un cubetto porta uno "sticker"
 * (adesivo) con un colore fisso: lo sticker è l'identità stabile a cui vengono
 * agganciate le eventuali texture/foto, così le foto seguono il quadratino
 * anche durante mescolamento e risoluzione.
 */

/** Le 6 facce del cubo nella notazione standard di Singmaster. */
export type FaceId = "U" | "D" | "L" | "R" | "F" | "B";

export const FACE_IDS: FaceId[] = ["U", "D", "L", "R", "F", "B"];

/** Ordine dei facelet usato dai solver (min2phase / cubejs): U R F D L B. */
export const SOLVER_FACE_ORDER: FaceId[] = ["U", "R", "F", "D", "L", "B"];

/** Colore logico di uno sticker. `null` = faccia interna del cubetto (nera, non visibile). */
export type StickerColor =
  | "white"
  | "yellow"
  | "green"
  | "blue"
  | "red"
  | "orange"
  | null;

/** Vettore intero a 3 componenti (posizione cubetto o normale di faccia). */
export type Vec3 = [number, number, number];

/**
 * Uno sticker appartiene a una faccia locale del cubetto.
 *
 * - `id`: identificatore stabile per tutta la vita del cubo (es. "U4", "F0").
 *   Non cambia mai: serve da chiave per la texture/foto personalizzata.
 * - `color`: colore "verniciato" sullo sticker. Non cambia mai.
 * - `localNormal`: normale della faccia del cubetto su cui è incollato lo sticker,
 *   espressa nel sistema di riferimento LOCALE del cubetto. La normale nel mondo
 *   si ottiene ruotando questo vettore per l'orientamento corrente del cubetto.
 */
export interface Sticker {
  id: string;
  color: StickerColor;
  localNormal: Vec3;
}

/**
 * Un cubetto del 3x3.
 *
 * - `id`: identità stabile, coincide con la posizione da risolto (es. "1,1,-1").
 * - `position`: posizione corrente nella griglia, componenti in {-1,0,1}.
 * - `orientation`: matrice di rotazione 3x3 a valori interi (row-major, 9 numeri),
 *   sempre una rotazione di multipli di 90°. Applica orientamento LOCALE -> MONDO.
 * - `stickers`: i 6 sticker delle facce locali (i 3 interni hanno color = null).
 */
export interface Cubie {
  id: string;
  position: Vec3;
  orientation: number[]; // 9 interi, matrice 3x3 row-major
  stickers: Sticker[];
}

/** Stato completo del cubo: i 27 cubetti. Struttura immutabile lato consumatori. */
export interface CubeState {
  cubies: Cubie[];
}

/**
 * Una mossa elementare: rotazione di uno strato di 90°.
 * `face` individua lo strato, `dir` il verso (1 = orario guardando la faccia
 * dall'esterno, -1 = antiorario), `double` per le mosse a 180° (es. U2).
 */
export interface Move {
  face: FaceId;
  dir: 1 | -1;
  double?: boolean;
}

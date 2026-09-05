import type { FaceId, StickerColor } from "./types";

/**
 * Schema colori standard "occidentale":
 *   U bianco, D giallo, F verde, B blu, R rosso, L arancione.
 * (Bianco opposto a giallo, verde a blu, rosso ad arancione.)
 */
export const FACE_COLOR: Record<FaceId, Exclude<StickerColor, null>> = {
  U: "white",
  D: "yellow",
  F: "green",
  B: "blue",
  R: "red",
  L: "orange",
};

/** Valore CSS/hex per ogni colore logico, usato sia in 3D che nelle anteprime DOM. */
export const COLOR_HEX: Record<Exclude<StickerColor, null>, string> = {
  white: "#f5f5f5",
  yellow: "#ffd500",
  green: "#009b48",
  blue: "#0046ad",
  red: "#b71234",
  orange: "#ff5800",
};

/** Colore della plastica del cubo (bordini tra i quadratini e interni). */
export const CUBE_PLASTIC_HEX = "#111111";

/** Lettera della faccia associata a ciascun colore (per serializzare verso i solver). */
export const COLOR_TO_FACE: Record<Exclude<StickerColor, null>, FaceId> = {
  white: "U",
  red: "R",
  green: "F",
  yellow: "D",
  orange: "L",
  blue: "B",
};

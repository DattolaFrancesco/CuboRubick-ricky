/** Durata (secondi) dell'animazione di un quarto di giro. */
export const QUARTER_TURN_DURATION = 0.26;

/** Durata di una mossa doppia (180°). */
export const DOUBLE_TURN_DURATION = 0.4;

/** Soglia (unità mondo) oltre la quale un trascinamento diventa una mossa. */
export const DRAG_THRESHOLD = 0.35;

/** Nomi degli assi di rotazione di un Object3D indicizzati come nel modello. */
export const AXIS_NAME = ["x", "y", "z"] as const;

/** Easing morbido (accelera e decelera) per rotazioni degli strati. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

import * as THREE from "three";
import type { Vec3 } from "@/lib/cube/types";

/** Distanza tra i centri di due cubetti adiacenti nella scena 3D. */
export const CUBIE_SPACING = 1;

/** Lato del corpo (plastica) di un cubetto. < SPACING per lasciare i bordini. */
export const CUBIE_SIZE = 0.95;

/** Lato di uno sticker/quadratino colorato. */
export const STICKER_SIZE = 0.84;

/** Quanto lo sticker sporge dalla superficie del cubetto (evita z-fighting). */
export const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.001;

/**
 * Converte la matrice di orientamento del modello (9 interi, row-major,
 * local->world) in un quaternione Three.js utilizzabile su un <group>.
 */
export function orientationToQuaternion(m: number[]): THREE.Quaternion {
  const mat = new THREE.Matrix4().set(
    m[0], m[1], m[2], 0,
    m[3], m[4], m[5], 0,
    m[6], m[7], m[8], 0,
    0, 0, 0, 1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

/** Posizione nella scena di un cubetto data la sua posizione logica in {-1,0,1}. */
export function cubieScenePosition(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(
    p[0] * CUBIE_SPACING,
    p[1] * CUBIE_SPACING,
    p[2] * CUBIE_SPACING,
  );
}

/**
 * Per ogni faccia (indicata dalla normale locale dello sticker): gli assi del
 * MONDO che corrispondono a "verso destra" (u) e "verso l'alto" (v) di una foto
 * applicata a quella faccia. Scelti per combaciare con l'ordine dei facelet
 * (`faceletIndex`) e quindi con l'anteprima a griglia 3×3.
 */
const FACE_UV: Record<string, { u: Vec3; v: Vec3 }> = {
  "0,1,0": { u: [1, 0, 0], v: [0, 0, -1] }, // U
  "0,-1,0": { u: [1, 0, 0], v: [0, 0, 1] }, // D
  "0,0,1": { u: [1, 0, 0], v: [0, 1, 0] }, // F
  "0,0,-1": { u: [-1, 0, 0], v: [0, 1, 0] }, // B
  "1,0,0": { u: [0, 0, -1], v: [0, 1, 0] }, // R
  "-1,0,0": { u: [0, 0, 1], v: [0, 1, 0] }, // L
};

/**
 * Quaternione che orienta il piano di uno sticker (normale di default +Z, con
 * "destra" = +X e "alto" = +Y) in modo che:
 *  - la normale punti verso l'esterno del cubo (`normal`);
 *  - "destra"/"alto" della foto seguano gli assi giusti della faccia.
 * È una rotazione propria (u × v = normale): nessuna immagine specchiata.
 */
export function stickerOrientation(normal: Vec3): THREE.Quaternion {
  const { u, v } = FACE_UV[normal.join(",")];
  const uVec = new THREE.Vector3(...u);
  const vVec = new THREE.Vector3(...v);
  const nVec = new THREE.Vector3().crossVectors(uVec, vVec);
  const basis = new THREE.Matrix4().makeBasis(uVec, vVec, nVec);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

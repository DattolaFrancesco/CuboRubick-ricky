import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CubeState, Move, Vec3 } from "@/lib/cube/types";
import {
  FACE_GEOMETRY,
  faceFromAxisSign,
  moveQuarterTurns,
} from "@/lib/cube/moves";
import { COLOR_HEX, CUBE_PLASTIC_HEX } from "@/lib/cube/colors";
import { createSolvedCube } from "@/lib/cube/state";
import {
  CUBIE_SIZE,
  STICKER_OFFSET,
  STICKER_SIZE,
  cubieScenePosition,
  orientationToQuaternion,
  stickerOrientation,
} from "./sceneUtils";
import {
  AXIS_NAME,
  DOUBLE_TURN_DURATION,
  DRAG_THRESHOLD,
  QUARTER_TURN_DURATION,
  easeInOutCubic,
} from "./animation";

/**
 * Vista 3D del cubo realizzata con Three.js "puro" (senza react-three-fiber, che
 * non è compatibile con questa versione di Next/React).
 *
 * Separazione delle responsabilità:
 *  - questo file: SOLO rendering, scena, telecamera, input mouse, animazione;
 *  - lo stato logico del cubo vive in `src/lib/cube/` ed è passato via
 *    `syncTo()` / `animateMove()`.
 *
 * Modello a cubetti: 27 gruppi (`THREE.Group`), uno per cubetto, identificati
 * dall'id logico stabile. Ogni gruppo contiene il corpo di plastica e gli
 * sticker colorati. Gli sticker sono indicizzati per id stabile: `applyTextures`
 * ci monta la foto personalizzata, che così segue il quadratino durante
 * mescolamento e risoluzione.
 */

interface Callbacks {
  /** mossa nata da un trascinamento sulla superficie del cubo */
  onDragMove: (move: Move) => void;
  /** stato logico corrente (serve al drag per sapere dov'è ogni cubetto) */
  getCube: () => CubeState;
  /** se false, il trascinamento degli strati è disabilitato (es. durante un'anim.) */
  isDragEnabled: () => boolean;
  /** avanzamento reale del caricamento foto: quante sono pronte (decodificate e
   * applicate sul cubo, non solo scaricate) sul totale da caricare */
  onTextureProgress?: (loaded: number, total: number) => void;
}

interface ActiveAnim {
  pivot: THREE.Group;
  axisName: "x" | "y" | "z";
  angle: number;
  duration: number;
  elapsed: number;
  layerIds: string[];
  onDone: () => void;
}

export class CubeView {
  private container: HTMLElement;
  private cb: Callbacks;

  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private cubeGroup = new THREE.Group();

  /** cubetto -> gruppo Three, per id logico stabile */
  private cubies = new Map<string, THREE.Group>();
  /** sticker -> mesh, per id sticker stabile (raycast + texture personalizzata) */
  private stickers = new Map<string, THREE.Mesh>();

  private textureLoader = new THREE.TextureLoader();
  /** texture attualmente applicate: id sticker -> { url, texture } */
  private stickerTextures = new Map<string, { url: string; texture: THREE.Texture }>();
  /**
   * Conteggio dei caricamenti foto, a livello di istanza (non per singola
   * chiamata ad `applyTextures`): `applyTextures` può essere invocato più
   * volte di seguito (mount + effetto su `textures`) e la seconda chiamata
   * non vede nulla di "nuovo" da caricare, ma le foto della prima potrebbero
   * non essere ancora arrivate. `total` cresce solo per i caricamenti
   * effettivamente nuovi, quindi la frazione `completed/total` è il vero
   * avanzamento (raggiunge 1 esattamente quando il cubo è pronto sullo schermo,
   * non solo quando i byte sono scaricati).
   */
  private totalTextureLoads = 0;
  private completedTextureLoads = 0;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private activeAnim: ActiveAnim | null = null;

  private resizeObserver: ResizeObserver;
  private fallbackTimer = 0;
  private disposed = false;

  /**
   * Il trascinamento di uno strato è attivo SOLO con Shift premuto: senza Shift
   * il trascinamento fa orbitare la telecamera (OrbitControls). Con Shift
   * premuto l'orbita è sospesa così il cubo non si muove.
   */
  private shiftHeld = false;

  // stato del trascinamento di uno strato
  private drag: {
    /** posizione logica (-1/0/1) del cubetto afferrato */
    cubiePosition: Vec3;
    /** normale (assiale) della faccia toccata, nel mondo */
    normalWorld: Vec3;
    /** punto di presa nel mondo (sulla superficie della faccia) */
    origin: THREE.Vector3;
    plane: THREE.Plane;
  } | null = null;

  constructor(container: HTMLElement, cb: Callbacks) {
    this.container = container;
    this.cb = cb;

    const { clientWidth: w, clientHeight: h } = container;

    this.camera = new THREE.PerspectiveCamera(42, w / h || 1, 0.1, 100);
    this.camera.position.set(4.5, 4.5, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearAlpha(0);
    container.appendChild(this.renderer.domElement);

    // sfondo trasparente: il cubo vive sopra la "carta" chiara della pagina
    this.scene.background = null;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 8, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-5, -3, -6);
    this.scene.add(fill);

    this.scene.add(this.cubeGroup);
    this.buildCube();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 14;

    // capture: intercetta il pointerdown PRIMA di OrbitControls (stesso elemento):
    // con Shift blocchiamo l'orbita e ruotiamo invece uno strato.
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown, true);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.onWindowBlur);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.renderer.setAnimationLoop(this.tick);

    // Fallback: se il tab è nascosto (rAF sospeso) o su schermi che throttlano,
    // un timer a bassa frequenza continua comunque a far avanzare l'animazione,
    // così una mossa in coda non resta bloccata quando si cambia scheda.
    this.fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden" && this.activeAnim) this.tick();
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // Costruzione della geometria (una volta sola)
  // ---------------------------------------------------------------------------

  private buildCube() {
    const solved = createSolvedCube();
    const bodyGeo = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 4, 0.08);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: CUBE_PLASTIC_HEX,
      roughness: 0.85,
      metalness: 0,
    });
    const stickerGeo = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);

    for (const cubie of solved.cubies) {
      const group = new THREE.Group();
      group.position.copy(cubieScenePosition(cubie.position));

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      // il corpo di plastica è "raccoglibile" come gli sticker: cliccando i
      // bordini neri o gli spigoli il trascinamento parte comunque.
      body.userData = { cubieId: cubie.id, isBody: true };
      group.add(body);

      for (const sticker of cubie.stickers) {
        if (sticker.color === null) continue;
        const n = sticker.localNormal;
        const baseColor = COLOR_HEX[sticker.color];
        const mesh = new THREE.Mesh(
          stickerGeo,
          new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.5,
            metalness: 0,
          }),
        );
        mesh.position.set(
          n[0] * STICKER_OFFSET,
          n[1] * STICKER_OFFSET,
          n[2] * STICKER_OFFSET,
        );
        mesh.quaternion.copy(stickerOrientation(n));
        mesh.userData = {
          cubieId: cubie.id,
          stickerId: sticker.id,
          localNormal: n,
          baseColor, // per tornare al colore quando si rimuove la foto
        };
        group.add(mesh);
        this.stickers.set(sticker.id, mesh);
      }

      this.cubies.set(cubie.id, group);
      this.cubeGroup.add(group);
    }
  }

  // ---------------------------------------------------------------------------
  // Sincronizzazione con lo stato logico
  // ---------------------------------------------------------------------------

  /** Porta ogni cubetto alla posizione/orientamento dello stato dato (istantaneo). */
  syncTo(state: CubeState) {
    this.finishAnim(); // annulla eventuale animazione in corso
    for (const cubie of state.cubies) {
      const group = this.cubies.get(cubie.id);
      if (!group) continue;
      if (group.parent !== this.cubeGroup) this.cubeGroup.add(group);
      group.position.copy(cubieScenePosition(cubie.position));
      group.quaternion.copy(orientationToQuaternion(cubie.orientation));
    }
  }

  // ---------------------------------------------------------------------------
  // Foto personalizzate sugli sticker
  // ---------------------------------------------------------------------------

  /**
   * Applica le foto: `map` è id-sticker -> data URL. Gli sticker non presenti
   * tornano al colore di default. Fa il diff con lo stato corrente per
   * caricare/liberare solo ciò che cambia. La texture è agganciata all'id
   * stabile dello sticker, quindi segue il quadratino durante mescola/risolvi.
   */
  applyTextures(map: Record<string, string>) {
    for (const [id, mesh] of this.stickers) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const url = map[id];
      const current = this.stickerTextures.get(id);

      if (url) {
        if (current?.url === url) continue; // già assegnata (in corso o pronta)
        current?.texture.dispose();

        this.totalTextureLoads += 1;
        const onSettled = () => {
          this.completedTextureLoads += 1;
          this.cb.onTextureProgress?.(this.completedTextureLoads, this.totalTextureLoads);
        };
        const texture = this.textureLoader.load(url, onSettled, undefined, onSettled);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        mat.map = texture;
        mat.color.set(0xffffff); // non tingere la foto
        mat.needsUpdate = true;
        this.stickerTextures.set(id, { url, texture });
      } else if (current) {
        current.texture.dispose();
        this.stickerTextures.delete(id);
        mat.map = null;
        mat.color.set(mesh.userData.baseColor as string);
        mat.needsUpdate = true;
      }
    }

    // riporta subito l'avanzamento aggiornato, anche se questa chiamata non ha
    // aggiunto nulla di nuovo da caricare (es. rientra fra quelle già pronte)
    this.cb.onTextureProgress?.(this.completedTextureLoads, this.totalTextureLoads);
  }

  // ---------------------------------------------------------------------------
  // Animazione di una mossa
  // ---------------------------------------------------------------------------

  /**
   * Anima la rotazione dello strato di `move`. I 9 cubetti coinvolti vengono
   * riparentati sotto un "pivot" nell'origine di cui si anima la rotazione;
   * a fine animazione vengono "congelati" (riparentati mantenendo la posa) e
   * viene chiamato `onDone` (che a livello React applica la mossa al modello).
   */
  animateMove(move: Move, state: CubeState, onDone: () => void) {
    this.finishAnim();
    this.cancelDrag();

    const { axis, sign } = FACE_GEOMETRY[move.face];
    const layerIds = state.cubies
      .filter((c) => c.position[axis] === sign)
      .map((c) => c.id);

    const pivot = new THREE.Group();
    this.cubeGroup.add(pivot);
    for (const id of layerIds) {
      const group = this.cubies.get(id);
      if (group) pivot.attach(group); // attach = mantiene la posa nel mondo
    }

    this.activeAnim = {
      pivot,
      axisName: AXIS_NAME[axis],
      angle: moveQuarterTurns(move) * (Math.PI / 2),
      duration: move.double ? DOUBLE_TURN_DURATION : QUARTER_TURN_DURATION,
      elapsed: 0,
      layerIds,
      onDone,
    };
  }

  /** Chiude l'animazione in corso "congelando" i cubetti nella posa finale. */
  private finishAnim() {
    const a = this.activeAnim;
    if (!a) return;
    this.activeAnim = null;
    a.pivot.rotation[a.axisName] = a.angle; // posa esatta a 90°/180°
    a.pivot.updateMatrixWorld(true);
    for (const id of a.layerIds) {
      const group = this.cubies.get(id);
      if (group) this.cubeGroup.attach(group); // riparenta mantenendo la posa
    }
    this.cubeGroup.remove(a.pivot);
  }

  // ---------------------------------------------------------------------------
  // Loop di rendering
  // ---------------------------------------------------------------------------

  private tick = () => {
    if (this.disposed) return;
    const dt = this.clock.getDelta();

    const a = this.activeAnim;
    if (a) {
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.pivot.rotation[a.axisName] = a.angle * easeInOutCubic(t);
      if (t >= 1) {
        const done = a.onDone;
        this.finishAnim();
        done();
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------------------------------------------------------------------
  // Trascinamento di uno strato
  // ---------------------------------------------------------------------------

  private setPointer(ev: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  /** OrbitControls attivo solo se non si tiene Shift e non si sta trascinando uno strato. */
  private updateControlsEnabled() {
    this.controls.enabled = !this.shiftHeld && !this.drag;
    this.renderer.domElement.style.cursor = this.drag
      ? "grabbing"
      : this.shiftHeld
        ? "grab"
        : "";
  }

  private onKey = (ev: KeyboardEvent) => {
    const held = ev.shiftKey;
    if (held === this.shiftHeld) return;
    this.shiftHeld = held;
    this.updateControlsEnabled();
  };

  private onWindowBlur = () => {
    this.shiftHeld = false;
    this.updateControlsEnabled();
  };

  private onPointerDown = (ev: PointerEvent) => {
    // Senza Shift: lascia orbitare la camera (OrbitControls, listener che segue
    // sullo stesso elemento, in fase di bubble). Risincronizza qui il flag: se
    // per qualche motivo era rimasto bloccato a true (es. il mouse è stato
    // rilasciato prima del tasto), un click/drag senza Shift lo corregge subito
    // invece di lasciare l'orbita disabilitata per sempre.
    if (!ev.shiftKey) {
      if (this.shiftHeld) {
        this.shiftHeld = false;
        this.updateControlsEnabled();
      }
      return;
    }

    // Con Shift: l'orbita non deve MAI partire. Fermiamo l'evento qui, in fase
    // di capture, così il listener di OrbitControls non lo vede nemmeno.
    ev.stopImmediatePropagation();
    this.shiftHeld = true;
    this.updateControlsEnabled();
    if (this.activeAnim || !this.cb.isDragEnabled()) return;

    // assicura matrici aggiornate anche se il loop di rendering è fermo (tab nascosto)
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);

    this.setPointer(ev);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // raccoglie sia gli sticker sia i corpi di plastica: cliccare i bordini
    // neri o gli spigoli fa comunque partire il trascinamento.
    const hits = this.raycaster.intersectObject(this.cubeGroup, true);
    const hit = hits.find(
      (h) => h.face && (h.object.userData as { cubieId?: string }).cubieId,
    );
    if (!hit || !hit.face) return;
    const point = hit.point;
    const cubieId = (hit.object.userData as { cubieId: string }).cubieId;
    const cubie = this.cb.getCube().cubies.find((c) => c.id === cubieId);
    if (!cubie) return;

    // Faccia esterna toccata: la ricaviamo dal punto colpito rispetto al centro
    // del cubo (asse di coordinata massima), NON dalla normale del triangolo.
    // Il raggio può sfiorare la fessura fra due cubetti e colpire una faccia
    // INTERNA (quella rivolta verso il centro): la sua normale sarebbe quella
    // sbagliata, mentre la posizione del punto resta comunque vicina alla vera
    // superficie esterna.
    const abs = [Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)];
    const axis = abs.indexOf(Math.max(...abs));
    const normalWorld: Vec3 = [0, 0, 0];
    normalWorld[axis] = point.getComponent(axis) >= 0 ? 1 : -1;

    this.drag = {
      cubiePosition: cubie.position,
      normalWorld,
      origin: point.clone(),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(...normalWorld),
        point,
      ),
    };
    this.updateControlsEnabled();
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  };

  private onPointerMove = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    this.camera.updateMatrixWorld();
    this.setPointer(ev);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(d.plane, hit)) return;

    const delta = hit.sub(d.origin);
    if (delta.length() < DRAG_THRESHOLD) return;

    const move = this.dragToMove(d.cubiePosition, d.normalWorld, d.origin, delta);
    this.cancelDrag();
    if (move) this.cb.onDragMove(move);
  };

  /**
   * Trascinamento su un pezzo → rotazione dello strato "agganciato" a QUEL
   * pezzo, come se tirassi fisicamente lo spigolo/angolo che hai afferrato
   * (non l'intera faccia toccata).
   *
   * Geometria: l'asse di rotazione è `normale faccia × direzione trascinamento`
   * (perpendicolare a entrambi); lo strato che gira è quello che contiene il
   * cubetto afferrato lungo quell'asse. Se hai afferrato la striscia centrale
   * (coordinata 0 su quell'asse) non c'è uno strato esterno univoco: in quel
   * caso ripiega su "gira la faccia che stai toccando".
   */
  private dragToMove(
    cubiePosition: Vec3,
    normalWorld: Vec3,
    grab: THREE.Vector3,
    delta: THREE.Vector3,
  ): Move | null {
    const nAxis = (normalWorld[0] ? 0 : normalWorld[1] ? 1 : 2) as 0 | 1 | 2;
    const nSign = (normalWorld[nAxis] >= 0 ? 1 : -1) as 1 | -1;

    // asse tangente dominante nella direzione del trascinamento
    const deltaArr: Vec3 = [delta.x, delta.y, delta.z];
    let dragAxis = -1;
    let max = 1e-6;
    for (let i = 0; i < 3; i++) {
      if (i === nAxis) continue;
      if (Math.abs(deltaArr[i]) > max) {
        max = Math.abs(deltaArr[i]);
        dragAxis = i;
      }
    }
    if (dragAxis < 0) return null;
    const dragSign: 1 | -1 = deltaArr[dragAxis] >= 0 ? 1 : -1;

    // asse di rotazione = normale × direzione (prodotto vettoriale)
    const n: Vec3 = [0, 0, 0];
    n[nAxis] = nSign;
    const dv: Vec3 = [0, 0, 0];
    dv[dragAxis] = dragSign;
    const rotAxis: Vec3 = [
      n[1] * dv[2] - n[2] * dv[1],
      n[2] * dv[0] - n[0] * dv[2],
      n[0] * dv[1] - n[1] * dv[0],
    ];
    const kAxis = rotAxis.findIndex((c) => c !== 0) as 0 | 1 | 2;
    const rotSign = (rotAxis[kAxis] >= 0 ? 1 : -1) as 1 | -1;

    const layer = Math.round(cubiePosition[kAxis]);
    if (layer !== 0) {
      // segue esattamente lo spigolo/angolo afferrato
      const face = faceFromAxisSign(kAxis, layer as 1 | -1);
      const dir = ((-rotSign / layer) | 0) as 1 | -1;
      return { face, dir };
    }

    // striscia centrale: nessuno strato esterno univoco su quell'asse ->
    // ripiega sulla faccia toccata (verso dato dal "momento" del gesto)
    const r = grab.clone();
    r.setComponent(nAxis, 0);
    const dTangent = delta.clone();
    dTangent.setComponent(nAxis, 0);
    if (r.lengthSq() < 1e-3 || dTangent.lengthSq() < 1e-6) return null;
    const spin = new THREE.Vector3().crossVectors(r, dTangent).getComponent(nAxis) * nSign;
    const face = faceFromAxisSign(nAxis, nSign);
    const dir = (spin >= 0 ? -1 : 1) as 1 | -1;
    return { face, dir };
  }

  private onPointerUp = (ev: PointerEvent) => {
    // risincronizza col vero stato di Shift al rilascio (vedi nota in onPointerDown)
    this.shiftHeld = ev.shiftKey;
    this.cancelDrag();
  };

  private cancelDrag() {
    if (!this.drag) return;
    this.drag = null;
    this.updateControlsEnabled();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }

  // ---------------------------------------------------------------------------

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.clearInterval(this.fallbackTimer);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.onWindowBlur);
    this.cancelDrag();
    this.controls.dispose();
    for (const { texture } of this.stickerTextures.values()) texture.dispose();
    this.stickerTextures.clear();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Carica un file immagine e lo restituisce come data URL JPEG quadrato
 * (`size`×`size`, ritaglio centrale "cover"). Serve a tenere piccole le immagini
 * così stanno nel localStorage (fino a 54 sticker).
 *
 * Prova prima `createImageBitmap` (veloce, rispetta l'orientamento EXIF), poi
 * ripiega su `<img>`. Se falliscono entrambi il formato non è decodificabile dal
 * browser (tipicamente HEIC/HEIF delle foto iPhone): in quel caso l'errore lo
 * dice esplicitamente.
 */
export async function fileToSquareDataURL(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      `"${file.name || "file"}" non è un'immagine (${file.type || "tipo sconosciuto"}).`,
    );
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      source = await loadViaImgElement(file);
    } catch {
      const heicish = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      throw new Error(
        heicish
          ? `"${file.name}": formato HEIC/HEIF non supportato dal browser. Converti la foto in JPG o PNG.`
          : `"${file.name}": immagine non leggibile o formato non supportato.`,
      );
    }
  }

  const w = "width" in source ? source.width : 0;
  const h = "height" in source ? source.height : 0;
  if (!w || !h) {
    throw new Error(`"${file.name}": immagine con dimensioni non valide.`);
  }

  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponibile in questo browser.");

  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  if ("close" in source) source.close();

  try {
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    // canvas "tainted" (immagine cross-origin trascinata da un sito)
    throw new Error(
      `"${file.name}": impossibile elaborare l'immagine (protezione cross-origin). Scaricala e ricaricala dal file.`,
    );
  }
}

/** Fallback: decodifica tramite un elemento <img> e un object URL. */
function loadViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

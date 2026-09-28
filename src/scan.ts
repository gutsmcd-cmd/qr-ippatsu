// Camera / image QR decoding. Uses the native BarcodeDetector when it supports QR,
// otherwise the bundled jsQR decoder (loaded lazily from the app's own files; no CDN).

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(src: CanvasImageSource | ImageBitmap): Promise<DetectedBarcode[]> }
type BDCtor = { new (o: { formats: string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> };

let native: BarcodeDetectorLike | null | undefined;
export async function getNative(): Promise<BarcodeDetectorLike | null> {
  if (native !== undefined) return native;
  const BD = (window as unknown as { BarcodeDetector?: BDCtor }).BarcodeDetector;
  native = null;
  if (BD) {
    try {
      const fmts = BD.getSupportedFormats ? await BD.getSupportedFormats() : ['qr_code'];
      if (fmts.includes('qr_code')) native = new BD({ formats: ['qr_code'] });
    } catch { native = null; }
  }
  return native;
}

type JsQR = typeof import('jsqr').default;
let jsqr: JsQR | null = null;
async function getJsQR(): Promise<JsQR> {
  if (!jsqr) jsqr = (await import('jsqr')).default;
  return jsqr;
}

const work = document.createElement('canvas');
const wctx = work.getContext('2d', { willReadFrequently: true })!;

export async function decode(src: HTMLVideoElement | HTMLImageElement | ImageBitmap, w: number, h: number): Promise<string | null> {
  if (!w || !h) return null;
  const nat = await getNative();
  if (nat) {
    try {
      const r = await nat.detect(src);
      if (r.length) return r[0].rawValue;
      // For still images, give the bundled decoder a second try; for live video just wait for the next frame.
      if (src instanceof HTMLVideoElement) return null;
    } catch { /* fall through to jsQR */ }
  }
  const dec = await getJsQR();
  const max = src instanceof HTMLVideoElement ? 720 : 1400;
  const k = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * k), ch = Math.round(h * k);
  work.width = cw; work.height = ch;
  wctx.drawImage(src, 0, 0, cw, ch);
  const img = wctx.getImageData(0, 0, cw, ch);
  const res = dec(img.data, cw, ch, { inversionAttempts: 'attemptBoth' });
  return res ? res.data : null;
}

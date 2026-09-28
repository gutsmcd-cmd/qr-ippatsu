import qrcode from 'qrcode-generator';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

export type EC = 'L' | 'M' | 'Q' | 'H';

/** Render text as a QR code onto a canvas. Returns false if it doesn't fit. */
export function drawQR(canvas: HTMLCanvasElement, text: string, ec: EC = 'M', scale = 10, margin = 4): boolean {
  let qr;
  try {
    qr = qrcode(0, ec);
    qr.addData(text, 'Byte');
    qr.make();
  } catch {
    return false;
  }
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
  return true;
}

export interface Wifi { ssid: string; password: string; type: 'WPA' | 'WEP' | 'nopass'; hidden: boolean }

const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
export function wifiString(w: Wifi): string {
  let s = `WIFI:T:${w.type};S:${esc(w.ssid)};`;
  if (w.type !== 'nopass') s += `P:${esc(w.password)};`;
  if (w.hidden) s += 'H:true;';
  return s + ';';
}
export function parseWifi(s: string): Wifi | null {
  if (!/^WIFI:/i.test(s)) return null;
  const body = s.slice(5);
  const out: Record<string, string> = {};
  let key = '';
  let val = '';
  let inKey = true;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) { val += body[++i]; continue; }
    if (inKey) {
      if (ch === ':') { inKey = false; val = ''; } else if (ch !== ';') key += ch;
    } else if (ch === ';') {
      out[key.toUpperCase()] = val; key = ''; val = ''; inKey = true;
    } else val += ch;
  }
  if (!('S' in out)) return null;
  const t = (out.T || 'nopass').toUpperCase();
  return {
    ssid: out.S,
    password: out.P || '',
    type: t === 'WEP' ? 'WEP' : t === 'NOPASS' || t === '' ? 'nopass' : 'WPA',
    hidden: /^true$/i.test(out.H || ''),
  };
}
export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

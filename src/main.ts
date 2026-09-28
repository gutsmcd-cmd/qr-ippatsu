import './base.css';
import './style.css';
import { h, toast, copyText, loadJSON, saveJSON, uid, langToggle, downloadBlob, confirmDialog } from './ui';
import { dicts, type Lang, type Dict } from './i18n';
import { drawQR, wifiString, parseWifi, looksLikeUrl, type EC, type Wifi } from './qr';
import { decode, getNative } from './scan';

type Kind = 'text' | 'url' | 'wifi';
interface Item { id: string; src: 'made' | 'scanned'; kind: Kind; content: string; at: number }
interface State {
  lang: Lang;
  tab: 'make' | 'scan' | 'history';
  kind: Kind;
  text: string;
  url: string;
  wifi: Wifi;
  ec: EC;
  history: Item[];
}
const KEY = 'qr-ippatsu:v1';
const st: State = loadJSON<State>(KEY, {
  lang: 'ja', tab: 'make', kind: 'text', text: '', url: '',
  wifi: { ssid: '', password: '', type: 'WPA', hidden: false }, ec: 'M', history: [],
});
let t: Dict = dicts[st.lang];
const save = () => saveJSON(KEY, st);
const app = document.getElementById('app')!;

function setLang(l: Lang) { st.lang = l; t = dicts[l]; document.documentElement.lang = l; document.title = t.app; save(); render(); }

function kindOf(s: string): Kind { return parseWifi(s) ? 'wifi' : looksLikeUrl(s) ? 'url' : 'text'; }
function addHistory(src: Item['src'], content: string) {
  if (!content) return;
  const kind = kindOf(content);
  st.history = st.history.filter((x) => !(x.content === content && x.src === src));
  st.history.unshift({ id: uid(), src, kind, content, at: Date.now() });
  st.history = st.history.slice(0, 200);
  save();
}

function currentPayload(): string {
  if (st.kind === 'text') return st.text;
  if (st.kind === 'url') {
    const u = st.url.trim();
    if (!u) return '';
    return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;
  }
  return st.wifi.ssid ? wifiString(st.wifi) : '';
}

function fileName() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `qr-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}
function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
}
async function savePng(c: HTMLCanvasElement, payload: string) {
  downloadBlob(await canvasBlob(c), fileName());
  addHistory('made', payload);
  toast(t.saved);
}
async function sharePng(c: HTMLCanvasElement, payload: string) {
  const blob = await canvasBlob(c);
  const file = new File([blob], fileName(), { type: 'image/png' });
  addHistory('made', payload);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  if (nav.share) {
    try { await nav.share({ text: payload }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  downloadBlob(blob, file.name);
  toast(t.saved);
}
async function copy(s: string) { toast((await copyText(s)) ? t.copied : t.copyFail); }

const SVG: Record<string, string> = {
  make: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z" fill="currentColor"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};
const svg = (k: string, cls = 'svg') => { const s = h('span', { class: cls, 'aria-hidden': 'true' }); s.innerHTML = SVG[k]; return s; };

/* ---------------- Make ---------------- */
function renderMake(): HTMLElement {
  const canvas = h('canvas', { class: 'qr-canvas', 'aria-label': 'QR' });
  const ph = h('div', { class: 'qr-ph' }, t.placeholderQr);
  const warn = h('div', { class: 'qr-warn', hidden: true }, t.tooLong);
  const saveBtn = h('button', { class: 'btn primary grow' }, svg('download'), t.savePng);
  const shareBtn = h('button', { class: 'btn grow' }, t.share);
  const copyBtn = h('button', { class: 'btn' }, t.copy);

  const update = () => {
    const p = currentPayload();
    let ok = false;
    if (p) ok = drawQR(canvas, p, st.ec, 10, 4);
    canvas.hidden = !ok;
    ph.hidden = !!p;
    warn.hidden = !p || ok;
    for (const b of [saveBtn, shareBtn, copyBtn]) b.disabled = !ok;
    save();
  };
  saveBtn.onclick = () => savePng(canvas, currentPayload());
  shareBtn.onclick = () => sharePng(canvas, currentPayload());
  copyBtn.onclick = () => copy(currentPayload());

  let form: HTMLElement;
  if (st.kind === 'text') {
    const ta = h('textarea', { class: 'input', rows: 4, placeholder: t.textPh, 'aria-label': t.text });
    ta.value = st.text;
    ta.oninput = () => { st.text = ta.value; update(); };
    form = ta;
  } else if (st.kind === 'url') {
    const inp = h('input', { class: 'input', type: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'off', placeholder: t.urlPh, 'aria-label': t.url, value: st.url });
    inp.oninput = () => { st.url = inp.value; update(); };
    form = inp;
  } else {
    const w = st.wifi;
    const ssid = h('input', { class: 'input', autocomplete: 'off', autocapitalize: 'off', value: w.ssid });
    ssid.oninput = () => { w.ssid = ssid.value; update(); };
    const pw = h('input', { class: 'input', type: 'password', autocomplete: 'off', autocapitalize: 'off', value: w.password });
    pw.oninput = () => { w.password = pw.value; update(); };
    const show = h('input', { type: 'checkbox' });
    show.onchange = () => { pw.type = show.checked ? 'text' : 'password'; };
    const sec = h('select', { class: 'input' },
      h('option', { value: 'WPA' }, 'WPA/WPA2/WPA3'),
      h('option', { value: 'WEP' }, 'WEP'),
      h('option', { value: 'nopass' }, t.none),
    );
    sec.value = w.type;
    const pwField = h('label', { class: 'field' }, t.password, h('div', { class: 'row' }, pw, h('label', { class: 'chk small' }, show, t.showPw)));
    pwField.hidden = w.type === 'nopass';
    sec.onchange = () => { w.type = sec.value as Wifi['type']; pwField.hidden = w.type === 'nopass'; update(); };
    const hid = h('input', { type: 'checkbox', checked: w.hidden });
    hid.onchange = () => { w.hidden = hid.checked; update(); };
    form = h('div', { class: 'stack' },
      h('label', { class: 'field' }, t.ssid, ssid),
      h('label', { class: 'field' }, t.security, sec),
      pwField,
      h('label', { class: 'chk' }, hid, t.hidden),
    );
  }
  const ecSel = h('div', { class: 'seg ec' }, ...(['L', 'M', 'Q', 'H'] as EC[]).map((e) =>
    h('button', { 'aria-pressed': String(st.ec === e), onclick: () => { st.ec = e; render(); } }, e)));

  const box = h('div', { class: 'stack' },
    h('div', { class: 'seg' }, ...(['text', 'url', 'wifi'] as Kind[]).map((k) =>
      h('button', { 'aria-pressed': String(st.kind === k), onclick: () => { st.kind = k; save(); render(); } }, t[k]))),
    h('section', { class: 'card stack' }, form,
      h('div', { class: 'row small muted ec-row' }, h('span', { class: 'grow' }, t.ec), ecSel)),
    h('section', { class: 'card qr-card' }, h('div', { class: 'qr-frame' }, canvas, ph, warn)),
    h('div', { class: 'row' }, saveBtn, shareBtn, copyBtn),
  );
  update();
  return box;
}

/* ---------------- Scan ---------------- */
let stream: MediaStream | null = null;
let scanning = false;
let lastResult: string | null = null;

function stopCam() {
  scanning = false;
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
}

function resultCard(text: string): HTMLElement {
  const wifi = parseWifi(text);
  const isUrl = looksLikeUrl(text);
  const body: (HTMLElement | string)[] = [];
  if (wifi) {
    body.push(h('dl', { class: 'wifi-dl' },
      h('dt', {}, t.ssid), h('dd', {}, wifi.ssid, ' ', h('button', { class: 'mini', onclick: () => copy(wifi.ssid) }, t.copy)),
      ...(wifi.type !== 'nopass' ? [h('dt', {}, t.password), h('dd', {}, wifi.password, ' ', h('button', { class: 'mini', onclick: () => copy(wifi.password) }, t.copy))] : []),
      h('dt', {}, t.security), h('dd', {}, wifi.type === 'nopass' ? t.none : wifi.type),
    ));
  } else {
    body.push(h('div', { class: 'result-text' }, text));
  }
  return h('section', { class: 'card result' },
    h('div', { class: 'res-head' }, h('span', { class: 'tag' }, wifi ? t.wifi : isUrl ? t.url : t.text), h('strong', {}, t.result)),
    ...body,
    h('div', { class: 'row' },
      isUrl ? h('a', { class: 'btn primary grow', href: text, target: '_blank', rel: 'noopener noreferrer' }, t.open, ' ↗') : null,
      h('button', { class: 'btn grow', onclick: () => copy(text) }, t.copy),
      h('button', { class: 'btn grow', onclick: async () => {
        if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* ignore */ } }
        copy(text);
      } }, t.share),
    ),
  );
}

function renderScan(): HTMLElement {
  const video = h('video', { class: 'cam', playsinline: true, muted: true, autoplay: true });
  video.setAttribute('playsinline', '');
  video.muted = true;
  const viewport = h('div', { class: 'cam-wrap' + (stream ? ' live' : '') }, video, h('div', { class: 'reticle' }), h('div', { class: 'cam-hint' }, t.camHint));
  const resBox = h('div', {});
  if (lastResult) resBox.append(resultCard(lastResult));
  const engine = h('p', { class: 'small muted center' });
  getNative().then((n) => { engine.textContent = n ? t.engineNative : t.engineJs; });

  const onFound = (txt: string) => {
    lastResult = txt;
    addHistory('scanned', txt);
    resBox.replaceChildren(resultCard(txt));
    if (navigator.vibrate) navigator.vibrate(60);
  };

  const camBtn = h('button', { class: 'btn primary grow' }, stream ? '' : svg('camera'), stream ? t.stopCam : t.startCam);
  camBtn.onclick = async () => {
    if (stream) { stopCam(); render(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      toast(t.camError);
      return;
    }
    render();
  };
  if (stream) {
    video.srcObject = stream;
    video.play().catch(() => {});
    scanning = true;
    let busy = false;
    const loop = async () => {
      if (!scanning || !video.isConnected) return;
      if (!busy && video.readyState >= 2) {
        busy = true;
        try {
          const r = await decode(video, video.videoWidth, video.videoHeight);
          if (r && scanning) { onFound(r); stopCam(); viewport.classList.remove('live'); camBtn.replaceChildren(svg('camera'), t.startCam); return; }
        } finally { busy = false; }
      }
      setTimeout(loop, 120);
    };
    loop();
  }

  const fileInp = h('input', { type: 'file', accept: 'image/*', hidden: true });
  fileInp.onchange = async () => {
    const f = fileInp.files?.[0];
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const r = await decode(bmp, bmp.width, bmp.height);
      if (r) onFound(r); else toast(t.noCode);
    } catch { toast(t.noCode); }
    fileInp.value = '';
  };
  return h('div', { class: 'stack' },
    viewport,
    h('div', { class: 'row' }, camBtn, h('button', { class: 'btn grow', onclick: () => fileInp.click() }, svg('image'), t.fromImage), fileInp),
    resBox,
    engine,
  );
}

/* ---------------- History ---------------- */
function fmt(ms: number) {
  return new Date(ms).toLocaleString(st.lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function label(it: Item) {
  if (it.kind === 'wifi') return `${t.wifiNet}: ${parseWifi(it.content)?.ssid ?? ''}`;
  return it.content.replace(/\s+/g, ' ');
}
function showItem(it: Item) {
  const c = h('canvas', { class: 'qr-canvas' });
  drawQR(c, it.content, 'M', 10, 4);
  const dlg = h('dialog', { class: 'qr-dlg' },
    h('div', { class: 'qr-frame' }, c),
    h('p', { class: 'result-text small' }, label(it)),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary grow', onclick: () => savePng(c, it.content) }, t.savePng),
      h('button', { class: 'btn grow', onclick: () => sharePng(c, it.content) }, t.share),
      h('button', { class: 'btn grow', onclick: () => copy(it.content) }, t.copy),
    ),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => {
        dlg.close();
        const w = parseWifi(it.content);
        if (w) { st.kind = 'wifi'; st.wifi = w; } else if (it.kind === 'url') { st.kind = 'url'; st.url = it.content; } else { st.kind = 'text'; st.text = it.content; }
        st.tab = 'make'; save(); render();
      } }, t.edit),
      h('button', { class: 'btn', onclick: () => dlg.close() }, t.close),
    ),
  );
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
function renderHistory(): HTMLElement {
  if (!st.history.length) return h('p', { class: 'empty' }, t.historyEmpty);
  const list = h('ul', { class: 'hist' }, ...st.history.map((it) =>
    h('li', {},
      h('button', { class: 'hist-main', onclick: () => showItem(it) },
        h('span', { class: 'tag ' + it.src }, it.src === 'made' ? t.made : t.scanned),
        h('span', { class: 'hist-text' }, label(it)),
        h('span', { class: 'hist-date' }, fmt(it.at)),
      ),
      h('button', { class: 'icon-btn', 'aria-label': t.del, onclick: () => {
        const idx = st.history.indexOf(it);
        st.history.splice(idx, 1); save(); render();
        toast(t.deleted, { label: t.undo, run: () => { st.history.splice(idx, 0, it); save(); render(); } });
      } }, '✕'),
    )));
  return h('div', { class: 'stack' }, list,
    h('button', { class: 'btn danger', onclick: async () => {
      if (await confirmDialog(t.clearConfirm, t.clearBody, t.clearAll, t.cancel, true)) { st.history = []; save(); render(); }
    } }, t.clearAll));
}

/* ---------------- Shell ---------------- */
function render() {
  if (st.tab !== 'scan') stopCam();
  const body = st.tab === 'make' ? renderMake() : st.tab === 'scan' ? renderScan() : renderHistory();
  const tab = (id: State['tab'], lab: string) =>
    h('button', { class: 'tab', 'aria-pressed': String(st.tab === id), onclick: () => { if (st.tab !== id) { st.tab = id; save(); render(); } } },
      svg(id, 'tab-ic'), h('span', {}, lab));
  app.replaceChildren(
    h('header', { class: 'topbar' }, svg('make', 'logo'), h('h1', {}, t.app), langToggle(st.lang, setLang)),
    h('main', {}, body, h('p', { class: 'foot' }, t.privacy)),
    h('nav', { class: 'tabs' }, tab('make', t.tabMake), tab('scan', t.tabScan), tab('history', t.tabHistory)),
  );
}
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) { stopCam(); render(); } });
document.documentElement.lang = st.lang;
document.title = t.app;
render();

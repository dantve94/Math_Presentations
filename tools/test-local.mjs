// Offline test: runs the Apps Script code against a fake SlidesApp/DriveApp so logic errors,
// bad geometry and arithmetic mistakes show up before you paste the code into Google.
//   node tools/test-local.mjs [lesson.json]
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lessonPath = process.argv[2] || join(root, 'examples/grade3-capacity-mass-us.json');
const lesson = JSON.parse(readFileSync(lessonPath, 'utf8'));

// ---------- fake Slides ----------
const W = 720, H = 405;
const chain = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : chain()), apply: () => chain() });

function textRange(owner) {
  return {
    asString: () => owner.text,
    setText: (t) => { owner.text = String(t); return textRange(owner); },
    replaceAllText: (a, b) => { owner.text = owner.text.split(a).join(b); return 1; },
    getTextStyle: () => ({ getFontSize: () => owner.fontSize, setFontSize(n) { owner.fontSize = n; return this; }, setBold() { return this; }, setForegroundColor() { return this; } }),
    getParagraphStyle: () => ({ setParagraphAlignment() { return this; } })
  };
}
function element(slide, kind, x, y, w, h, text = '') {
  const el = {
    kind, x, y, w, h, text, fontSize: 18, removed: false,
    getText: () => textRange(el), getLeft: () => el.x, getTop: () => el.y, getWidth: () => el.w, getHeight: () => el.h,
    setLeft(v) { el.x = v; return el; }, setTop(v) { el.y = v; return el; }, setWidth(v) { el.w = v; return el; }, setHeight(v) { el.h = v; return el; },
    getFill: () => ({ setSolidFill: (c) => { el.fill = c; }, setTransparent: () => { el.fill = null; } }),
    getBorder: () => ({ getLineFill: () => ({ setSolidFill: (c) => { el.stroke = c; } }), setWeight: () => {}, setTransparent: () => { el.stroke = null; }, setDashStyle: () => {} }),
    getLineFill: () => ({ setSolidFill: (c) => { el.stroke = c; } }),
    setWeight: () => el, setEndArrow: () => { el.arrow = true; return el; }, setDashStyle: () => el,
    setContentAlignment: () => el, setDescription: (d) => { el.alt = d; return el; },
    remove: () => { el.removed = true; slide.els = slide.els.filter((e) => e !== el); }
  };
  slide.els.push(el);
  return el;
}
function makeSlide(pres, notes, shapes) {
  const s = { els: [], notes: { text: notes }, skipped: false };
  shapes.forEach(([x, y, w, h, t]) => element(s, 'shape', x, y, w, h, t));
  Object.assign(s, {
    getShapes: () => s.els.filter((e) => e.kind === 'shape'),
    getNotesPage: () => ({ getSpeakerNotesShape: () => ({ getText: () => textRange(s.notes) }) }),
    duplicate: () => {
      const d = makeSlide(pres, s.notes.text, s.getShapes().map((e) => [e.x, e.y, e.w, e.h, e.text]));
      pres.slides.splice(pres.slides.indexOf(s) + 1, 0, d);
      return d;
    },
    move: (i) => { pres.slides.splice(pres.slides.indexOf(s), 1); pres.slides.splice(i, 0, s); },
    remove: () => { pres.slides.splice(pres.slides.indexOf(s), 1); },
    setSkipped: (b) => { s.skipped = b; },
    insertShape: (t, x, y, w, h) => Object.assign(element(s, 'shape', x, y, w, h), { shapeType: t }),
    insertTextBox: (t, x, y, w, h) => element(s, 'shape', x, y, w, h, t),
    insertLine: (_c, x1, y1, x2, y2) => Object.assign(element(s, 'line', Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)), { pts: [x1, y1, x2, y2] }),
    insertImage: () => element(s, 'image', 0, 0, 400, 300),
    group: (els) => { const g = element(s, 'group', 0, 0, 0, 0); g.children = els; return g; },
    replaceAllText: (a, b) => s.els.forEach((e) => { e.text = e.text.split(a).join(b); })
  });
  return s;
}

const LAYOUTS = ['WELCOME', 'EXPECTATIONS', 'CHECK_IN', 'OBJECTIVES', 'DEFINITIONS', 'CHEAT_SHEET', 'I_DO_PROBLEM',
  'WORK_IT_OUT', 'I_DO_ANSWER', 'BRAIN_BREAK', 'WE_DO_PROBLEM', 'WE_DO_ANSWER', 'REFLECTION', 'YOU_DO', 'QUESTIONS', 'GENERIC', 'TEACHER_GUIDE'];
const pres = { slides: [] };
LAYOUTS.forEach((l) => pres.slides.push(makeSlide(pres, '#layout=' + l, [
  [40, 20, 640, 60, '{{TITLE}}'], [40, 100, 340, 280, '{{BODY}}'], [400, 110, 290, 250, '{{GRAPHIC}}'], [40, 380, 300, 20, 'Grade {{GRADE}} | {{SKILL}}']
])));
Object.assign(pres, { getSlides: () => pres.slides.slice(), replaceAllText: (a, b) => pres.slides.forEach((s) => s.replaceAllText(a, b)), saveAndClose() {} });

const enumProxy = new Proxy({}, { get: (_t, k) => k });
const ctx = {
  SlidesApp: { openById: () => pres, ShapeType: enumProxy, LineCategory: enumProxy, ArrowStyle: enumProxy, DashStyle: enumProxy, ParagraphAlignment: enumProxy, ContentAlignment: enumProxy },
  DriveApp: { getFileById: () => ({ makeCopy: () => ({ getId: () => 'copy', getUrl: () => 'https://docs.google.com/presentation/d/copy' }) }), getFolderById: () => ({}) },
  console
};
vm.createContext(ctx);
for (const f of readdirSync(join(root, 'apps-script')).filter((f) => f.endsWith('.gs'))) {
  vm.runInContext(readFileSync(join(root, 'apps-script', f), 'utf8'), ctx, { filename: f });
}

// ---------- tests ----------
const eq = ctx.checkEquations_;
assert.equal(eq('32 fl oz - 14 fl oz = 18 fl oz').length, 0);
assert.equal(eq('8 gal ÷ 2 = 4 gal').length, 0);
assert.equal(eq('4 x 2 = 8').length, 0);
assert.equal(eq('14 oz + 18 oz = 31 oz').length, 1, 'should catch wrong sum');
assert.equal(eq('24 oz - 9 oz = 16 oz').length, 1, 'should catch wrong difference');

const warnings = ctx.validateLesson(lesson);
console.log('Validation warnings:', warnings.length ? warnings : 'none');

const url = ctx.buildDeck(lesson, 'template', null);
assert.equal(pres.slides.length, lesson.slides.length + 1, 'one slide per lesson slide + teacher guide');

let problems = 0;
pres.slides.forEach((s, i) => {
  const leftover = s.els.filter((e) => /\{\{[A-Z_]+\}\}/.test(e.text));
  if (leftover.length) { problems++; console.log(`slide ${i + 1}: unreplaced token`, leftover.map((e) => e.text)); }
  s.els.filter((e) => e.kind !== 'group').forEach((e) => {
    if (e.x < -1 || e.y < -1 || e.x + e.w > W + 1 || e.y + e.h > H + 1) {
      problems++; console.log(`slide ${i + 1}: element outside slide`, { kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, text: e.text });
    }
  });
});
const last = pres.slides[pres.slides.length - 1];
assert.ok(last.skipped, 'teacher guide slide should be skipped');
assert.match(last.notes.text, /HEURISTICS/);
assert.match(pres.slides[0].notes.text, /LESSON BIG IDEA/);

console.log('Deck URL (mock):', url);
console.log('Slides built:', pres.slides.length);
pres.slides.forEach((s, i) => {
  const shapes = s.els.filter((e) => e.kind !== 'group').length;
  const body = s.els.find((e) => e.y === 100 && e.x === 40);
  console.log(String(i + 1).padStart(2), (lesson.slides[i]?.layout || 'TEACHER_GUIDE').padEnd(14),
    'elements:', String(shapes).padStart(3), ' body font:', body ? body.fontSize : '-');
});
// Optional: --preview out.html renders every slide's geometry as SVG for a visual check.
const pi = process.argv.indexOf('--preview');
if (pi !== -1) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svgs = pres.slides.map((s, i) => {
    const parts = s.els.filter((e) => e.kind !== 'group').map((e) => {
      if (e.kind === 'line') {
        const [x1, y1, x2, y2] = e.pts;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.stroke || '#264653'}" stroke-width="1.5" ${e.arrow ? 'marker-end="url(#a)"' : ''}/>`;
      }
      const shape = e.shapeType === 'ELLIPSE'
        ? `<ellipse cx="${e.x + e.w / 2}" cy="${e.y + e.h / 2}" rx="${e.w / 2}" ry="${e.h / 2}" fill="${e.fill || 'none'}" stroke="${e.stroke || 'none'}"/>`
        : `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.shapeType === 'ROUND_RECTANGLE' ? 8 : 0}" fill="${e.fill || 'none'}" stroke="${e.stroke || 'none'}" stroke-width="1.5"/>`;
      const lines = String(e.text || '').split('\n');
      const fs = e.fontSize || 14;
      const centered = e.y !== 100 && e.y !== 20;
      const tx = lines.map((l, k) => `<text x="${centered ? e.x + e.w / 2 : e.x + 6}" y="${(centered ? e.y + e.h / 2 - (lines.length - 1) * fs * 0.6 : e.y + fs + 4) + k * fs * 1.2}" font-size="${fs}" text-anchor="${centered ? 'middle' : 'start'}" dominant-baseline="${centered ? 'middle' : 'auto'}" font-family="Arial">${esc(l)}</text>`).join('');
      return shape + tx;
    }).join('');
    return `<figure><figcaption>${i + 1}. ${lesson.slides[i]?.layout || 'TEACHER_GUIDE'}</figcaption><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#E76F51"/></marker></defs><rect width="${W}" height="${H}" fill="#fff" stroke="#ccc"/>${parts}</svg></figure>`;
  }).join('');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.argv[pi + 1], `<!doctype html><meta charset="utf-8"><body style="font-family:Arial;background:#eee;display:flex;flex-wrap:wrap;gap:12px">${svgs}</body>`);
  console.log('Preview written to', process.argv[pi + 1]);
}
if (problems) { console.error(problems + ' problem(s) found'); process.exit(1); }
console.log('All checks passed.');

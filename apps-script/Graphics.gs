/**
 * Graphics.gs: draws math visual models as NATIVE Google Slides shapes.
 *
 * Why native shapes instead of AI-generated images:
 *  - The numbers are always exact (the model only picks a type + parameters).
 *  - Teachers can click, recolor, move or edit any part afterwards.
 *  - No public image hosting needed (Slides API images must come from a public URL).
 *
 * Every drawer gets a bounding box {left, top, width, height} in points (pt)
 * and stays inside it. A 16:9 slide is 720 x 405 pt.
 */

var GFX = {
  outline: '#264653',
  text: '#1F2937',
  liquid: '#4FA3E0',
  unknown: '#FFD966',
  parts: ['#8ECAE6', '#FFB703', '#90BE6D', '#F4A261', '#CDB4DB', '#A3C4F3'],
  light: '#EAF4FB',
  font: 14
};

/** Entry point. Returns the drawn PageElements (grouped when possible). */
function drawGraphic(slide, box, type, params, altText) {
  var drawers = {
    tape_diagram: drawTapeDiagram_,
    bar_compare: drawBarCompare_,
    number_line: drawNumberLine_,
    measuring_container: drawMeasuringContainer_,
    array: drawArray_,
    equal_groups: drawEqualGroups_,
    fraction_bar: drawFractionBar_,
    base_ten: drawBaseTen_,
    image: drawImage_
  };
  var fn = drawers[type];
  if (!fn) return null;
  var elements = fn(slide, box, params || {}) || [];
  var target = null;
  if (elements.length > 1) {
    try { target = slide.group(elements); } catch (e) { target = null; }
  } else if (elements.length === 1) {
    target = elements[0];
  }
  if (target && altText) {
    try { target.setDescription(altText); } catch (e) { /* alt text is best-effort */ }
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Primitive helpers                                                   */
/* ------------------------------------------------------------------ */

function gRect_(slide, x, y, w, h, fill, opts) {
  opts = opts || {};
  var shape = slide.insertShape(opts.shapeType || SlidesApp.ShapeType.RECTANGLE, x, y, Math.max(w, 1), Math.max(h, 1));
  if (fill) shape.getFill().setSolidFill(fill); else shape.getFill().setTransparent();
  var border = shape.getBorder();
  if (opts.noBorder) {
    border.setTransparent();
  } else {
    border.getLineFill().setSolidFill(opts.borderColor || GFX.outline);
    border.setWeight(opts.borderWeight || 1.5);
    if (opts.dashed) border.setDashStyle(SlidesApp.DashStyle.DASH);
  }
  if (opts.text !== undefined && opts.text !== null && opts.text !== '') {
    styleText_(shape, String(opts.text), opts.fontSize || GFX.font, opts.bold, opts.color);
  }
  return shape;
}

function gText_(slide, text, x, y, w, h, opts) {
  opts = opts || {};
  var box = slide.insertTextBox(String(text), x, y, Math.max(w, 1), Math.max(h, 1));
  styleText_(box, String(text), opts.fontSize || GFX.font, opts.bold, opts.color);
  if (opts.align === 'left') {
    box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
  }
  return box;
}

function styleText_(shape, text, size, bold, color) {
  var range = shape.getText();
  range.setText(text);
  range.getTextStyle().setFontSize(size).setBold(!!bold).setForegroundColor(color || GFX.text);
  range.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  try { shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE); } catch (e) {}
}

function gLine_(slide, x1, y1, x2, y2, opts) {
  opts = opts || {};
  var line = slide.insertLine(SlidesApp.LineCategory.STRAIGHT, x1, y1, x2, y2);
  line.setWeight(opts.weight || 1.5);
  line.getLineFill().setSolidFill(opts.color || GFX.outline);
  if (opts.arrow) line.setEndArrow(SlidesApp.ArrowStyle.FILL_ARROW);
  if (opts.dashed) line.setDashStyle(SlidesApp.DashStyle.DASH);
  return line;
}

function num_(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : fallback;
}

function fmt_(n) {
  return (Math.round(n * 100) / 100).toString();
}

/* ------------------------------------------------------------------ */
/* Tape diagram (part-part-whole)                                      */
/* params: {parts:[{label, value}], total, total_label, unit}          */
/* ------------------------------------------------------------------ */
function drawTapeDiagram_(slide, box, p) {
  var parts = (p.parts && p.parts.length) ? p.parts : [{ label: '?', value: 1 }];
  var els = [];
  var sum = parts.reduce(function (a, part) { return a + Math.max(num_(part.value, 1), 0.0001); }, 0);
  var barH = Math.min(60, box.height * 0.35);
  var barY = box.top + box.height * 0.45;
  var x = box.left;
  var totalLabel = p.total_label || (p.total !== undefined ? fmt_(num_(p.total, 0)) + (p.unit ? ' ' + p.unit : '') : '?');

  // Bracket above the bar for the whole.
  var bracketY = barY - 18;
  els.push(gLine_(slide, box.left, bracketY, box.left + box.width, bracketY));
  els.push(gLine_(slide, box.left, bracketY, box.left, bracketY + 10));
  els.push(gLine_(slide, box.left + box.width, bracketY, box.left + box.width, bracketY + 10));
  els.push(gText_(slide, totalLabel, box.left, bracketY - 34, box.width, 30, { bold: true, fontSize: 16 }));

  parts.forEach(function (part, i) {
    var w = box.width * Math.max(num_(part.value, 1), 0.0001) / sum;
    var label = String(part.label === undefined ? '' : part.label);
    var isUnknown = label.indexOf('?') !== -1;
    els.push(gRect_(slide, x, barY, w, barH, isUnknown ? GFX.unknown : GFX.parts[i % GFX.parts.length], {
      text: label, fontSize: w < 60 ? 11 : GFX.font, bold: isUnknown
    }));
    x += w;
  });
  return els;
}

/* ------------------------------------------------------------------ */
/* Comparison bars                                                      */
/* params: {bars:[{label, value}], unit, show_difference}               */
/* ------------------------------------------------------------------ */
function drawBarCompare_(slide, box, p) {
  var bars = (p.bars && p.bars.length) ? p.bars.slice(0, 4) : [];
  if (!bars.length) return [];
  var els = [];
  var labelW = Math.min(90, box.width * 0.25);
  var maxV = Math.max.apply(null, bars.map(function (b) { return num_(b.value, 0); })) || 1;
  var rowH = Math.min(50, box.height / (bars.length + 1));
  var areaW = box.width - labelW - 8;
  var unit = p.unit ? ' ' + p.unit : '';

  bars.forEach(function (b, i) {
    var y = box.top + i * (rowH + 12) + 10;
    var w = areaW * num_(b.value, 0) / maxV;
    els.push(gText_(slide, b.label || '', box.left, y, labelW, rowH, { align: 'left', bold: true }));
    els.push(gRect_(slide, box.left + labelW + 8, y, w, rowH, GFX.parts[i % GFX.parts.length], {
      text: fmt_(num_(b.value, 0)) + unit
    }));
  });

  if (p.show_difference && bars.length === 2) {
    var v0 = num_(bars[0].value, 0), v1 = num_(bars[1].value, 0);
    var shortIdx = v0 <= v1 ? 0 : 1;
    var diff = Math.abs(v1 - v0);
    if (diff > 0) {
      var yS = box.top + shortIdx * (rowH + 12) + 10;
      var xS = box.left + labelW + 8 + areaW * Math.min(v0, v1) / maxV;
      els.push(gRect_(slide, xS, yS, areaW * diff / maxV, rowH, GFX.unknown, { dashed: true, text: '?' , bold: true }));
      els.push(gText_(slide, 'difference', xS, box.top + 2 * (rowH + 12) + 10, Math.max(areaW * diff / maxV, 80), 24, { fontSize: 12 }));
    }
  }
  return els;
}

/* ------------------------------------------------------------------ */
/* Number line with jumps                                               */
/* params: {min, max, step, label_every, points:[n], jumps:[{from,to,label}]} */
/* ------------------------------------------------------------------ */
function drawNumberLine_(slide, box, p) {
  var min = num_(p.min, 0), max = num_(p.max, 10);
  if (max <= min) max = min + 10;
  var step = Math.abs(num_(p.step, 1)) || 1;
  while ((max - min) / step > 50) step *= 2;            // keep ticks readable
  var labelEvery = Math.abs(num_(p.label_every, step)) || step;
  var els = [];
  var pad = 14;
  var y = box.top + box.height * 0.7;
  var x0 = box.left + pad, x1 = box.left + box.width - pad;
  var X = function (v) { return x0 + (x1 - x0) * (v - min) / (max - min); };

  els.push(gLine_(slide, x0 - 8, y, x1 + 8, y, { weight: 2 }));
  for (var v = min, guard = 0; v <= max + 1e-9 && guard < 200; v += step, guard++) {
    var isLabel = Math.abs(((v - min) / labelEvery) - Math.round((v - min) / labelEvery)) < 1e-6;
    els.push(gLine_(slide, X(v), y - (isLabel ? 8 : 5), X(v), y + (isLabel ? 8 : 5), { weight: isLabel ? 1.5 : 1 }));
    if (isLabel) els.push(gText_(slide, fmt_(v), X(v) - 20, y + 8, 40, 20, { fontSize: 11 }));
  }

  (p.points || []).forEach(function (pt) {
    var px = X(num_(pt, min));
    els.push(gRect_(slide, px - 6, y - 6, 12, 12, '#E63946', { shapeType: SlidesApp.ShapeType.ELLIPSE, noBorder: true }));
  });

  (p.jumps || []).forEach(function (j, i) {
    var a = X(num_(j.from, min)), b = X(num_(j.to, min));
    var h = 26 + (i % 2) * 22;
    els.push(gLine_(slide, a, y - 4, a, y - h, { color: '#E76F51', weight: 1 }));
    els.push(gLine_(slide, a, y - h, b, y - h, { color: '#E76F51', weight: 2, arrow: true }));
    els.push(gLine_(slide, b, y - h, b, y - 4, { color: '#E76F51', weight: 1, dashed: true }));
    if (j.label) {
      els.push(gText_(slide, j.label, Math.min(a, b), y - h - 24, Math.max(Math.abs(b - a), 40), 22, { fontSize: 12, bold: true, color: '#E76F51' }));
    }
  });
  return els;
}

/* ------------------------------------------------------------------ */
/* Measuring container (jug / beaker)                                   */
/* params: {capacity, level, unit, tick_every, label, color}            */
/* ------------------------------------------------------------------ */
function drawMeasuringContainer_(slide, box, p) {
  var cap = Math.max(num_(p.capacity, 10), 1);
  var level = Math.min(Math.max(num_(p.level, 0), 0), cap);
  var tickEvery = Math.abs(num_(p.tick_every, cap / 4)) || cap / 4;
  while (cap / tickEvery > 16) tickEvery *= 2;
  var unit = p.unit || '';
  var els = [];

  var labelH = 28;
  var h = box.height - labelH - 10;
  var w = Math.min(box.width * 0.4, h * 0.7);
  var x = box.left + (box.width - w) / 2 - 20;
  var y = box.top;

  var liquidH = h * level / cap;
  if (liquidH > 0) {
    els.push(gRect_(slide, x, y + h - liquidH, w, liquidH, p.color || GFX.liquid, { noBorder: true }));
  }
  els.push(gRect_(slide, x, y, w, h, null, { borderWeight: 2.5 }));   // container outline on top

  for (var t = 0, guard = 0; t <= cap + 1e-9 && guard < 40; t += tickEvery, guard++) {
    var ty = y + h - h * t / cap;
    els.push(gLine_(slide, x + w, ty, x + w + 10, ty));
    els.push(gText_(slide, fmt_(t) + (t === cap ? ' ' + unit : ''), x + w + 12, ty - 10, 70, 20, { fontSize: 11, align: 'left' }));
  }
  els.push(gText_(slide, p.label || (fmt_(level) + ' ' + unit), box.left, y + h + 6, box.width, labelH, { bold: true }));
  return els;
}

/* ------------------------------------------------------------------ */
/* Array of dots                                                        */
/* params: {rows, cols, label}                                          */
/* ------------------------------------------------------------------ */
function drawArray_(slide, box, p) {
  var rows = Math.min(Math.max(Math.round(num_(p.rows, 2)), 1), 12);
  var cols = Math.min(Math.max(Math.round(num_(p.cols, 2)), 1), 12);
  var els = [];
  var labelH = p.label ? 28 : 0;
  var cell = Math.min(box.width / cols, (box.height - labelH) / rows);
  var d = cell * 0.7;
  var x0 = box.left + (box.width - cell * cols) / 2;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      els.push(gRect_(slide, x0 + c * cell + (cell - d) / 2, box.top + r * cell + (cell - d) / 2, d, d,
        GFX.parts[0], { shapeType: SlidesApp.ShapeType.ELLIPSE, noBorder: true }));
    }
  }
  if (labelH) els.push(gText_(slide, p.label, box.left, box.top + rows * cell + 4, box.width, labelH, { bold: true }));
  return els;
}

/* ------------------------------------------------------------------ */
/* Equal groups                                                         */
/* params: {groups, per_group, label, unit}                             */
/* ------------------------------------------------------------------ */
function drawEqualGroups_(slide, box, p) {
  var groups = Math.min(Math.max(Math.round(num_(p.groups, 2)), 1), 10);
  var per = Math.min(Math.max(Math.round(num_(p.per_group, 2)), 0), 20);
  var els = [];
  var labelH = p.label ? 28 : 0;
  var perRow = Math.min(groups, 5);
  var rowsOfGroups = Math.ceil(groups / perRow);
  var gw = box.width / perRow - 10;
  var gh = (box.height - labelH) / rowsOfGroups - 10;
  var dotCols = Math.ceil(Math.sqrt(per || 1));
  var dotRows = Math.ceil((per || 1) / dotCols);
  var dot = Math.min((gw - 16) / dotCols, (gh - 28) / dotRows) * 0.75;

  for (var g = 0; g < groups; g++) {
    var gx = box.left + (g % perRow) * (gw + 10);
    var gy = box.top + Math.floor(g / perRow) * (gh + 10);
    els.push(gRect_(slide, gx, gy, gw, gh, GFX.light, { shapeType: SlidesApp.ShapeType.ROUND_RECTANGLE }));
    for (var i = 0; i < per; i++) {
      var cx = gx + 8 + (i % dotCols) * ((gw - 16) / dotCols) + ((gw - 16) / dotCols - dot) / 2;
      var cy = gy + 6 + Math.floor(i / dotCols) * ((gh - 28) / dotRows) + ((gh - 28) / dotRows - dot) / 2;
      els.push(gRect_(slide, cx, cy, dot, dot, GFX.liquid, { shapeType: SlidesApp.ShapeType.ELLIPSE, noBorder: true }));
    }
    els.push(gText_(slide, per + (p.unit ? ' ' + p.unit : ''), gx, gy + gh - 24, gw, 22, { fontSize: 12, bold: true }));
  }
  if (labelH) els.push(gText_(slide, p.label, box.left, box.top + box.height - labelH, box.width, labelH, { bold: true }));
  return els;
}

/* ------------------------------------------------------------------ */
/* Fraction bar                                                         */
/* params: {denominator, shaded, label}                                 */
/* ------------------------------------------------------------------ */
function drawFractionBar_(slide, box, p) {
  var den = Math.min(Math.max(Math.round(num_(p.denominator, 4)), 1), 24);
  var shaded = Math.min(Math.max(Math.round(num_(p.shaded, 1)), 0), den);
  var els = [];
  var barH = Math.min(60, box.height * 0.4);
  var y = box.top + (box.height - barH) / 2 - 10;
  var w = box.width / den;
  for (var i = 0; i < den; i++) {
    els.push(gRect_(slide, box.left + i * w, y, w, barH, i < shaded ? GFX.parts[1] : '#FFFFFF',
      { text: den <= 12 ? '1/' + den : '', fontSize: 11 }));
  }
  els.push(gText_(slide, p.label || (shaded + '/' + den), box.left, y + barH + 6, box.width, 28, { bold: true, fontSize: 16 }));
  return els;
}

/* ------------------------------------------------------------------ */
/* Base-ten blocks                                                      */
/* params: {hundreds, tens, ones}                                       */
/* ------------------------------------------------------------------ */
function drawBaseTen_(slide, box, p) {
  var H = Math.min(Math.max(Math.round(num_(p.hundreds, 0)), 0), 9);
  var T = Math.min(Math.max(Math.round(num_(p.tens, 0)), 0), 9);
  var O = Math.min(Math.max(Math.round(num_(p.ones, 0)), 0), 9);
  var els = [];
  var unit = Math.min(box.height / 13, box.width / (H * 11 + T * 1.6 + 6 + 4));
  var x = box.left;
  var y = box.top;
  for (var h = 0; h < H; h++) {
    els.push(gRect_(slide, x, y, unit * 10, unit * 10, GFX.parts[0], { text: '100', fontSize: 12 }));
    x += unit * 11;
  }
  for (var t = 0; t < T; t++) {
    els.push(gRect_(slide, x, y, unit, unit * 10, GFX.parts[2], {}));
    for (var k = 1; k < 10; k++) els.push(gLine_(slide, x, y + k * unit, x + unit, y + k * unit, { weight: 0.75 }));
    x += unit * 1.6;
  }
  x += unit;
  for (var o = 0; o < O; o++) {
    els.push(gRect_(slide, x + (o % 3) * unit * 1.3, y + unit * 10 - (Math.floor(o / 3) + 1) * unit * 1.3, unit, unit, GFX.parts[1], {}));
  }
  var total = H * 100 + T * 10 + O;
  els.push(gText_(slide, H + ' hundreds  ' + T + ' tens  ' + O + ' ones = ' + total, box.left, y + unit * 10 + 6, box.width, 26, { bold: true }));
  return els;
}

/* ------------------------------------------------------------------ */
/* Image from Drive (no public URL needed) or a public URL              */
/* params: {drive_file_id} or {url}                                     */
/* ------------------------------------------------------------------ */
function drawImage_(slide, box, p) {
  var blob;
  if (p.drive_file_id) blob = DriveApp.getFileById(p.drive_file_id).getBlob();
  else if (p.url) blob = UrlFetchApp.fetch(p.url).getBlob();
  else return [];
  var img = slide.insertImage(blob);
  var scale = Math.min(box.width / img.getWidth(), box.height / img.getHeight());
  var w = img.getWidth() * scale, h = img.getHeight() * scale;
  img.setWidth(w).setHeight(h)
     .setLeft(box.left + (box.width - w) / 2)
     .setTop(box.top + (box.height - h) / 2);
  return [img];
}

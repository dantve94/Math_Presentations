/**
 * Code.gs: builds a Google Slides math lesson from your Drive template.
 *
 * Runs as a script bound to a Google Sheet ("Lesson Requests"). One row = one lesson.
 *   A Grade | B Standard | C Skill | D Objective | E Units | F Other criteria |
 *   G Lesson JSON | H Status | I Deck link
 *
 * Most people use Math Slides > New lesson (Ui.gs + Sidebar.html), which fills in a row for them.
 * The row-based menu items below still work for anyone who prefers typing into the Sheet.
 *
 * Flow for a row:
 *   1. If column G is empty, send the criteria to Claude (Claude.gs) and save the JSON in G.
 *      (You can also paste JSON you made in claude.ai into G and skip the API.)
 *   2. Check the JSON (structure + arithmetic in equations).
 *   3. Copy the template, fill one slide per lesson slide, draw graphics, write speaker notes.
 *
 * Settings (Math Slides > Settings, stored per user; see getSetting_ in Ui.gs):
 *   template deck      defaults to DEFAULTS.TEMPLATE_ID
 *   output folder      optional: Drive folder for new decks
 *   ANTHROPIC_API_KEY  optional: only needed for step 1 via the API
 *   CLAUDE_MODEL       optional: defaults to claude-opus-5-5
 */

var COL = { GRADE: 1, STANDARD: 2, SKILL: 3, OBJECTIVE: 4, UNITS: 5, OTHER: 6, JSON: 7, STATUS: 8, LINK: 9 };
var HEADERS = ['Grade', 'Standard (code + text)', 'Skill', 'Objective', 'Units', 'Other criteria',
               'Lesson JSON (auto or pasted)', 'Status', 'Deck link'];
var DEFAULT_GRAPHIC_BOX = { left: 400, top: 110, width: 290, height: 250 };   // right half of a 720x405 slide

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Math Slides')
    .addItem('New lesson...', 'showSidebar')
    .addItem('Settings...', 'showSettings')
    .addSeparator()
    .addItem('Build deck for selected row', 'buildForSelectedRow')
    .addItem('Generate JSON only for selected row', 'generateJsonForSelectedRow')
    .addItem('Set up this sheet', 'setupSheet')
    .addToUi();
  try { ensureHeaders_(SpreadsheetApp.getActiveSheet()); } catch (e) { /* view-only users */ }
}

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(COL.OTHER, 320);
  sheet.setColumnWidth(COL.JSON, 200);
}

function generateJsonForSelectedRow() { runFromMenu_(generateJsonForSelectedRow_); }
function buildForSelectedRow() { runFromMenu_(buildForSelectedRow_); }

function generateJsonForSelectedRow_() {
  var ctx = selectedRow_();
  setStatus_(ctx, 'Generating lesson with Claude...');
  var lesson = generateLesson(criteriaText_(ctx.values));
  saveLessonJson_(ctx, lesson);
  var warnings = validateLesson(lesson);
  setStatus_(ctx, warnings.length ? 'JSON ready, please review: ' + warnings.join(' | ') : 'JSON ready, review then build');
}

function buildForSelectedRow_() {
  var ctx = selectedRow_();
  var lesson = loadLessonJson_(ctx);
  if (!lesson) {
    setStatus_(ctx, 'Generating lesson with Claude...');
    lesson = generateLesson(criteriaText_(ctx.values));
    saveLessonJson_(ctx, lesson);
  }
  var warnings = validateLesson(lesson);
  setStatus_(ctx, 'Building deck...');
  var url = buildDeck(lesson, getSetting_('TEMPLATE_ID'), getSetting_('OUTPUT_FOLDER_ID'));
  ctx.sheet.getRange(ctx.row, COL.LINK).setValue(url);
  setStatus_(ctx, warnings.length ? 'Built with warnings: ' + warnings.join(' | ') : 'Built ' + new Date().toLocaleString());
}

/* ------------------------------------------------------------------ */
/* Deck builder                                                         */
/* ------------------------------------------------------------------ */

/**
 * Copies the template and fills it from the lesson JSON. Returns the new deck's URL.
 * Template slides are prototypes, each tagged in its speaker notes with  #layout=NAME
 */
function buildDeck(lesson, templateId, folderId) {
  if (!templateId) throw new Error('TEMPLATE_ID is not set. Choose the template deck in Math Slides > Settings.');
  var title = lesson.meta.deck_title || ('Grade ' + lesson.meta.grade + ' - ' + lesson.meta.skill);
  var templateFile = DriveApp.getFileById(templateId);
  var copy = folderId ? templateFile.makeCopy(title, DriveApp.getFolderById(folderId)) : templateFile.makeCopy(title);
  var pres = SlidesApp.openById(copy.getId());

  var originals = pres.getSlides();
  var protos = indexPrototypes_(originals);
  if (!Object.keys(protos).length) {
    throw new Error('No prototype slides found. Add "#layout=NAME" to each template slide\'s speaker notes.');
  }

  lesson.slides.forEach(function (s, i) {
    var proto = protos[s.layout] || protos.GENERIC;
    if (!proto) throw new Error('Template has no slide for layout ' + s.layout + ' and no GENERIC fallback.');
    var slide = proto.duplicate();
    slide.move(pres.getSlides().length - 1);
    fillSlide_(slide, s, i === 0 ? lesson : null);
  });

  // Hidden teacher-guide slide at the end (skipped during presenting).
  var guideProto = protos.TEACHER_GUIDE || protos.GENERIC;
  if (guideProto) {
    var guide = guideProto.duplicate();
    guide.move(pres.getSlides().length - 1);
    fillSlide_(guide, {
      title: 'Teacher Guide',
      body: lesson.teacher_guide.big_idea,
      graphic: { type: 'none', params_json: '{}', alt_text: '' },
      notes: null
    }, null);
    guide.getNotesPage().getSpeakerNotesShape().getText().setText(formatTeacherGuide_(lesson));
    try { guide.setSkipped(true); } catch (e) { /* older runtimes */ }
  }

  originals.forEach(function (s) { s.remove(); });

  var m = lesson.meta;
  var tokens = {
    '{{GRADE}}': m.grade, '{{SKILL}}': m.skill, '{{DOMAIN}}': m.domain, '{{STANDARD}}': m.standard_code,
    '{{OBJECTIVE}}': m.objective, '{{DECK_TITLE}}': title
  };
  Object.keys(tokens).forEach(function (t) { pres.replaceAllText(t, String(tokens[t] || '')); });

  pres.saveAndClose();
  return copy.getUrl();
}

function indexPrototypes_(slides) {
  var map = {};
  slides.forEach(function (slide) {
    var notes = slide.getNotesPage().getSpeakerNotesShape().getText().asString();
    var m = notes.match(/#layout\s*=\s*([A-Z_]+)/);
    if (m && !map[m[1]]) map[m[1]] = slide;
  });
  return map;
}

function fillSlide_(slide, s, lessonForFirstSlide) {
  setToken_(slide, '{{TITLE}}', s.title || '', false);
  setToken_(slide, '{{BODY}}', s.body || '', true);

  var placeholder = findShapeWithText_(slide, '{{GRAPHIC}}');
  var box = DEFAULT_GRAPHIC_BOX;
  if (placeholder) {
    box = { left: placeholder.getLeft(), top: placeholder.getTop(), width: placeholder.getWidth(), height: placeholder.getHeight() };
    placeholder.remove();
  }
  var g = s.graphic || { type: 'none' };
  if (g.type && g.type !== 'none') {
    var params = {};
    try { params = JSON.parse(g.params_json || '{}'); } catch (e) { params = {}; }
    try {
      drawGraphic(slide, box, g.type, params, g.alt_text);
    } catch (e) {
      // Never fail the whole deck for one drawing: leave a visible note instead.
      slide.insertTextBox('[Graphic could not be drawn: ' + g.type + ']', box.left, box.top, box.width, 40);
    }
  }

  if (s.notes) {
    var text = formatNotes_(s.notes, g);
    if (lessonForFirstSlide) {
      text = 'LESSON BIG IDEA: ' + lessonForFirstSlide.teacher_guide.big_idea +
             '\nLESSON SUMMARY: ' + lessonForFirstSlide.teacher_guide.summary + '\n\n' + text;
    }
    slide.getNotesPage().getSpeakerNotesShape().getText().setText(text);
  }
}

/** Replaces a {{TOKEN}}. If a box holds only the token, sets its text and shrinks the font to fit. */
function setToken_(slide, token, value, shrink) {
  slide.getShapes().forEach(function (shape) {
    var range;
    try { range = shape.getText(); } catch (e) { return; }
    var current = range.asString();
    if (current.indexOf(token) === -1) return;
    if (current.trim() === token) {
      var startSize = range.getTextStyle().getFontSize() || 18;
      range.setText(value);
      if (shrink && value) {
        range.getTextStyle().setFontSize(fitFontSize_(value, shape.getWidth(), shape.getHeight(), startSize));
      }
    } else {
      range.replaceAllText(token, value);
    }
  });
}

/** Rough text-fit estimate: Slides never shrinks text by itself when the API writes it. */
function fitFontSize_(text, width, height, startSize) {
  var paragraphs = String(text).split('\n');
  for (var fs = startSize; fs > 10; fs--) {
    var charsPerLine = Math.max(Math.floor((width - 14) / (fs * 0.52)), 1);
    var lines = paragraphs.reduce(function (n, p) { return n + Math.max(Math.ceil(p.length / charsPerLine), 1); }, 0);
    if (lines * fs * 1.25 + 14 <= height) return fs;
  }
  return 10;
}

function findShapeWithText_(slide, token) {
  var shapes = slide.getShapes();
  for (var i = 0; i < shapes.length; i++) {
    try { if (shapes[i].getText().asString().indexOf(token) !== -1) return shapes[i]; } catch (e) {}
  }
  return null;
}

function formatNotes_(n, graphic) {
  var lines = [];
  if (n.summary) lines.push('PURPOSE: ' + n.summary);
  if (n.say) lines.push('\nSAY: ' + n.say);
  if (n.ask) lines.push('\nASK: ' + n.ask);
  if (n.listen_for) lines.push('\nLISTEN FOR: ' + n.listen_for);
  if (n.if_stuck) lines.push('\nIF STUCK: ' + n.if_stuck);
  if (graphic && graphic.type && graphic.type !== 'none' && graphic.alt_text) lines.push('\nVISUAL: ' + graphic.alt_text);
  if (n.time_minutes) lines.push('\nTIME: about ' + n.time_minutes + ' min');
  return lines.join('\n');
}

function formatTeacherGuide_(lesson) {
  var g = lesson.teacher_guide, m = lesson.meta;
  var out = [];
  out.push('TEACHER GUIDE: ' + m.skill + ' (Grade ' + m.grade + ')');
  out.push('Standard: ' + m.standard_code + '. ' + m.standard_text);
  out.push('\nSUMMARY\n' + g.summary);
  out.push('\nBIG IDEA\n' + g.big_idea);
  out.push('\nPREREQUISITES\n- ' + g.prerequisites.join('\n- '));
  out.push('\nHEURISTICS (rules of thumb)\n- ' + g.heuristics.join('\n- '));
  out.push('\nCOMMON MISCONCEPTIONS\n' + g.misconceptions.map(function (x) {
    return '- ' + x.misconception + '\n  Fix: ' + x.fix;
  }).join('\n'));
  out.push('\nSUPPORT\n' + g.support);
  out.push('\nSTRETCH\n' + g.stretch);
  out.push('\nMATERIALS\n- ' + g.materials.join('\n- '));
  var total = lesson.slides.reduce(function (a, s) { return a + (s.notes ? Number(s.notes.time_minutes) || 0 : 0); }, 0);
  out.push('\nPLANNED TIME: about ' + total + ' min of ' + m.duration_minutes + ' min');
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Validation: catches structural problems and wrong arithmetic         */
/* ------------------------------------------------------------------ */

/** Returns a list of human-readable warnings (empty = looks good). */
function validateLesson(lesson) {
  var warnings = [];
  if (!lesson || !lesson.meta || !lesson.teacher_guide || !lesson.slides || !lesson.slides.length) {
    return ['JSON is missing meta, teacher_guide or slides'];
  }
  lesson.slides.forEach(function (s, i) {
    var where = 'slide ' + (i + 1);
    if (s.graphic && s.graphic.type !== 'none') {
      try { JSON.parse(s.graphic.params_json || '{}'); } catch (e) { warnings.push(where + ': bad graphic params'); }
    }
    var texts = [s.body || ''];
    if (s.notes) texts.push(s.notes.say || '', s.notes.listen_for || '');
    texts.forEach(function (t) {
      checkEquations_(t).forEach(function (msg) { warnings.push(where + ': ' + msg); });
    });
    if ((s.body || '').split(/\s+/).length > 60) warnings.push(where + ': body over 60 words');
  });
  return warnings;
}

/** Finds "a <op> b = c" (units allowed) and checks the arithmetic. */
function checkEquations_(text) {
  var problems = [];
  var re = /(\d+(?:\.\d+)?)(?:\s*[A-Za-z][A-Za-z.]*(?:\s[A-Za-z][A-Za-z.]*)?)?\s+([+\-−×x÷\/*])\s+(\d+(?:\.\d+)?)(?:\s*[A-Za-z][A-Za-z.]*(?:\s[A-Za-z][A-Za-z.]*)?)?\s*=\s*(\d+(?:\.\d+)?)/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var a = Number(m[1]), op = m[2], b = Number(m[3]), c = Number(m[4]), expected;
    if (op === '+') expected = a + b;
    else if (op === '-' || op === '−') expected = a - b;
    else if (op === 'x' || op === '×' || op === '*') expected = a * b;
    else expected = b === 0 ? NaN : a / b;
    if (Math.abs(expected - c) > 1e-9) problems.push('"' + m[0] + '" should be ' + expected);
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                        */
/* ------------------------------------------------------------------ */

function selectedRow_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();
  if (row < 2) throw new Error('Select a lesson row (not the header).');
  return { sheet: sheet, row: row, values: sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0] };
}

function setStatus_(ctx, msg) {
  ctx.sheet.getRange(ctx.row, COL.STATUS).setValue(msg);
  SpreadsheetApp.flush();
}

function criteriaText_(v) {
  return [
    'Grade: ' + v[COL.GRADE - 1],
    'Standard: ' + v[COL.STANDARD - 1],
    'Skill: ' + v[COL.SKILL - 1],
    'Lesson objective: ' + v[COL.OBJECTIVE - 1],
    'Units: ' + v[COL.UNITS - 1],
    'Other criteria: ' + v[COL.OTHER - 1]
  ].join('\n');
}

/** Sheet cells hold up to 50,000 characters; bigger JSON goes to a Drive file. */
function saveLessonJson_(ctx, lesson) {
  var json = JSON.stringify(lesson, null, 1);
  var cell = ctx.sheet.getRange(ctx.row, COL.JSON);
  if (json.length < 49000) { cell.setValue(json); return; }
  var folderId = getSetting_('OUTPUT_FOLDER_ID');
  var name = (lesson.meta.deck_title || 'lesson') + '.json';
  var file = folderId ? DriveApp.getFolderById(folderId).createFile(name, json, 'application/json')
                      : DriveApp.createFile(name, json, 'application/json');
  cell.setValue('drive:' + file.getId());
}

function loadLessonJson_(ctx) {
  var raw = String(ctx.values[COL.JSON - 1] || '').trim();
  if (!raw) return null;
  if (raw.indexOf('drive:') === 0) raw = DriveApp.getFileById(raw.slice(6)).getBlob().getDataAsString();
  return parseLessonText_(raw);   // tolerates code fences and words around the JSON
}

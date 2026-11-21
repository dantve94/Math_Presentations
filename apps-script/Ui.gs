/**
 * Ui.gs: the "New lesson" sidebar, the Settings dialog, settings storage and plain-language errors.
 *
 * Settings live in each person's own User properties, so:
 *   - a copy of the Sheet ("File > Make a copy") never carries anyone's API key, and
 *   - each teacher can point new decks at their own Drive folder.
 * Lookup order: the user's own setting, then the script property (older setups), then the default.
 */

var DEFAULTS = {
  // The tagged template deck (docs/template-checklist.md). People who use a copy of this Sheet
  // need at least view access to it.
  TEMPLATE_ID: '1t8XIlzfNyII46e-o4m2FT3zpx0lWiQDeIS3ZeAPSdTw',
  OUTPUT_FOLDER_ID: '',
  ANTHROPIC_API_KEY: '',
  CLAUDE_MODEL: 'claude-opus-5-5'
};

function getSetting_(name) {
  var v = PropertiesService.getUserProperties().getProperty(name);
  if (!v) v = PropertiesService.getScriptProperties().getProperty(name);
  return v || DEFAULTS[name] || '';
}

/** Accepts a Drive/Docs URL or a bare ID and returns the ID. */
function parseDriveId_(text) {
  var s = String(text || '').trim();
  if (!s) return '';
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/\/folders\/([a-zA-Z0-9_-]{20,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  throw new Error('BAD_LINK: "' + s.slice(0, 60) + '" is not a Google Drive link or ID.');
}

/* ------------------------------------------------------------------ */
/* Menu entry points                                                    */
/* ------------------------------------------------------------------ */

function showSidebar() {
  ensureHeaders_(SpreadsheetApp.getActiveSheet());
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('New lesson');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showSettings() {
  var html = HtmlService.createHtmlOutputFromFile('Settings').setWidth(460).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Math Slides settings');
}

/** Runs a menu action and shows any error as a plain-language alert instead of a script error. */
function runFromMenu_(fn) {
  try { fn(); } catch (e) { SpreadsheetApp.getUi().alert('Math Slides', friendlyError_(e), SpreadsheetApp.getUi().ButtonSet.OK); }
}

/* ------------------------------------------------------------------ */
/* Called from the sidebar (google.script.run)                          */
/* ------------------------------------------------------------------ */

/** The sidebar gets the fixed part of the claude.ai prompt up front, so "Copy prompt" can copy instantly. */
function sidebarInit() {
  return { hasKey: !!getSetting_('ANTHROPIC_API_KEY'), promptHead: promptHead_(), extraFields: EXTRA_FIELDS };
}

function promptHead_() {
  return SYSTEM_PROMPT +
    '\n\nReturn the lesson as one JSON object that matches this JSON Schema. Put it in a single ```json code block, with nothing else after it.\n\n' +
    JSON.stringify(LESSON_SCHEMA) +
    '\n\nCreate the lesson deck for these criteria:\n\n';
}

/** The full prompt to paste into claude.ai: instructions, the JSON shape to return, and the criteria. */
function sidebarPrompt(form) {
  return promptHead_() + criteriaFromForm_(form);
}

/**
 * Step 1 of a build: saves the request as a new Sheet row and gets the lesson JSON
 * (from the pasted text, or from Claude when there's an API key). Returns the row number.
 */
function sidebarPrepare(form) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    ensureHeaders_(sheet);
    var lesson = null;
    if (form.pasted && String(form.pasted).trim()) lesson = parseLessonText_(form.pasted);
    else if (!getSetting_('ANTHROPIC_API_KEY')) throw new Error('NO_KEY');

    var row = Math.max(sheet.getLastRow(), 1) + 1;
    sheet.getRange(row, 1, 1, 6).setValues([[form.grade, form.standard, form.skill, form.objective, form.units, otherFromForm_(form)]]);
    var ctx = { sheet: sheet, row: row, values: sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0] };
    if (!lesson) {
      setStatus_(ctx, 'Writing the lesson with Claude...');
      lesson = generateLesson(criteriaText_(ctx.values));
    }
    saveLessonJson_(ctx, lesson);
    setStatus_(ctx, 'Lesson written, building deck...');
    return { ok: true, row: row, slides: lesson.slides.length };
  } catch (e) {
    return { ok: false, error: friendlyError_(e) };
  }
}

/** Step 2 of a build: builds the deck for that row. Returns the link and any warnings. */
function sidebarBuild(row) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ctx = { sheet: sheet, row: row, values: sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0] };
  try {
    var lesson = loadLessonJson_(ctx);
    var warnings = validateLesson(lesson);
    var url = buildDeck(lesson, getSetting_('TEMPLATE_ID'), getSetting_('OUTPUT_FOLDER_ID'));
    sheet.getRange(row, COL.LINK).setValue(url);
    setStatus_(ctx, warnings.length ? 'Built with warnings: ' + warnings.join(' | ') : 'Built ' + new Date().toLocaleString());
    return { ok: true, url: url, title: lesson.meta.deck_title || lesson.meta.skill, warnings: warnings };
  } catch (e) {
    var msg = friendlyError_(e);
    setStatus_(ctx, 'Not built: ' + msg);
    return { ok: false, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/* Called from the Settings dialog                                      */
/* ------------------------------------------------------------------ */

function settingsLoad() {
  var user = PropertiesService.getUserProperties();
  var key = getSetting_('ANTHROPIC_API_KEY');
  return {
    hasKey: !!key,
    keyHint: key ? '••••' + key.slice(-4) : '',
    model: getSetting_('CLAUDE_MODEL'),
    folder: user.getProperty('OUTPUT_FOLDER_ID') || PropertiesService.getScriptProperties().getProperty('OUTPUT_FOLDER_ID') || '',
    template: getSetting_('TEMPLATE_ID'),
    templateIsDefault: getSetting_('TEMPLATE_ID') === DEFAULTS.TEMPLATE_ID
  };
}

function settingsSave(s) {
  try {
    var user = PropertiesService.getUserProperties();
    if (s.removeKey) user.deleteProperty('ANTHROPIC_API_KEY');
    else if (s.key && s.key.trim()) user.setProperty('ANTHROPIC_API_KEY', s.key.trim());
    user.setProperty('CLAUDE_MODEL', s.model || DEFAULTS.CLAUDE_MODEL);

    var folder = parseDriveId_(s.folder);
    if (folder) { DriveApp.getFolderById(folder).getName(); user.setProperty('OUTPUT_FOLDER_ID', folder); }
    else user.deleteProperty('OUTPUT_FOLDER_ID');

    var template = parseDriveId_(s.template);
    if (template && template !== DEFAULTS.TEMPLATE_ID) { DriveApp.getFileById(template).getName(); user.setProperty('TEMPLATE_ID', template); }
    else user.deleteProperty('TEMPLATE_ID');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError_(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function ensureHeaders_(sheet) {
  if (String(sheet.getRange(1, 1).getValue()).trim() !== HEADERS[0]) setupSheet();
}

var EXTRA_FIELDS = [
  ['length', 'Lesson length'], ['profile', 'Class profile'], ['mustInclude', 'Must include'],
  ['numbers', 'Number range'], ['vocab', 'Vocabulary to define'], ['context', 'Characters / context'],
  ['examples', 'Number of examples'], ['avoid', 'Anything to avoid'], ['other', 'Other']
];

function otherFromForm_(form) {
  return EXTRA_FIELDS.filter(function (f) { return form[f[0]] && String(form[f[0]]).trim(); })
    .map(function (f) { return f[1] + ': ' + String(form[f[0]]).trim(); }).join('\n');
}

function criteriaFromForm_(form) {
  return criteriaText_([form.grade, form.standard, form.skill, form.objective, form.units, otherFromForm_(form)]);
}

/** Pulls the JSON object out of whatever was pasted: a bare object, a code block, or a chat reply with words around it. */
function parseLessonText_(text) {
  var s = String(text || '');
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1];
  var start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('BAD_JSON: no { ... } found');
  try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { throw new Error('BAD_JSON: ' + e.message); }
}

/** Turns script and API errors into a sentence that says what happened and what to do. */
function friendlyError_(e) {
  var m = String(e && e.message ? e.message : e);
  if (/^NO_KEY/.test(m)) return 'There is no API key, so Claude can\'t write the lesson from here. Either paste a lesson from claude.ai (use "Copy prompt" first), or add a key in Math Slides > Settings.';
  if (/^BAD_JSON/.test(m)) return 'The pasted lesson isn\'t complete. Copy Claude\'s whole answer, from the first { to the last }, and paste it again. If the answer was cut off, ask Claude to "continue", then copy the full JSON.';
  if (/^BAD_LINK/.test(m)) return m.replace(/^BAD_LINK: /, '') + ' Paste the link from the address bar, or leave the box empty.';
  if (/TEMPLATE_ID|No prototype slides/.test(m)) return 'The template deck has no tagged slides. In Settings, check that the template link points to the tagged template, not to a deck you built.';
  if (/Claude API error 401|authentication_error|invalid x-api-key/i.test(m)) return 'The API key was rejected. Open Math Slides > Settings and paste the key again from console.anthropic.com.';
  if (/Claude API error (429|529)|overloaded|rate_limit/i.test(m)) return 'Claude is busy right now. Wait a minute and try again.';
  if (/Claude API error 400.*credit|billing/i.test(m)) return 'The Anthropic account is out of credit. Add credit at console.anthropic.com, or paste a lesson from claude.ai instead.';
  if (/Claude API error/.test(m)) return 'Claude couldn\'t write the lesson (' + m.slice(0, 120) + '). Try again, or paste a lesson from claude.ai instead.';
  if (/declined/.test(m) || /too long/.test(m)) return m;
  if (/No item with the given ID|not found|Access denied|do not have permission|You do not have access/i.test(m)) {
    return 'Can\'t open the template deck or the output folder. Ask the person who shared this Sheet to share the template with you (view access is enough), or pick your own in Math Slides > Settings.';
  }
  if (/Select a lesson row/.test(m)) return m;
  if (/missing meta, teacher_guide or slides/.test(m)) return 'That isn\'t a lesson from the Math Slides prompt. Use "Copy prompt" and paste the answer Claude gives to it.';
  return 'Something went wrong: ' + m;
}

/**
 * Claude.gs: turns lesson criteria into lesson JSON with the Claude API.
 *
 * Uses structured outputs (output_config.format = json_schema), so the reply is guaranteed to
 * be JSON matching schema/lesson.schema.json. SYSTEM_PROMPT and LESSON_SCHEMA live in Prompt.gs,
 * which tools/build-prompt-gs.mjs generates from prompts/lesson-prompt.md and the schema file.
 *
 * Needs an API key (Math Slides > Settings, or the ANTHROPIC_API_KEY script property). Apps Script has no Anthropic SDK, so this
 * calls the REST endpoint with UrlFetchApp.
 */

var CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

function generateLesson(criteriaText) {
  var apiKey = getSetting_('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('NO_KEY');

  var payload = {
    model: getSetting_('CLAUDE_MODEL'),
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: 'Create the lesson deck for these criteria:\n\n' + criteriaText }],
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: LESSON_SCHEMA }
    },
    // If a safety classifier declines (rare for lesson content), retry on a fallback model automatically.
    fallbacks: 'default'
  };

  var response = UrlFetchApp.fetch(CLAUDE_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) throw new Error('Claude API error ' + code + ': ' + body.slice(0, 500));

  var data = JSON.parse(body);
  if (data.stop_reason === 'refusal') throw new Error('Claude declined this request. Try rewording the criteria.');
  if (data.stop_reason === 'max_tokens') throw new Error('The lesson was too long for one reply. Ask for fewer slides.');

  var text = data.content
    .filter(function (block) { return block.type === 'text'; })
    .map(function (block) { return block.text; })
    .join('');
  return JSON.parse(text);
}

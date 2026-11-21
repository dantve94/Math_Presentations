# Research: generating math lesson decks in Google Slides from a Drive template

**Goal:** one short description of a lesson in, one finished Google Slides deck out. The deck should:

- follow your existing template and lesson flow,
- use visual models that explain the math,
- come with a teacher script (speaker notes), a lesson summary, and practical rules of thumb.

**Recommendation:** use two steps.

1. **Claude writes the lesson as structured JSON** from a "lesson criteria" prompt.
2. **A Google Apps Script copies your Drive template and fills it in**: text, native-shape math graphics, and speaker notes.

The script runs inside your Google account, so you need no server and no public image hosting. The JSON step can be done for free in claude.ai (copy and paste) or automatically through the Claude API.

---

## 1. What the example deck tells us

Source: *Jade's Grade 3 - Solve Capacity and Mass Word Problems (US units)* (27 slides).

| # | Slide | Purpose | Builder layout |
|---|---|---|---|
| 1 | Welcome | Course / domain / skill | `WELCOME` |
| 2 | Expectations | Online class norms (static) | `EXPECTATIONS` |
| 3 | Check In | Warm-up | `CHECK_IN` |
| 4 | Objectives | "Today, we will..." | `OBJECTIVES` |
| 5–6 | Definitions | 4 terms per slide | `DEFINITIONS` |
| 7–10 | Just a note / Cheat Sheet | Reference visuals | `CHEAT_SHEET` |
| 11–16 | "I do" → Practice → "I do" (answer) ×2 | Modeled problem, worked thinking, answer reveal | `I_DO_PROBLEM`, `WORK_IT_OUT`, `I_DO_ANSWER` |
| 17 | How are you? | Brain break / check | `BRAIN_BREAK` |
| 18–23 | "We do" → Practice → "We do" (answer) ×2 | Guided practice | `WE_DO_PROBLEM`, `WORK_IT_OUT`, `WE_DO_ANSWER` |
| 24 | Reflection | Restate objective | `REFLECTION` |
| 25–26 | "You do" | Exact Path breakout rooms | `YOU_DO` |
| 27 | Questions? | Close | `QUESTIONS` |

This is a gradual-release (I do → We do → You do) structure with an answer-reveal pattern, and it maps cleanly onto a template with one prototype slide per layout. `examples/grade3-capacity-mass-us.json` rebuilds the lesson in this format.

Things the generator should improve on:

- **Wrong math words.** The Practice slides say "The sum would be:" before a subtraction and a division. The prompt now asks for "sum" only with addition, "difference", "product" and "quotient" for the others, and "The equation is" otherwise.
- **Standard alignment.** CCSS 3.MD.A.2 (grade 3 liquid volume and mass) is written with grams, kilograms and liters. US customary conversions belong to 4.MD.A.1–2. Using US units in grade 3 is a valid choice, but the criteria should say so explicitly, as the deck title does. The criteria form asks for both the standard and the units.
- **Speaker notes.** The Drive text export doesn't include notes, so I couldn't confirm whether the deck has any. The builder writes a structured script into every slide's notes either way.
- **Visuals.** The jug and bag graphics are images that have to be redrawn for each new problem. The builder draws them from numbers instead.

## 2. Options compared

| Option | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Apps Script + Claude API** | A Sheet row holds the criteria. The script calls Claude and gets JSON back, then copies the template, fills slides, draws graphics and writes notes. | One click per lesson, repeatable, keeps your template exactly, everything stays in Google. | Needs an Anthropic API key (pay per use) and a one-time script setup. | **Recommended** |
| **B. claude.ai + same Apps Script** | Paste the prompt into Claude, review and revise the JSON in chat, paste it into the Sheet, click Build. | No API key, and you can chat to revise ("easier numbers") before building. | One copy and paste per lesson. | **Recommended start**: same builder, zero API cost |
| C. Claude with Google connectors | Ask Claude in chat to copy the template and edit the slides directly. | Conversational, nothing to install. | Needs the Google Slides connector. With Drive alone (this session), Claude can copy the template but can't edit slides. Drawing many shapes by hand-built API calls is slow and less consistent. | Good for one-off edits, not a production line |
| D. Python + Slides API on a server | The same as A, written in Python with OAuth. | Full control, can batch many lessons. | Server, OAuth setup and hosting. Images need public URLs. | Overkill for a teacher workflow |
| E. Built-in AI slide makers (Gemini in Slides, general AI slide tools) | Type a topic and get slides. | Fastest. | Don't follow your template's lesson flow, rarely produce a real teacher script, and draw unreliable quantities. | Fine for inspiration, not for consistent decks |

## 3. Recommended architecture

```
 Lesson criteria (Sheet row)
          │
          ▼
 Claude (API with JSON-schema structured output, or claude.ai copy/paste)
          │   lesson JSON: meta · teacher_guide · slides[ layout, title, body, graphic, notes ]
          ▼
 Validation (structure + checks every "a op b = c" in the text)
          │
          ▼
 Apps Script builder
   1. DriveApp.makeCopy(template)
   2. find prototype slides by  #layout=NAME  in their speaker notes
   3. per lesson slide: duplicate prototype → fill {{TITLE}} {{BODY}} → draw graphic in {{GRAPHIC}} box
      → write speaker notes
   4. add a hidden "Teacher Guide" slide (summary, big idea, heuristics, misconceptions, support/stretch)
   5. delete prototypes, replace deck tokens ({{GRADE}}, {{SKILL}}…)
          │
          ▼
 New deck in your Drive folder + link written back to the Sheet
```

Files: `apps-script/Code.gs` (builder, validation, Sheet menu), `Graphics.gs` (visual models), `Claude.gs` (API call), `Prompt.gs` (generated from `prompts/lesson-prompt.md` and `schema/lesson.schema.json`).

**Why JSON in the middle:**

- You can review or edit the lesson before it becomes slides.
- The same builder works whether the JSON came from the API or from chat.
- Structured outputs guarantee the shape, so the script never has to guess at free text.

## 4. Graphics strategy

Language models are unreliable at drawing exact quantities in images, such as "a jug filled to 18 of 32 fl oz" or "3 rows of 4". So **the model only chooses a visual model and its numbers, and the script draws it with native Slides shapes:**

| Model | Use for | Example params |
|---|---|---|
| `tape_diagram` | Total / Change problems, part–whole | parts 14 + ? = 32 fl oz |
| `bar_compare` | Compare problems ("how much more") | Manu 14 oz vs Sten 18 oz |
| `number_line` | Counting on/back, make-a-ten jumps, fractions | 24 → 20 → 15 |
| `measuring_container` | Capacity / liquid volume | jug 32 fl oz, level 18 |
| `equal_groups` | Sharing / grouping (÷, ×) | 2 groups of 4 gal |
| `array` | Multiplication, area | 3 × 4 |
| `fraction_bar` | Fractions | 3/4 |
| `base_ten` | Place value, regrouping | 1 hundred, 3 tens, 5 ones |
| `image` | Teacher-supplied pictures | Drive file ID or public URL |

Benefits:

- The numbers are always right.
- Every piece can be edited in Slides.
- The style stays consistent across decks.
- Each graphic gets alt text for accessibility.

For photos or clip art: Apps Script `slide.insertImage(blob)` accepts a Drive file directly. The Slides REST API (`createImage` / `replaceAllShapesWithImage`) requires a **public** PNG/JPEG/GIF URL under 50 MB and 25 megapixels, which is a key reason to use Apps Script.

## 5. The teacher script

Every slide's speaker notes follow one format, so teachers know where to look:

```
PURPOSE:    one line on why this slide exists
SAY:        word-for-word script (30–120 words, warm, conversational)
ASK:        1–3 questions to pose
LISTEN FOR: correct answers / reasoning to praise
IF STUCK:   a specific hint or heuristic
VISUAL:     what the graphic shows (alt text)
TIME:       about N min
```

- The **first slide's notes** start with the lesson's big idea and summary.
- A **hidden Teacher Guide slide** (skipped when presenting) holds the summary, big idea, prerequisites, 4–8 heuristics, misconceptions with fixes, support and stretch ideas, materials, and planned vs. available time.

### Teaching heuristics built into the prompt

These come from widely used, evidence-based elementary math practice:

- **Concrete → Representational → Abstract.** Show a model before the equation. The IES practice guide recommends mixing concrete and semi-concrete representations: strip (tape) diagrams, drawings, tables, arrays, graphs and number lines.
- **Teach word problems by structure (schema), not keywords.** Total, Change, Compare, Equal groups. IES guidance recommends teaching problems by their common underlying structure. "In all means add" breaks easily, so the prompt bans it.
- **One routine for every problem:** know → need → type → equation → check. Students hear it in "I do", share it in "We do", and use it alone in "You do".
- **Units travel with numbers**, and every answer gets checked with the inverse operation or an estimate.
- **Differentiation in the notes:** an "if stuck" hint per slide, plus support and stretch in the guide. English-learner cues (gesture, picture) go with new vocabulary.

## 6. Prompt design: what the lesson criteria should include

| Field | Why it matters |
|---|---|
| Grade + standard code and text | Pins grade-level expectations (CCSS, TEKS, B.E.S.T., etc.) |
| Platform alignment (e.g., Exact Path domain/skill) | Matches the Welcome slide and "You do" activity |
| Objective | Becomes the Objectives slide and the Reflection |
| Units / number range | Prevents mixed units and out-of-range numbers |
| Class profile (no student names) | Shapes the notes: ELL supports, gaps, online vs. in person |
| Must include / avoid | Required problem types, banned strategies |
| Number of I do / We do examples | Controls deck length and timing |
| Context / characters | Keeps a series of decks consistent (Manu and Sten) |

The full prompt is in `prompts/lesson-prompt.md`. The JSON contract is in `schema/lesson.schema.json`.

## 7. Practical limits and risks

- **Math accuracy.** The prompt makes the model double-check its arithmetic. The builder also checks every `a op b = c` it finds and writes warnings to the Sheet. A teacher should still skim each deck before class.
- **Text fit.** Slides doesn't shrink text written through the API. The prompt caps slide text at about 45 words, and the script reduces the font size if a body would overflow its box.
- **Apps Script limits.** Each run can last at most 6 minutes. A 27-slide deck with graphics means a few hundred shape inserts, which should take about 1–2 minutes. The Claude call is a single request. If it ever times out, use option B (claude.ai), or set `CLAUDE_MODEL` to `claude-sonnet-5-5` for faster, cheaper generation.
- **Cost (option A).** About 3k input tokens and 10–15k output tokens per lesson. On Claude Opus 5.5 ($4 / $20 per million tokens) that is roughly $0.20–0.35 per lesson. Sonnet 5.5 costs about half. Option B costs nothing beyond a claude.ai plan.
- **Privacy.** Don't put student names or records in the criteria. Describe the class in general terms.
- **Template drift.** If someone edits the template and deletes a `{{TOKEN}}` or `#layout=` tag, that slide falls back to `GENERIC` or keeps its static text. Keep the template in a protected folder.

## 8. Status of this repository

| Piece | Status |
|---|---|
| Prompt, schema, example lesson | Done |
| Apps Script builder, graphics, validator, Claude call | Written, and run offline against a mock of SlidesApp/DriveApp with `node tools/test-local.mjs`: 27 slides built, no unreplaced tokens, no elements off the slide, arithmetic check passes, wrong sums caught. **Not yet run against real Google Slides.** |
| Template | Needs your one-time prep (`docs/template-setup.md`) |

**Next steps:**

1. Tag a copy of your template.
2. Set up the Sheet and script.
3. Build the example JSON and compare it with Jade's deck.
4. Adjust the prompt wording and the graphic styling to taste.

## Sources

- Google Apps Script Slides service, [NotesPage / speaker notes](https://developers.google.com/apps-script/reference/slides/notes-page) and [Slides Service reference](https://developers.google.com/apps-script/reference/slides)
- Google Slides API, [Work with speaker notes](https://developers.google.com/slides/api/guides/notes), [Add images to a slide](https://developers.google.com/slides/how-tos/add-image) (public URL, under 50 MB, 25 MP, PNG/JPEG/GIF), [Merge data into a presentation](https://developers.google.com/workspace/slides/how-tos/merge?authuser=3), [ReplaceAllShapesWithImageRequest](https://googleapis.dev/nodejs/googleapis/latest/slides/interfaces/Schema$ReplaceAllShapesWithImageRequest.html)
- Anthropic, [Google Apps Scripter prompt example](https://docs.anthropic.com/en/prompt-library/google-apps-scripter). Claude API structured outputs (`output_config.format`)
- IES What Works Clearinghouse, [Assisting Students Struggling with Mathematics: Intervention in the Elementary Grades (2021)](https://ies.ed.gov/ncee/WWC/Docs/PracticeGuide/WWC2021006-Math-PG.pdf), [summary](https://ies.ed.gov/ncee/WWC/Docs/PracticeGuide/WWC-PraxGuide-Elementary-Math-Summary-508c.pdf), [REL Southeast: Using Visual Representations](https://ies.ed.gov/ncee/rel/infographics/pdf/REL_SE_Using_Visual_Representations.pdf), and the [2009 RTI practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/2/) (teaching word problems by underlying structure)

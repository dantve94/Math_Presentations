# Setting up the Drive template and the script (one time, about 20 minutes)

## 1. Make the template deck

Start from a copy of a deck you like (for example, Jade's Grade 3 deck) and keep **one slide per layout**. Delete the duplicates.

On each kept slide:

1. **Tag it.** Put this on its own line in the speaker notes:
   `#layout=I_DO_PROBLEM` (use one of the names below).
2. **Add placeholders** as text boxes, styled the way you want the final text to look:
   - `{{TITLE}}`: the slide heading box.
   - `{{BODY}}`: the main text box. Its font size is the *largest* size used; the script shrinks long text to fit.
   - `{{GRAPHIC}}`: an empty box marking where the math visual goes. The script deletes the box and draws inside its area. If you leave it out, graphics go on the right half of the slide.
3. Static slides (Expectations, How are you?) can stay exactly as they are. Just tag them.

Tokens you can use anywhere (replaced on every slide): `{{GRADE}}`, `{{SKILL}}`, `{{DOMAIN}}`, `{{STANDARD}}`, `{{OBJECTIVE}}`, `{{DECK_TITLE}}`.

| Layout name | Typical content |
|---|---|
| `WELCOME` | Title + course/domain/skill |
| `EXPECTATIONS` | Static class norms |
| `CHECK_IN` | Warm-up question + graphic |
| `OBJECTIVES` | "Today, we will..." |
| `DEFINITIONS` | Terms + optional graphic |
| `CHEAT_SHEET` | Reference + graphic |
| `I_DO_PROBLEM` / `I_DO_ANSWER` | Word problem + graphic (answer version adds the equation) |
| `WORK_IT_OUT` | Know / need / type / equation / check + graphic |
| `BRAIN_BREAK` | "How are you?" |
| `WE_DO_PROBLEM` / `WE_DO_ANSWER` | Guided practice |
| `REFLECTION` | "Today we..." |
| `YOU_DO` | Independent practice instructions |
| `QUESTIONS` | Close |
| `GENERIC` | Fallback for any missing layout (title + body + graphic) |
| `TEACHER_GUIDE` | Optional: the hidden guide slide (falls back to `GENERIC`) |

A layout with no prototype uses `GENERIC`, so a minimal template needs only a `GENERIC` slide.

Copy the template's ID from its URL: `docs.google.com/presentation/d/`**`THIS_PART`**`/edit`.

## 2. Make the requests Sheet and add the script

1. Create a Google Sheet called "Lesson Requests".
2. Open **Extensions → Apps Script**.
3. Create files matching `apps-script/`: `Code.gs`, `Graphics.gs`, `Claude.gs`, `Prompt.gs`. Paste each file's contents in.
4. Open **Project Settings**:
   - Turn on "Show appsscript.json", then paste `apps-script/appsscript.json`.
   - Under **Script properties**, add:
     - `TEMPLATE_ID` = your template's ID
     - `OUTPUT_FOLDER_ID` = a Drive folder ID for new decks (optional)
     - `ANTHROPIC_API_KEY` = your key from console.anthropic.com (optional; only needed for one-click generation)
     - `CLAUDE_MODEL` = `claude-opus-5-5` (default) or `claude-sonnet-5-5` (faster and cheaper)
5. Reload the Sheet. A **Math Slides** menu appears. Run **Set up this sheet** and approve the permissions.

## 3. Make a deck

**Without an API key:**

1. Paste the system prompt from `prompts/lesson-prompt.md` and your criteria into claude.ai.
2. Ask for revisions until you're happy.
3. Paste the JSON into the **Lesson JSON** column.
4. Select the row, then choose **Math Slides → Build deck for selected row**.

**With an API key:**

1. Fill in columns A–F.
2. Choose **Generate JSON only** to review first, or go straight to **Build deck**.

The deck link and any warnings (such as an equation that doesn't add up) appear in the Status and Deck link columns.

## 4. Changing the prompt or schema

Edit `prompts/lesson-prompt.md` or `schema/lesson.schema.json`, then run:

```bash
node tools/build-prompt-gs.mjs   # regenerates apps-script/Prompt.gs
node tools/test-local.mjs        # offline check of the builder with the example lesson
```

Then paste the new `Prompt.gs` into the Apps Script editor.

# Setting up the template, the Sheet and the script

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

The Grade 3 template is already set up and its ID is built into the script. If you make your own template, paste its link into **Math Slides → Settings... → Template deck**.

## 2. Make the Lesson Requests Sheet (once, by one person)

1. Create a Google Sheet called "Lesson Requests".
2. Open **Extensions → Apps Script**.
3. Add a script file (**+ → Script**) for each `.gs` file in `apps-script/`: `Code.gs`, `Ui.gs`, `Graphics.gs`, `Claude.gs`, `Prompt.gs`. Paste each file's contents in. Apps Script adds `.gs` itself, so name them `Code`, `Ui` and so on.
4. Add two HTML files (**+ → HTML**) named `Sidebar` and `Settings`, and paste in `apps-script/Sidebar.html` and `apps-script/Settings.html`.
5. In **Project Settings**, turn on "Show appsscript.json", then paste `apps-script/appsscript.json` into it.
6. Reload the Sheet. A **Math Slides** menu appears. Choose **New lesson...** and approve the permissions. Google may say it "hasn't verified this app": choose **Advanced → Go to (project name)**. That warning is normal for a script you wrote yourself.

No settings are needed: the template ID is built in (`DEFAULTS.TEMPLATE_ID` in `Ui.gs`). If you have an Anthropic API key, add it in **Math Slides → Settings...**.

## 3. Share it with other teachers (no setup for them)

Copying a Google Sheet also copies its script, so other teachers only need a copy link.

1. **Share the template deck** so everyone can read it: open the template, click **Share**, and under **General access** choose your school (or "Anyone with the link") as **Viewer**. Without this, their builds fail with "Can't open the template deck".
2. **Share the Sheet** the same way, as **Viewer**.
3. Take the Sheet's address and change the end from `/edit...` to `/copy`:
   `https://docs.google.com/spreadsheets/d/SHEET_ID/copy`
   Anyone who opens that link sees a **Make a copy** button. Their copy has the Math Slides menu ready to use.

Settings are saved per person, not in the Sheet. So your API key is never copied, and each teacher can add their own key and choose their own folder for new decks.

## 4. Make a deck

Choose **Math Slides → New lesson...**. A panel opens on the right.

1. Fill in the grade, skill and objective. **More details** (class profile, number range, words to define, and so on) is optional but makes the lesson better.
2. Then:
   - **With an API key:** click **Write lesson and build deck**. It takes about 2 minutes.
   - **Without a key:** click **Copy prompt**, then **Open claude.ai**, paste into a new chat, and ask for changes until you're happy. Copy Claude's whole reply, paste it into box 2, and click **Build deck**. The reply can include words around the JSON; the script finds the lesson inside it.
3. Click **Open the deck**. If an equation doesn't add up, the panel lists it under "Check these before teaching".

Each lesson is saved as a row in the Sheet, with its lesson JSON (column G), status and deck link. To rebuild after editing the JSON, select the row and choose **Build deck for selected row**. You can still type criteria straight into columns A–F and use the row menu items instead of the panel.

## 5. Changing the prompt or schema

Edit `prompts/lesson-prompt.md` or `schema/lesson.schema.json`, then run:

```bash
node tools/build-prompt-gs.mjs   # regenerates apps-script/Prompt.gs
node tools/test-local.mjs        # offline check of the builder with the example lesson
```

Then paste the new `Prompt.gs` into the Apps Script editor. Teachers who already made a copy keep the old version until they make a fresh copy.

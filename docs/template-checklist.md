# Template checklist: "TEMPLATE - Math Lesson (from Grade 3 Capacity and Mass)"

Deck: https://docs.google.com/presentation/d/1t8XIlzfNyII46e-o4m2FT3zpx0lWiQDeIS3ZeAPSdTw/edit
(this ID is built into the script as `DEFAULTS.TEMPLATE_ID` in `apps-script/Ui.gs`)

> **Status (21 Nov 2026): done.** All of the changes below were applied to the deck through the Slides API. It now has 16 slides: the 15 tagged layouts plus `GENERIC` (last).
> How the applied version differs from the plan below:
> - **WELCOME** has no `{{BODY}}`. The Course / Domain / Skill box keeps its formatting and uses `{{DOMAIN}}` and `{{SKILL}}`, which come from the lesson's `meta`. So the WELCOME slide's `body` in the lesson JSON is not used.
> - **YOU_DO**: only the title is a placeholder. The breakout-room steps and pictures stay static.
> - **OBJECTIVES** and **REFLECTION** keep their decorative pictures and have no `{{GRAPHIC}}` box (their lesson graphic is `none`).
> - Every `{{GRAPHIC}}` box has a grey dashed outline so it's easy to spot. The builder deletes it when it draws.
> - The page is 13.33 x 7.5 in (960 x 540 pt), not the 720 x 405 that `DEFAULT_GRAPHIC_BOX` in `apps-script/Code.gs` assumes. That's why every slide that takes a graphic has an explicit `{{GRAPHIC}}` box.

Before the edit, the deck had 27 slides. Keep 15, delete 12, then add 1 `GENERIC` slide (16 total).
The tag goes on its own line in the speaker notes, e.g. `#layout=I_DO_PROBLEM`.

What the builder does with each box (`apps-script/Code.gs`):
- A box whose whole text is `{{TITLE}}` or `{{BODY}}` gets the slide's text, keeping the box's style. `{{BODY}}` shrinks from the box's font size to fit.
- The `{{GRAPHIC}}` box is deleted and the math visual is drawn inside its area. With no `{{GRAPHIC}}` box, the visual goes at the right half (left 400, top 110, 290 x 250 pt).
- Everything else on the slide (header bar, logos, decorative pictures) is copied into every generated slide as-is. **So any picture or label tied to this lesson (jug, berries, "Jug: 32 fl oz") must be deleted**, or it will show up in every deck.
- Template slides are removed from the finished deck, so untagged leftovers do no harm. Deleting them keeps the template tidy.

## Slide by slide

| # | Slide now | Action | Tag | What to change |
|---|---|---|---|---|
| 1 | Welcome | Keep | `WELCOME` | "Welcome" → `{{TITLE}}`. The Course / Domain / Skill box → `{{BODY}}` (the lesson JSON writes all three lines). |
| 2 | Expectations | Keep | `EXPECTATIONS` | Static. Tag only. |
| 3 | Check In (picture only) | Keep | `CHECK_IN` | "Check In" → `{{TITLE}}`. Replace the picture with a `{{GRAPHIC}}` box. **Add** a `{{BODY}}` box for the warm-up question. |
| 4 | Objectives | Keep | `OBJECTIVES` | "Objectives" → `{{TITLE}}`. "Today, we will…" box → `{{BODY}}`. The picture is decorative: keep it, or swap for `{{GRAPHIC}}` if you want room for a visual. |
| 5 | Definitions (Length, Distance…) | Keep | `DEFINITIONS` | "Definitions" → `{{TITLE}}`. Definitions box → `{{BODY}}`; narrow it to the left and add a `{{GRAPHIC}}` box on the right. |
| 6 | Definitions (Volume, Operations…) | **Delete** | | Repeat of 5. |
| 7 | Just a note / Cheat Sheet | Keep | `CHEAT_SHEET` | "Just a note" → `{{TITLE}}`. Replace the picture with `{{BODY}}` (left) and `{{GRAPHIC}}` (right). The "Cheat Sheet" label can stay static. |
| 8 | Just a note / Cheat Sheet | **Delete** | | Repeat of 7. |
| 9 | Just a note / Cheat Sheet | **Delete** | | Repeat of 7. |
| 10 | Just a note / Cheat Sheet | **Delete** | | Repeat of 7. |
| 11 | "I do" (jug 32 fl oz, question) | Keep | `I_DO_PROBLEM` | "I do" → `{{TITLE}}`. Question box → `{{BODY}}`. Delete the jug picture **and** the "Jug: 32 fl oz" label; put a `{{GRAPHIC}}` box where they were. |
| 12 | Practice (14 fl oz used…) | Keep | `WORK_IT_OUT` | "Practice" → `{{TITLE}}` (the lesson calls it "Let's work it out"). Working box → `{{BODY}}`. Add a `{{GRAPHIC}}` box on the right and narrow the body box so they don't overlap. |
| 13 | "I do" (jug, with answer) | Keep | `I_DO_ANSWER` | Same as 11. The body carries the question and the equation together. |
| 14 | "I do" (berries 24 oz) | **Delete** | | Repeat of 11. |
| 15 | Practice (9 oz used…) | **Delete** | | Repeat of 12. |
| 16 | "I do" (berries, with answer) | **Delete** | | Repeat of 13. |
| 17 | How are you? | Keep | `BRAIN_BREAK` | Static. Tag only. |
| 18 | "We do" (8 gallons, question) | Keep | `WE_DO_PROBLEM` | "We do" → `{{TITLE}}`. Question box → `{{BODY}}`. Delete the jug picture and the "Jug: 8 gallons" label; add `{{GRAPHIC}}`. "Practice - Exact Path Resource" can stay static. |
| 19 | Practice (8 gallons / 2) | **Delete** | | Repeat of 12. |
| 20 | "We do" (8 gallons, with answer) | Keep | `WE_DO_ANSWER` | Same as 18. Also delete the separate "8 ÷ 2 = 4 gallons" box: the equation now arrives inside `{{BODY}}`. |
| 21 | "We do" (nuts 14 oz + 18 oz) | **Delete** | | Repeat of 18. |
| 22 | Practice (14 oz + 18 oz) | **Delete** | | Repeat of 12. |
| 23 | "We do" (nuts, with answer) | **Delete** | | Repeat of 20. |
| 24 | Reflection | Keep | `REFLECTION` | "Reflection" → `{{TITLE}}`. "understood how to…" box → `{{BODY}}`. **Delete** the "Today we…." box: the lesson body already starts with "Today we...". |
| 25 | "You do" (breakout room steps, 4 pictures) | Keep | `YOU_DO` | "You do" → `{{TITLE}}`. Either leave it static (the pictures match the steps) or turn the steps box into `{{BODY}}` and delete the step pictures. |
| 26 | "You do" (short version) | **Delete** | | Repeat of 25. |
| 27 | Questions? | Keep | `QUESTIONS` | "Questions?" → `{{TITLE}}`. "Any Questions?" → `{{BODY}}`, or leave both static. |
| new | — | **Add** | `GENERIC` | Duplicate slide 4 (Objectives) or 11. Header → `{{TITLE}}`, a `{{BODY}}` box on the left, a `{{GRAPHIC}}` box on the right, no other pictures. Used for any layout without a slide, and for the hidden Teacher Guide. |

Slide numbers follow the deck order, top to bottom, as of 21 Nov 2026.

Keep count: 1, 2, 3, 4, 5, 7, 11, 12, 13, 17, 18, 20, 24, 25, 27 = 15, plus `GENERIC`.

## Quick checks before using it

- Each kept slide has exactly one `#layout=` line, spelled in capitals with underscores.
- Each `{{TITLE}}` / `{{BODY}}` box holds only the token (no other text), so it gets restyled and shrunk to fit.
- No jug, berries, nuts or number labels left on any slide.
- Optional tokens you can type anywhere: `{{GRADE}}`, `{{SKILL}}`, `{{DOMAIN}}`, `{{STANDARD}}`, `{{OBJECTIVE}}`, `{{DECK_TITLE}}`.

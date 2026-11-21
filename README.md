# Math Presentations

Generate Google Slides math lessons for US K–8 students from **your own Drive template**. Each deck gets:

- a gradual-release lesson flow (I do → We do → You do),
- exact visual models (tape diagrams, number lines, jugs, arrays, fraction bars...) drawn as editable shapes,
- a word-for-word teacher script in every slide's speaker notes,
- a hidden Teacher Guide slide with the summary, big idea, heuristics, misconceptions and differentiation.

```
lesson criteria ──► Claude (lesson JSON) ──► Apps Script ──► copy of your template, filled in
```

| Start here | |
|---|---|
| [docs/research.md](docs/research.md) | Research, options compared, recommendation, limits, sources |
| [docs/template-setup.md](docs/template-setup.md) | One-time setup of the template, Sheet and script |
| [prompts/lesson-prompt.md](prompts/lesson-prompt.md) | Lesson criteria form + system prompt (also works pasted into claude.ai) |
| [schema/lesson.schema.json](schema/lesson.schema.json) | The lesson JSON contract |
| [examples/grade3-capacity-mass-us.json](examples/grade3-capacity-mass-us.json) | The Grade 3 capacity and mass deck rebuilt in this format |
| [apps-script/](apps-script/) | Builder (`Code.gs`), graphics (`Graphics.gs`), Claude API call (`Claude.gs`), generated `Prompt.gs` |

## Develop

```bash
node tools/build-prompt-gs.mjs                       # rebuild Prompt.gs after editing the prompt/schema
node tools/test-local.mjs [lesson.json] [--preview out.html]   # offline test against a mock of Google Slides
```

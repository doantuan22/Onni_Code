# OnniCode landing site — "Parallel Light"

The design record and the finished static site for the OnniCode introduction page.

**Open it:** `docs/landing-site/site/index.html` (double-click, works from `file://`), or serve the folder:
`npx serve docs/landing-site/site` / `python -m http.server -d docs/landing-site/site`.

| Step | File |
| --- | --- |
| Brief | [00-brief.md](00-brief.md) |
| Four concepts from four workers | [01-ideas/](01-ideas/) — A Flight Deck, B Quiet Studio, C Parallel Worlds, D Living Bus |
| Merged direction | [02-concept.md](02-concept.md) |
| Mockups | [03-mockups/round-1/](03-mockups/round-1/) generated images + self-critiques; [round-2/](03-mockups/round-2/) captures of the HTML prototype |
| Review of the mockups | [04-review.md](04-review.md) |
| Build plan | [05-plan.md](05-plan.md) |
| QA and fixes | [06-qa.md](06-qa.md) |
| The site | [site/](site/) — see [site/README.md](site/README.md) for the section contract |
| Capture tool | `node docs/landing-site/tools/capture.mjs <out-dir> [--mobile] [--light] [--reduced]` |

Round 2 was built as HTML prototypes instead of images because the image-generation quota ran out.

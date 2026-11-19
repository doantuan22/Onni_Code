# Agent chat presentation

Implemented 2026-11-20. The request is to bring command output, completion folding
and agent replies closer to desktop coding assistants without changing agent content.

## Behavior

- A collapsed tool fits its summary; an expanded tool is capped at 42rem and the
  available container width. The existing full-width reading preference still
  applies to the conversation. Command/output overflow stays inside its own card.
- Running commands retain their live output tail. Successful completion closes a
  manually expanded live card once; readers may reopen the completed result.
- Consecutive successful actions fold into one completed-actions summary when a
  turn settles, including groups shorter than the live three-item tail. A final
  response phase also folds its preceding successful work while the answer streams.
- Failed, declined and running top-level tools remain visible and break a streak.
  Grouping does not cross prose, questions, errors or turn boundaries.
- Old recordings without a turn-completion timestamp use the run's waiting/terminal
  state for folding. The presentation does not invent a timestamp or success status.
- Group choices are cached per task and turn. A successful live-to-complete
  transition closes the summary once; reopening history respects the reader's choice.
- Assistant prose has a readable 78ch maximum. Only the current assistant tail
  animates new words; reduced-motion disables that effect. Historical content stays
  static. Copy response writes the original Markdown and appears for the completed
  response, with existing code-block copy controls retained.
- Disclosure height/opacity transitions are scoped to the disclosure body, avoiding
  transforms on measured transcript rows. Existing scroll ownership and flat/virtual
  renderers remain in use. Vietnamese labels cover the new controls.

## Evidence

Five regression cases failed before the change: two successful commands did not
fold on completion, unsafe states were not separated from the new summary, a
manually expanded command stayed open, and both document/panel transcripts retained
completed command cards. The fixes and additional history, final-phase, copy and
reduced-motion cases passed in the focused suites (174 tests).

Typecheck web, production web build and pack gate passed. Browser checks use a
temporary local fixture rendering the actual SessionTranscript/ToolCard components,
not a duplicated HTML mockup. Verified active output, automatic folding, manual
reopening, error visibility, dark/light themes and a 390px viewport with page width
390px (no horizontal page overflow). Screenshots are under `.tmp/agent-chat-*`.
This does not claim validation against an installed Tauri binary or live paid agents.

All 376 web suites passed: **6,224 tests** in `.tmp/agent-chat-web-tests.log`.

# next-steps

After each turn, suggests up to three next prompts above the input box.

```
next:
  1: run the tests you just wrote
  2: do the same for the settings page
  3: /code-review high
  0: dismiss
```

Press `1`, `2` or `3` from an empty prompt box (or click one) and that prompt is written into the box as a draft. Edit it, then press Enter yourself. `0` dismisses. The top suggestion also shows as the box's dim ghost text, so Tab takes it.

The plugin never submits a prompt on its own.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete`: forks the session with `$.model.fork` to ask for likely next prompts. The fork shares the session's prompt cache, so it costs about one short reply.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `ui.render` on `AbovePrompt`: draws the suggestions as buttons.
- A press calls `$.prompt.fill`; the top suggestion goes to `$.prompt.suggest`.
- `turn.start`: hides the suggestions.

Suggestions draw as buttons in the terminal and the desktop app.

## In other apps

The band above the prompt box exists only in the terminal and the desktop app. Where the session has no such surface (the Claude mobile app, VS Code, a cloud session, `claude -p`), or one of those is attached alongside the terminal, the suggestions are also written to the transcript as one dim line:

```
next steps (reply n1-n3 to send one):
  n1  run the tests you just wrote
  n2  do the same for the settings page
  n3  /code-review high
```

Send `n1`, `n2` or `n3` as your next message and it is replaced by that suggestion. The swap happens only for a message you sent yourself, only for the suggestions shown since the last turn, and only once; any other text goes through unchanged. The line is not sent to the model.

- `$.session.surfaces`: which apps are attached, to decide whether the line is needed.
- `$.ui.log`: writes the line.
- `prompt.submit`: swaps `n1`-`n3` for the suggestion.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |
| `textFallback` | `true` | In apps without the band, write the suggestions to the transcript and accept `n1`-`n3` |

## Tests

Run `claude plugin test` in this directory.

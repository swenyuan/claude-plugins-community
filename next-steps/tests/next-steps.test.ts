import { expect, test } from 'claude-code/testing'

const ANSWER = 'Done. I added the settings page, wired it into the router and wrote tests for it; they have not been run yet.'
const REPLY =
  '[{"label":"run the tests","prompt":"run the settings page tests"},' +
  '{"label":"commit","prompt":"commit this with a short message"}]'
const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type Stubs = { surfaces: readonly string[]; logs: string[]; sent: string[]; asked: boolean }

function stub(on: Parameters<Parameters<typeof test>[1]>[1], surfaces: readonly string[]): Stubs {
  const s: Stubs = { surfaces, logs: [], sent: [], asked: false }
  on('turn.complete', () => ({ text: '' }))
  on('command.list', () => ({ value: [] }))
  on('model.fork', () => ({ value: { isAnswered: true, text: REPLY, usage: USAGE } }))
  on('prompt.suggest', () => ({ isShown: false }))
  on('session.surfaces', () => {
    s.asked = true
    return { value: s.surfaces }
  })
  on('ui.log', ($, e) => {
    s.logs.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    s.sent.push(e.text)
    return { text: e.text }
  })
  return s
}

// The fork runs detached from turn.complete: wait until it has asked which
// surfaces draw (the last step before the transcript line), then a little more.
async function settle(s: Stubs): Promise<void> {
  for (let waited = 0; waited < 2000 && !s.asked; waited += 20) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  await new Promise(resolve => setTimeout(resolve, 20))
}

async function finishTurn($: Parameters<Parameters<typeof test>[1]>[0], s: Stubs): Promise<void> {
  await $.turn.complete({
    turnId: 't1',
    reason: 'answer',
    answer: ANSWER,
    durationMs: 1,
    isAborted: false,
    usage: null,
  } as never)
  await settle(s)
}

for (const surfaces of [[], ['mobile'], ['vscode'], ['terminal', 'mobile']]) {
  test(`writes the suggestions to the transcript on [${surfaces.join(', ')}]`, async ($, on) => {
    const s = stub(on, surfaces)
    await finishTurn($, s)
    expect(s.logs).toHaveLength(1)
    expect(s.logs[0]).toContain('n1  run the settings page tests')
    expect(s.logs[0]).toContain('n2  commit this with a short message')
  })
}

for (const surfaces of [['terminal'], ['desktop']]) {
  test(`leaves the transcript alone on [${surfaces.join(', ')}]`, async ($, on) => {
    const s = stub(on, surfaces)
    await finishTurn($, s)
    expect(s.logs).toHaveLength(0)
  })
}

test('textFallback false writes nothing', { options: { textFallback: false } }, async ($, on) => {
  const s = stub(on, ['mobile'])
  await finishTurn($, s)
  // The surfaces are never asked when the option is off; give the fork time.
  await new Promise(resolve => setTimeout(resolve, 300))
  expect(s.logs).toHaveLength(0)
})

test('n2 from the person sends the second suggestion, once', async ($, on) => {
  const s = stub(on, ['mobile'])
  await finishTurn($, s)
  await $.prompt.submit({ text: ' N2 ', origin: { kind: 'bridge' }, wait: false } as never)
  await $.prompt.submit({ text: 'n2', origin: { kind: 'bridge' }, wait: false } as never)
  expect(s.sent).toEqual(['commit this with a short message', 'n2'])
})

test('n3 past the list, and codes from a peer, pass through unchanged', async ($, on) => {
  const s = stub(on, ['mobile'])
  await finishTurn($, s)
  await $.prompt.submit({ text: 'n3', origin: { kind: 'sdk' }, wait: false } as never)
  await $.prompt.submit({ text: 'n1', origin: { kind: 'peer' }, wait: false } as never)
  expect(s.sent).toEqual(['n3', 'n1'])
})

test('a code means nothing where the band was drawn', async ($, on) => {
  const s = stub(on, ['terminal'])
  await finishTurn($, s)
  await $.prompt.submit({ text: 'n1', origin: { kind: 'composer' }, wait: false } as never)
  expect(s.sent).toEqual(['n1'])
})

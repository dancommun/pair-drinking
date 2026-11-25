import { expect, test } from 'claude-code/testing'

import type { Tab } from '../types'
import { CUT_OFF, DRINKS, KINDS, LEVEL_NAMES, SCORE_TOOL, barScene, bill, isOpenNow, levelOf, noteFor, parseScene, sceneName, wearOff } from './register'

test('units decide the level', async () => {
  expect(levelOf(0)).toBe(0)
  expect(levelOf(1)).toBe(1)
  expect(levelOf(5)).toBe(1)
  expect(levelOf(6)).toBe(2)
  expect(levelOf(11)).toBe(2)
  expect(levelOf(12)).toBe(3)
  expect(LEVEL_NAMES[levelOf((DRINKS.rakia ?? 0) * 2)]).toBe('Drunk')
  expect(LEVEL_NAMES[levelOf((DRINKS.rakia ?? 0) * 3)]).toBe('Wasted')
})

test('the scene name carries the level and the glasses, both ways', async () => {
  expect(sceneName({ units: 8, drinks: 2 })).toBe('bar-2-2')
  expect(sceneName({ units: 0, drinks: 30, isHungover: true })).toBe('bar-h-20')
  expect(parseScene('bar-3-7')).toEqual({ level: 3, glasses: 7, isHungover: false })
  expect(parseScene('bar-h-4')).toEqual({ level: 0, glasses: 4, isHungover: true })
  expect(parseScene('night-sky')).toBe(undefined)
})

test('every scene is a whole drawing under the size limit', async () => {
  for (const level of [0, 1, 2, 3]) {
    const svg = barScene(level, 20)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg.length < 131072).toBe(true)
  }
  const morning = barScene(0, 6, true)
  expect(morning.includes('animation: swing')).toBe(false)
  expect(morning.length < 131072).toBe(true)
})

test('Claude is told nothing sober and the house rules otherwise', async () => {
  expect(noteFor({ units: 0, drinks: 0 })).toBe(undefined)
  const tipsy = noteFor({ units: 4, drinks: 1 }) ?? ''
  expect(tipsy.includes('You are Tipsy')).toBe(true)
  expect(tipsy.includes('stays sober and correct')).toBe(true)
  const wasted = noteFor({ units: 14, drinks: 4 }) ?? ''
  expect(wasted.includes('You are Wasted')).toBe(true)
  expect(wasted.includes('never encourage the person to drink')).toBe(true)
  const morning = noteFor({ units: 0, drinks: 3, isHungover: true }) ?? ''
  expect(morning.includes('hangover')).toBe(true)
  expect(tipsy.includes('not the cartoon')).toBe(true)
  const fine = noteFor({ units: 8, drinks: 2, kind: 2 }) ?? ''
  expect(fine.includes('the one who is fine')).toBe(true)
})

test('a unit wears off every third message and a hangover lifts after eight', async () => {
  let state: Tab = { units: 2, drinks: 1, kind: 0 }
  for (let i = 0; i < 3; i++) state = wearOff(state)
  expect(state.units).toBe(1)
  for (let i = 0; i < 3; i++) state = wearOff(state)
  expect(state.units).toBe(0)
  expect(state.drinks).toBe(1)
  expect(wearOff(state)).toBe(state)
  let morning: Tab = { units: 0, drinks: 4, isHungover: true }
  for (let i = 0; i < 8; i++) morning = wearOff(morning)
  expect(morning.isHungover).toBe(true)
  expect(wearOff(morning)).toEqual({ units: 0, drinks: 0, isOpen: true })
})

test('a shot adds its strength to the tab and tells Claude', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pair-drinking__${e.name}` } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('theme.clear', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const first =await $.command.run({ command: 'shot', args: 'rakia' } as never)
  expect(first.text?.startsWith('Claude downs a rakia. Tab: 1 drink, 4 units. Claude is now Tipsy. Tonight Claude is the ')).toBe(true)
  expect(KINDS.some(kind => first.text?.endsWith(`${kind.name}.`))).toBe(true)
  expect((first.context ?? [])[0]?.includes('You are Tipsy')).toBe(true)

  const second = await $.command.run({ command: 'shot', args: 'beer' } as never)
  expect(second.text).toBe('Claude downs a beer. Tab: 2 drinks, 5 units. Claude is now Tipsy.')

  const third = await $.command.run({ command: 'shot', args: 'vodka' } as never)
  expect(third.text).toBe('Claude downs a vodka. Tab: 3 drinks, 8 units. Claude is now Drunk.')

  const unknown = await $.command.run({ command: 'shot', args: 'milk' } as never)
  expect(unknown.text?.startsWith('The bar does not serve "milk"')).toBe(true)

  const local = await $.command.run({ command: 'shot', args: 'Rakija' } as never)
  expect(local.text).toBe('Claude downs a rakia. Tab: 4 drinks, 12 units. Claude is now Wasted.')

  const card = await $.command.run({ command: 'shot', args: 'menu' } as never)
  expect(card.text?.includes('rakia 4')).toBe(true)

  let last = third
  for (let i = 0; i < 3; i++) last = await $.command.run({ command: 'shot', args: 'absinthe' } as never)
  expect(last.text).toBe(`The bartender cuts Claude off at ${CUT_OFF - 1} units. Water only until some of it wears off.`)
  const water = await $.command.run({ command: 'shot', args: 'water' } as never)
  expect(water.text?.startsWith('Claude downs a water.')).toBe(true)

  const sober = await $.command.run({ command: 'sober' } as never)
  expect(sober.text?.startsWith('Coffee served. The bar is closed and Claude is Sober.')).toBe(true)
  expect(sober.text?.includes('Drinks: 2 rakia, 1 beer, 1 vodka, 1 absinthe, 1 water.')).toBe(true)
  expect(sober.text?.includes(`Peak: ${CUT_OFF - 1} units, Wasted. Tonight Claude was the `)).toBe(true)

  const again = await $.command.run({ command: 'sober' } as never)
  expect(again.text).toBe('The bar is not open in this session. /shot or /snack opens it.')
})

test('meze takes the edge off the next drink, down to one unit', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pair-drinking__${e.name}` } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('theme.clear', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ajvar = await $.command.run({ command: 'snack', args: 'ajvar' } as never)
  expect(ajvar.text).toBe('Claude eats some ajvar. The next drink lands 1 unit softer.')
  const cheese = await $.command.run({ command: 'snack', args: 'сирење' } as never)
  expect(cheese.text).toBe('Claude eats some cheese. The next drink lands 3 units softer.')
  const full = await $.command.run({ command: 'snack', args: '' } as never)
  expect(full.text).toBe('Claude is full. No more meze until a drink goes down.')
  const pizza = await $.command.run({ command: 'snack', args: 'pizza' } as never)
  expect(pizza.text?.startsWith('The kitchen does not make "pizza"')).toBe(true)

  const beer = await $.command.run({ command: 'shot', args: 'beer' } as never)
  expect(beer.text?.startsWith('Claude downs a beer. Tab: 1 drink, 1 unit. Claude is now Tipsy.')).toBe(true)
  // Any drink uses the food up, so Claude can eat again.
  const again = await $.command.run({ command: 'snack', args: 'burek' } as never)
  expect(again.text).toBe('Claude eats some burek. The next drink lands 3 units softer.')
  const rakia = await $.command.run({ command: 'shot', args: 'rakia' } as never)
  expect(rakia.text).toBe('Claude downs a rakia. The meze takes the edge off: it counts 1 unit, not 4. Tab: 2 drinks, 2 units. Claude is now Tipsy.')
  const plain = await $.command.run({ command: 'shot', args: 'rakia' } as never)
  expect(plain.text).toBe('Claude downs a rakia. Tab: 3 drinks, 6 units. Claude is now Drunk.')
  expect((plain.context ?? [])[0]?.includes('The catch game')).toBe(true)
  expect((plain.context ?? [])[0]?.includes(SCORE_TOOL)).toBe(true)
  expect((beer.context ?? [])[0]?.includes('The catch game')).toBe(false)

  const card = await $.command.run({ command: 'snack', args: 'menu' } as never)
  expect(card.text?.includes('burek 3, cheese 2, ajvar 1')).toBe(true)
})

test('caught and missed mistakes go on the bill', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pair-drinking__${e.name}` } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('theme.clear', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'snack', args: 'burek' } as never)
  await $.command.run({ command: 'shot', args: 'absinthe' } as never)
  await $.command.run({ command: 'shot', args: 'rakia' } as never)
  const first = await $.tool.call({ tool: SCORE_TOOL, caught: true, mistake: 'Sofia is the capital of Serbia.', correction: 'Belgrade is.' } as never)
  expect(first.result).toBe('On the bill. The person has caught 1 of 1 tonight.')
  const second = await $.tool.call({ tool: SCORE_TOOL, caught: false, mistake: 'The Berlin Wall fell in 1991.', correction: 'It fell in 1989.' } as never)
  expect(second.result).toBe('On the bill. The person has caught 1 of 2 tonight.')
  const empty = await $.tool.call({ tool: SCORE_TOOL, caught: true, mistake: '', correction: '' } as never)
  expect(typeof empty.deny).toBe('string')

  const sober = await $.command.run({ command: 'sober' } as never)
  const text = sober.text ?? ''
  expect(text.includes('Drinks: 1 absinthe, 1 rakia.')).toBe(true)
  expect(text.includes('Meze: 1 burek.')).toBe(true)
  expect(text.includes('Peak: 6 units, Drunk.')).toBe(true)
  expect(text.includes('Hidden mistakes: 2. Score: you caught 1 of 2.')).toBe(true)
  expect(text.includes('1. Claude said: Sofia is the capital of Serbia. Correct: Belgrade is. (caught)')).toBe(true)
  expect(text.includes('2. Claude said: The Berlin Wall fell in 1991. Correct: It fell in 1989. (missed)')).toBe(true)
  expect((sober.context ?? [])[0]?.includes('best thing you said')).toBe(true)
})

test('the bill is empty for a night with nothing on it', async () => {
  expect(bill({ units: 0, drinks: 0 })).toBe(undefined)
  expect(bill({ units: 0, drinks: 0, snacks: { ajvar: 2 } })).toBe('The bill\nMeze: 2 ajvar.\nHidden mistakes: none.')
})

test('the mod sleeps until the bar is opened and /sober closes it', async ($, on) => {
  let looks = 0
  let clears = 0
  let tools = 0
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => {
    tools += 1
    return { value: { tool: `mcp__pair-drinking__${e.name}` } }
  })
  on('theme.set', () => {
    looks += 1
    return { value: { isDrawn: true, requestId: 'test' } }
  })
  on('theme.clear', () => {
    clears += 1
    return { value: { isDrawn: true, requestId: 'test' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks).toBe(0)
  expect(tools).toBe(0)
  expect(isOpenNow({ units: 0, drinks: 0 })).toBe(false)

  const closed = await $.tool.call({ tool: SCORE_TOOL, caught: true, mistake: 'A.', correction: 'B.' } as never)
  expect(typeof closed.deny).toBe('string')
  const card = await $.command.run({ command: 'shot', args: 'menu' } as never)
  expect(card.text?.includes('rakia 4')).toBe(true)
  expect(looks).toBe(0)

  await $.command.run({ command: 'snack', args: 'ajvar' } as never)
  expect(looks).toBe(1)
  expect(tools).toBe(1)
  const bar = await $.command.run({ command: 'bar' } as never)
  expect(bar.text?.startsWith('The bar is open. Drinks and their strength')).toBe(true)

  const sober = await $.command.run({ command: 'sober' } as never)
  expect(sober.text?.startsWith('Coffee served. The bar is closed and Claude is Sober.')).toBe(true)
  expect(clears).toBe(1)
  const again = await $.command.run({ command: 'sober' } as never)
  expect(again.text).toBe('The bar is not open in this session. /shot or /snack opens it.')
  expect(clears).toBe(1)
})

test('/bar opens the bar, and the hangover waits behind it', async ($, on) => {
  let looks = 0
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pair-drinking__${e.name}` } }))
  on('theme.set', () => {
    looks += 1
    return { value: { isDrawn: true, requestId: 'test' } }
  })
  on('theme.clear', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('session.id', () => ({ value: 'this-session' }))
  on('store.get', () => ({ value: { sessionId: 'last-session', units: 9, drinks: 3 } }))
  on('store.set', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(looks).toBe(0)
  const bar = await $.command.run({ command: 'bar' } as never)
  expect(bar.text?.includes('Claude has a hangover')).toBe(true)
  expect((bar.context ?? [])[0]?.includes('hangover')).toBe(true)
  expect(looks).toBe(1)
  const water = await $.command.run({ command: 'shot', args: 'water' } as never)
  expect(water.text?.endsWith('Claude is now still hungover.')).toBe(true)
  const cure = await $.command.run({ command: 'shot', args: 'beer' } as never)
  expect(cure.text?.startsWith('Claude downs a beer. Tab: 1 drink, 1 unit. Claude is now Tipsy.')).toBe(true)
})

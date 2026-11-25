import { expect, test } from 'claude-code/testing'

import type { Tab } from '../types'
import { CUT_OFF, DRINKS, KINDS, LEVEL_NAMES, barScene, levelOf, noteFor, parseScene, sceneName, wearOff } from './register'

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
  expect(wearOff(morning)).toEqual({ units: 0, drinks: 0 })
})

test('a shot adds its strength to the tab and tells Claude', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const first = await $.command.run({ command: 'shot', args: 'rakia' } as never)
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
  expect(sober.text).toBe('Coffee served. The bar is clean and Claude is Sober.')
})

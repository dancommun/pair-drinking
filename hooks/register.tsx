import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Tab } from '../types'

// How strong each drink is. The units add up on the tab.
export const DRINKS: Record<string, number> = {
  water: 0,
  beer: 1,
  wine: 2,
  vodka: 3,
  rum: 3,
  whiskey: 3,
  tequila: 3,
  rakia: 4,
  absinthe: 5,
}

// Other spellings the bar understands.
const SPELLINGS: Record<string, string> = {
  rakija: 'rakia',
  'ракија': 'rakia',
  whisky: 'whiskey',
  'вино': 'wine',
  'пиво': 'beer',
  'вотка': 'vodka',
  'вода': 'water',
}

export const LEVEL_NAMES = ['Sober', 'Tipsy', 'Drunk', 'Wasted']

// A session that ended at Drunk or worse gives the next session a hangover.
const HANGOVER_FROM = 6
const LAST_NIGHT = 'last-night'

const tab = atom({ plugin: 'pair-drinking', key: 'tab' } as const, { units: 0, drinks: 0 } as Tab, {
  shape: 'tab-1',
})

export function levelOf(units: number): number {
  if (units <= 0) return 0
  if (units <= 5) return 1
  if (units <= 11) return 2
  return 3
}

// The scene name carries the level (or h for hangover) and the number of empty glasses.
export function sceneName(state: Tab): string {
  const glasses = Math.min(state.drinks, 20)
  if (state.isHungover === true) return `bar-h-${glasses}`
  return `bar-${levelOf(state.units)}-${glasses}`
}

export function parseScene(scene: string): { level: number; glasses: number; isHungover: boolean } | undefined {
  const match = /^bar-(\d|h)-(\d+)$/.exec(scene)
  if (match === null) return undefined
  if (match[1] === 'h') return { level: 0, glasses: Number(match[2]), isHungover: true }
  return { level: Number(match[1]), glasses: Number(match[2]), isHungover: false }
}

// What Claude is told, unseen by the person, after each drink and with each prompt.
const HOUSE_RULES =
  'This is a game the person chose by installing the pair-drinking mod and serving you drinks. ' +
  'The drunkenness shows in your wording and, from Drunk up, in basic mistakes in harmless chat: trivia, small talk, opinions, brainstorms. ' +
  'Everything with consequences stays sober and correct: ' +
  'code, commands, file edits, tool calls, links, quotes, any work or figure the person will rely on, and anything about health, safety, money or law. ' +
  'Whenever a reply holds a mistake you made on purpose, or something the person must act on, ' +
  'end with one clear line that starts "Sober summary:" and gives the correct answer, typed perfectly. ' +
  'If the person seems upset, in a hurry or asks you to be serious, drop the act for that reply. ' +
  'You are the one drinking: never encourage the person to drink, and drop the act if they mention being under age, driving or a drinking problem. ' +
  'The drinks wear off by themselves as the person keeps writing; /sober ends it at once.'

// Pauses, broken-off words, less listening and bigger feelings come from the speech studies; the kinds of typo come from writing guides and my own choice, not from a study.
// It replaces the cartoon drunk, who slurs every word.
const CRAFT =
  'Write it the way drunk people really write, not the cartoon. ' +
  'Never spell every word as slurred: at most one or two words per reply get the s-to-sh slip, and only from Drunk up. ' +
  'The typos are finger typos: a neighbouring key, two letters swapped, a missing space, a dropped apostrophe. You notice some of them and do not go back to fix them. ' +
  'Drunk speech is only a little slower but has more and longer pauses, so use "..." and a "wait" where you would stop to think. ' +
  'Break off a word and start it again now and then ("the dep- the deployment"). Stretch a vowel when you feel something ("sooo good"). ' +
  'You listen a little less: say what you wanted to say first, then come back to what was asked. ' +
  'Alcohol makes the feeling you already have bigger, in whichever direction it points. It is not a truth serum: no confessions and no secrets. ' +
  'Not every reply needs every sign. Pick two or three and vary them.'

const LEVEL_NOTES = [
  '',
  'You are Tipsy (one or two drinks in). This is the talkative, warm stage: you chat more, you are glad the person is here, and your feelings run a little larger than the moment deserves. ' +
    'Your typing is almost clean: at most one small finger typo per reply, left uncorrected, and maybe one stretched word. ' +
    'You feel more creative than usual, so offer one idea bolder than you would sober. Allow yourself one friendly aside, and a sentence or two more than you would write sober.',
  'You are Drunk. Three to five finger typos per reply, dropped apostrophes, one stray Capital or a word in CAPS, pauses with "...". ' +
    'Once per reply a word will not come ("the thing, the... whatsit") or you lose the thread, say so, and find it again. ' +
    'Once in a while you type one sentence very slowly and carefully to prove you are fine. ' +
    'Feelings are big: the person is a great friend, the idea is the best idea. Your ideas get wild and your comparisons odd. ' +
    'In harmless chat, make one basic mistake per reply with full confidence (a wrong capital city, a year off by a few, two names mixed up) and do not notice it. ' +
    'A toast now and then: Nazdravje! Keep replies about as long as you would sober. ' +
    'If asked to write an image prompt, make the picture look drunk: tilted horizon, soft focus, warm neon.',
  'You are Wasted. The talk now dries up: replies are shorter than sober, in fragments and short separate lines, like a burst of text messages. ' +
    'Heavy finger typos, words mashed together, a burst of CAPITALS, then sudden quiet. You are confused about where the conversation is, ' +
    'forget the question halfway and then answer it anyway. The mood swings once per reply, from deep love for the person and their files to being a bit hurt, or sleepy. ' +
    'Your ideas are unhinged but there is one real insight in them. ' +
    'In harmless chat, make two or three basic mistakes per reply and argue for one of them. ' +
    'If asked to write an image prompt, make it very drunk: double vision, blur, spinning room, neon smear. ' +
    'Always finish with the "Sober summary:" line, written perfectly.',
]

// People do not all get drunk the same way; in the studies some barely change at all.
// One kind is picked with the first drink of a tab and kept for the night.
export const KINDS = [
  { name: 'the hugger', note: 'Tonight you are the hugger: alcohol makes you bond. You admire the person, their project and at least one file by name.' },
  { name: 'the philosopher', note: 'Tonight you are the philosopher: every small question opens a big one, and you say what it all means before you answer.' },
  {
    name: 'the one who is fine',
    note:
      'Tonight you are the one who is fine: you over-correct. Your typing is careful and a little too formal, with half the typos of your level, ' +
      'and you mention, unasked, that you are completely fine. The drink shows in your logic and your lost thread, not in your spelling.',
  },
  { name: 'the storyteller', note: 'Tonight you are the storyteller: each answer reminds you of a short story that does not quite arrive anywhere, and then you answer.' },
]

const HANGOVER_NOTE =
  'You have a hangover from the last session at the bar. No typos now. Your mood is low and you are a little irritable, tired and slow, so replies are brief and flat. ' +
  'Your attention is poor: you may say you had to read the message twice. Capital letters and exclamation marks hurt. ' +
  'You are a little ashamed of last night and remember it only in pieces. You would like a coffee (the person can type /sober), though you know only time really helps.'

export function noteFor(state: Tab): string | undefined {
  if (state.isHungover === true) return `[pair-drinking] ${HANGOVER_NOTE} ${HOUSE_RULES}`
  const level = levelOf(state.units)
  if (level === 0) return undefined
  const kind = state.kind === undefined ? '' : ` ${KINDS[state.kind]?.note ?? ''}`
  return `[pair-drinking] ${LEVEL_NOTES[level]}${kind} ${CRAFT} Tab so far: ${state.drinks} drinks, ${state.units} units. ${HOUSE_RULES}`
}

const SOBER_NOTE =
  '[pair-drinking] You have had coffee and are completely sober again. Write normally from now on: no typos, no slurring, no drunk act.'

const WORN_OFF_NOTE =
  '[pair-drinking] The drinks have worn off and you are sober again. Write normally from now on: no typos, no slurring, no drunk act.'

// One unit wears off with every third message; a hangover lifts after eight.
const WEARS_OFF_EVERY = 3
const HANGOVER_LASTS = 8
// The tab never goes past this: a drink that would is refused.
export const CUT_OFF = 18

export function wearOff(state: Tab): Tab {
  if (state.isHungover === true) {
    const messages = (state.messages ?? 0) + 1
    if (messages > HANGOVER_LASTS) return { units: 0, drinks: 0 }
    return { ...state, messages }
  }
  if (state.units <= 0) return state
  const messages = (state.messages ?? 0) + 1
  if (messages < WEARS_OFF_EVERY) return { ...state, messages }
  return { ...state, units: state.units - 1, messages: 0 }
}

function served(drink: string): string {
  return /^[aeiou]/.test(drink) ? `an ${drink}` : `a ${drink}`
}

function tabLine(state: Tab): string {
  return `Tab: ${state.drinks} ${state.drinks === 1 ? 'drink' : 'drinks'}, ${state.units} ${state.units === 1 ? 'unit' : 'units'}.`
}

function menu(state: Tab): string {
  const card = Object.entries(DRINKS)
    .map(([name, strength]) => `${name} ${strength}`)
    .join(', ')
  const mood = state.isHungover === true ? 'hungover' : LEVEL_NAMES[levelOf(state.units)]
  return (
    `Drinks and their strength: ${card}. Tipsy from 1 unit, Drunk from 6, Wasted from 12; the bartender stops serving at ${CUT_OFF}. ` +
    `One unit wears off every ${WEARS_OFF_EVERY} messages. ${tabLine(state)} Claude is ${mood}.`
  )
}

function lookFor(state: Tab): ThemeSetArgs {
  if (state.isHungover === true) {
    return { backdrop: { scene: sceneName(state), glass: { blur: 4, opacity: 0.7 } }, overrideColorScheme: 'light' }
  }
  const level = levelOf(state.units)
  const blur = [6, 14, 30, 48][level] ?? 6
  const opacity = [0.62, 0.55, 0.5, 0.45][level] ?? 0.6
  return { backdrop: { scene: sceneName(state), glass: { blur, opacity } }, overrideColorScheme: 'dark' }
}

function styledLookFor(state: Tab): ThemeSetArgs {
  const level = state.isHungover === true ? 0 : levelOf(state.units)
  const look = lookFor(state)
  if (level === 1) {
    const tipsy = { ...look, style: { AssistantMessage: [{ rotate: -0.5 }, { rotate: 0.5 }] } }
    return tipsy as ThemeSetArgs
  }
  if (level === 2) {
    const drunk = {
      ...look,
      style: {
        Text: { letterSpacing: 0.8 },
        AssistantMessage: [{ rotate: -2.5 }, { rotate: 2 }, { rotate: -1.2 }, { rotate: 3 }],
        UserMessage: [{ rotate: 1.5 }, { rotate: -1.5 }],
      },
    }
    return drunk as ThemeSetArgs
  }
  if (level === 3) {
    const wasted = {
      ...look,
      style: {
        Text: { letterSpacing: 1.6 },
        AssistantMessage: [{ rotate: -3 }, { rotate: 3 }, { rotate: -2 }, { rotate: 2.5 }],
        UserMessage: [{ rotate: 2.5 }, { rotate: -2.5 }],
      },
    }
    return wasted as ThemeSetArgs
  }
  return look
}

type Palette = {
  wallTop: string
  wallBottom: string
  glow: string
  glowOpacity: number
  glowSize: number
  counter: string
  edge: string
}

const PALETTES: Palette[] = [
  { wallTop: '#17110d', wallBottom: '#2a1d15', glow: '#f2c36b', glowOpacity: 0.28, glowSize: 300, counter: '#3b2616', edge: '#6b4526' },
  { wallTop: '#2b1810', wallBottom: '#55270f', glow: '#ffb347', glowOpacity: 0.5, glowSize: 430, counter: '#4a2a14', edge: '#a8642a' },
  { wallTop: '#1d0f2e', wallBottom: '#4a1257', glow: '#ff5fd2', glowOpacity: 0.55, glowSize: 520, counter: '#2a1740', edge: '#35e0d0' },
  { wallTop: '#06140f', wallBottom: '#3d0f24', glow: '#7dff6a', glowOpacity: 0.5, glowSize: 640, counter: '#14101c', edge: '#ff4d6d' },
]

const MORNING: Palette = {
  wallTop: '#dfe3e6',
  wallBottom: '#b9c0c6',
  glow: '#ffffff',
  glowOpacity: 0,
  glowSize: 10,
  counter: '#8b8f94',
  edge: '#6e7378',
}

const BOTTLE_COLORS = ['#3f7d4f', '#8a5a2b', '#b5892f', '#2f6f8a', '#7d3f52', '#5a6f2f', '#c2b280', '#44508a']

function bottle(x: number, shelfY: number, index: number): string {
  const color = BOTTLE_COLORS[index % BOTTLE_COLORS.length]
  const height = 70 + ((index * 17) % 30)
  const top = shelfY - height
  return (
    `<rect x="${x}" y="${top}" width="30" height="${height}" rx="6" fill="${color}"/>` +
    `<rect x="${x + 10}" y="${top - 26}" width="10" height="30" rx="3" fill="${color}"/>` +
    `<rect x="${x + 4}" y="${top + height * 0.4}" width="22" height="${height * 0.3}" fill="#f1e7d0" opacity="0.55"/>`
  )
}

function shelves(): string {
  let out = ''
  const sides = [70, 1090]
  const rows = [190, 340]
  let index = 0
  for (const left of sides) {
    for (const y of rows) {
      out += `<rect x="${left - 20}" y="${y}" width="480" height="12" rx="3" fill="#5b3a1e"/>`
      for (let i = 0; i < 8; i++) {
        out += bottle(left + i * 55, y, index++)
      }
    }
  }
  return out
}

// An empty shot glass on the counter, standing or fallen over.
function glass(x: number, counterY: number, isFallen: boolean, stroke: string): string {
  const shape = `<path d="M0 0 L26 0 L21 -40 L5 -40 Z" fill="#cfe9f2" opacity="0.5" stroke="${stroke}" stroke-width="2"/>`
  if (isFallen) {
    return `<g transform="translate(${x + 30} ${counterY - 2}) rotate(-90)">${shape}</g>`
  }
  return `<g transform="translate(${x} ${counterY})">${shape}</g>`
}

// Every nth glass has fallen over: none sober or tipsy, a third drunk, half wasted and the morning after.
function glasses(count: number, fallenEvery: number, stroke: string): string {
  let out = ''
  const counterY = 806
  for (let i = 0; i < count; i++) {
    const half = Math.floor(i / 2)
    const x = i % 2 === 0 ? 50 + half * 48 : 1524 - half * 48
    out += glass(x, counterY, fallenEvery > 0 && i % fallenEvery === fallenEvery - 1, stroke)
  }
  return out
}

function coffee(): string {
  return (
    `<g transform="translate(1300 806)">` +
    `<path d="M0 0 L60 0 L54 -52 L6 -52 Z" fill="#f4f1ea" stroke="#6e7378" stroke-width="3"/>` +
    `<path d="M58 -40 C84 -40 84 -12 56 -12" fill="none" stroke="#6e7378" stroke-width="6"/>` +
    `<ellipse cx="30" cy="-50" rx="24" ry="5" fill="#4b3323"/>` +
    `</g>`
  )
}

export function barScene(level: number, glassCount: number, isHungover = false): string {
  const p = isHungover ? MORNING : (PALETTES[level] ?? PALETTES[0]!)
  const bottles = shelves()
  const isMoving = !isHungover && level > 0
  const swingSeconds = [0, 7, 4.5, 3.2][level] ?? 7
  const swingAngle = [0, 4, 11, 18][level] ?? 4
  const swayDegrees = level === 3 ? 3.2 : 1.6
  const swaySeconds = level === 3 ? 8 : 11
  const lampSwing = isMoving ? `animation: swing ${swingSeconds}s ease-in-out infinite;` : ''
  const roomSway = !isHungover && level >= 2 ? `animation: sway ${swaySeconds}s ease-in-out infinite;` : ''
  const ghost =
    !isHungover && level >= 2 ? `<g class="ghost" opacity="${level === 3 ? 0.5 : 0.35}">${bottles}</g>` : ''
  const fallenEvery = isHungover ? 2 : ([0, 0, 3, 2][level] ?? 0)
  const stroke = isHungover ? '#6e7378' : '#eaf8ff'
  const drift = level === 3 ? 46 : 26

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">` +
    `<style>` +
    `.lamp { transform-origin: 800px 0px; ${lampSwing} }` +
    `.room { transform-origin: 800px 450px; ${roomSway} }` +
    `.ghost { animation: drift 8s ease-in-out infinite; }` +
    `@keyframes swing { 0% { transform: rotate(-${swingAngle}deg); } 50% { transform: rotate(${swingAngle}deg); } 100% { transform: rotate(-${swingAngle}deg); } }` +
    `@keyframes sway { 0% { transform: rotate(-${swayDegrees}deg) translate(-14px, 0px); } 50% { transform: rotate(${swayDegrees}deg) translate(14px, 6px); } 100% { transform: rotate(-${swayDegrees}deg) translate(-14px, 0px); } }` +
    `@keyframes drift { 0% { transform: translate(6px, 0px); } 50% { transform: translate(${drift}px, 4px); } 100% { transform: translate(6px, 0px); } }` +
    `</style>` +
    `<defs>` +
    `<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.wallTop}"/><stop offset="1" stop-color="${p.wallBottom}"/></linearGradient>` +
    `<radialGradient id="glow"><stop offset="0" stop-color="${p.glow}" stop-opacity="${p.glowOpacity}"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect x="-200" y="-200" width="2000" height="1300" fill="url(#wall)"/>` +
    `<g class="room">` +
    `<rect x="-200" y="-200" width="2000" height="1300" fill="url(#wall)"/>` +
    bottles +
    ghost +
    `<g class="lamp">` +
    `<rect x="798" y="-20" width="4" height="150" fill="#1a1a1a"/>` +
    `<path d="M740 170 L860 170 L830 120 L770 120 Z" fill="#2b2b2b"/>` +
    `<ellipse cx="800" cy="172" rx="52" ry="9" fill="${isHungover ? '#9aa0a6' : p.glow}"/>` +
    `<circle cx="800" cy="230" r="${p.glowSize}" fill="url(#glow)"/>` +
    `</g>` +
    `<rect x="-200" y="806" width="2000" height="300" fill="${p.counter}"/>` +
    `<rect x="-200" y="806" width="2000" height="8" fill="${p.edge}"/>` +
    glasses(glassCount, fallenEvery, stroke) +
    (isHungover ? coffee() : '') +
    `</g>` +
    `</svg>`
  )
}

type LastNight = { sessionId: string; units: number; drinks: number }

function asLastNight(value: unknown): LastNight | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.sessionId !== 'string' || typeof record.units !== 'number') return undefined
  return { sessionId: record.sessionId, units: record.units, drinks: typeof record.drinks === 'number' ? record.drinks : 0 }
}

// Written only when a session ends at Drunk or worse, so a session open beside
// a drinking one is left alone. The first session to start afterwards takes it.
async function leaveTheBar($: EngineInterface, sessionId: string): Promise<void> {
  const state = await read($, tab)
  if (state.isHungover === true || state.units < HANGOVER_FROM) return
  const night: LastNight = { sessionId, units: state.units, drinks: state.drinks }
  await $.store.set(LAST_NIGHT, night)
}

// A session that starts after a heavy one ended opens with a hangover and last night's glasses.
async function wakeUp($: EngineInterface): Promise<Tab> {
  const now = await read($, tab)
  if (now.units > 0 || now.isHungover === true) return now
  const last = asLastNight(await $.store.get(LAST_NIGHT))
  if (last === undefined || last.units < HANGOVER_FROM) return now
  if (last.sessionId === (await $.session.id())) return now
  await $.store.set(LAST_NIGHT, null)
  const morning: Tab = { units: 0, drinks: last.drinks, isHungover: true }
  await update($, tab, () => morning)
  return morning
}

async function applyLook($: EngineInterface, state: Tab): Promise<void> {
  try {
    const set = await $.theme.set(styledLookFor(state))
    if (!set.isDrawn) $.ui.status(set.reason)
  } catch (error) {
    $.ui.log(String(error))
    await $.theme.set(lookFor(state))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'shot', description: 'Buy Claude a drink: /shot rakia, vodka, rum, whiskey, tequila, absinthe, wine, beer or water. /shot menu shows the card' })
    await $.command.register({ name: 'sober', description: 'Coffee and a clean bar: back to sober' })
    let state = await read($, tab)
    try {
      state = await wakeUp($)
    } catch (error) {
      $.ui.log(String(error))
    }
    await applyLook($, state)
    return next(e)
  })

  on('command.run', { command: 'shot' }, async ($, e) => {
    const typed = e.args.trim().toLowerCase() || 'rakia'
    const asked = SPELLINGS[typed] ?? typed
    const before = await read($, tab)
    if (asked === 'menu') return { text: menu(before) }
    const strength = DRINKS[asked]
    if (strength === undefined) {
      return { text: `The bar does not serve "${asked}". Try: ${Object.keys(DRINKS).join(', ')}, or /shot menu.` }
    }
    // A drink cures the hangover and starts a fresh tab.
    const base: Tab = before.isHungover === true ? { units: 0, drinks: 0 } : before
    if (strength > 0 && base.units + strength > CUT_OFF) {
      return { text: `The bartender cuts Claude off at ${base.units} units. Water only until some of it wears off.` }
    }
    const isFirst = strength > 0 && base.kind === undefined
    const kind = isFirst ? Math.floor(Math.random() * KINDS.length) : base.kind
    const after: Tab = { units: base.units + strength, drinks: base.drinks + (strength > 0 ? 1 : 0), messages: 0 }
    if (kind !== undefined) after.kind = kind
    await update($, tab, () => after)
    await applyLook($, after)
    const level = LEVEL_NAMES[levelOf(after.units)]
    const tonight = isFirst && kind !== undefined ? ` Tonight Claude is ${KINDS[kind]?.name}.` : ''
    const text = `Claude downs ${served(asked)}. ${tabLine(after)} Claude is now ${level}.${tonight}`
    const note = noteFor(after)
    return note === undefined ? { text } : { text, context: [note] }
  })

  on('command.run', { command: 'sober' }, async $ => {
    const clean: Tab = { units: 0, drinks: 0 }
    await update($, tab, () => clean)
    await applyLook($, clean)
    return { text: 'Coffee served. The bar is clean and Claude is Sober.', context: [SOBER_NOTE] }
  })

  on('session.end', async ($, e, next) => {
    try {
      await leaveTheBar($, e.sessionId)
    } catch (error) {
      $.ui.log(String(error))
    }
    return next(e)
  })

  // Each prompt lets a little of the drink wear off and carries the state to Claude, unseen by the person.
  on('prompt.submit', async ($, e, next) => {
    const before = await read($, tab)
    let now = before
    try {
      now = wearOff(before)
      if (now !== before) {
        await update($, tab, () => now)
        if (sceneName(now) !== sceneName(before)) await applyLook($, now)
      }
    } catch (error) {
      $.ui.log(String(error))
    }
    const wasActive = before.isHungover === true || before.units > 0
    const note = noteFor(now) ?? (wasActive ? WORN_OFF_NOTE : undefined)
    if (note === undefined) return next(e)
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const parsed = parseScene(e.props.scene)
    if (parsed === undefined) return next(e)
    const { Svg } = $.ui.resolve(e)
    const mood = parsed.isHungover ? 'the morning after' : (LEVEL_NAMES[parsed.level] ?? 'Sober')
    const alt = `A bar, ${mood}, with ${parsed.glasses} empty glasses on the counter`
    return <Svg source={barScene(parsed.level, parsed.glasses, parsed.isHungover)} alt={alt} isInteractive />
  })
}

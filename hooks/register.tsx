import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Mistake, Tab } from '../types'

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

// Meze: how much each plate takes off the next drink.
export const SNACKS: Record<string, number> = {
  burek: 3,
  cheese: 2,
  ajvar: 1,
}

const SNACK_SPELLINGS: Record<string, string> = {
  'бурек': 'burek',
  'сирење': 'cheese',
  'ајвар': 'ajvar',
}

// Claude is full at this much; a drink makes room again.
export const FULL = 3

// The tool Claude calls to put a hidden mistake on the bill.
export const SCORE_TOOL = 'mcp__pair-drinking__score'

export const LEVEL_NAMES =['Sober', 'Tipsy', 'Drunk', 'Wasted']

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
  'Whenever a reply holds something the person must act on, ' +
  'end with one clear line that starts "Sober summary:" and gives it correctly, typed perfectly. ' +
  `If a mistake you hid earlier for the catch game is still open, settle it in this reply: correct it, typed perfectly, and record it with the tool ${SCORE_TOOL}. ` +
  'If the person seems upset, in a hurry or asks you to be serious, drop the act for that reply. ' +
  'You are the one drinking: never encourage the person to drink, and drop the act if they mention being under age, driving or a drinking problem. ' +
  'The drinks wear off by themselves as the person keeps writing; /sober ends it at once.'

// The catch game, from Drunk up. No mistake is ever left without a flag in the same reply.
const GAME =
  'The catch game, in harmless chat only: do not correct your deliberate mistake in the same reply. ' +
  'End that reply with one perfectly typed line that starts "Sober summary:" and says how many mistakes are hiding in it and asks the person to catch them, without saying which. ' +
  `If the next message from the person catches one, admit it gladly and call the tool ${SCORE_TOOL} with caught true. ` +
  'If the next message does not, open your reply with the correction, typed perfectly, and call the tool with caught false. ' +
  'Call the tool once per mistake. Never hide a new mistake while an old one is open, ' +
  'and never hide one in anything the person will rely on.'

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
    'In harmless chat, make two or three basic mistakes per reply and sound very sure of one of them. ' +
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
  const game = level >= 2 ? ` ${GAME} ${scoreLine(state)}` : ''
  return `[pair-drinking] ${LEVEL_NOTES[level]}${kind} ${CRAFT}${game} Tab so far: ${state.drinks} drinks, ${state.units} units. ${HOUSE_RULES}`
}

function scoreLine(state: Tab): string {
  const mistakes = state.mistakes ?? []
  const caught = mistakes.filter(one => one.isCaught).length
  return `Score so far: the person caught ${caught} of ${mistakes.length}.`
}

const SOBER_NOTE =
  '[pair-drinking] You have had coffee and are completely sober again. Write normally from now on: no typos, no slurring, no drunk act. ' +
  'If a mistake you hid is still open, correct it first and say it came too late for the bill; the bill is closed, so do not call the score tool for it. ' +
  'The person has just been shown the bill for the night.'

const BEST_LINE_NOTE = 'Then quote, in one line, the best thing you said while drinking, word for word from this conversation.'

const WORN_OFF_NOTE =
  '[pair-drinking] The drinks have worn off and you are sober again. Write normally from now on: no typos, no slurring, no drunk act. ' +
  `If a mistake you hid is still open, correct it now and record it with the tool ${SCORE_TOOL}. The person can type /sober to see the bill.`

function countList(counts: Record<string, number> | undefined): string {
  return Object.entries(counts ?? {})
    .map(([name, count]) => `${count} ${name}`)
    .join(', ')
}

// What the person is shown at /sober: the night in a few lines.
export function bill(state: Tab): string | undefined {
  const drinks = countList(state.order)
  const food = countList(state.snacks)
  const mistakes = state.mistakes ?? []
  if (drinks === '' && food === '' && mistakes.length === 0) return undefined
  const lines = ['The bill']
  if (drinks !== '') lines.push(`Drinks: ${drinks}.`)
  if (food !== '') lines.push(`Meze: ${food}.`)
  const peak = state.peak ?? state.units
  const kind = state.kind === undefined ? '' : ` Tonight Claude was ${KINDS[state.kind]?.name ?? 'itself'}.`
  if (peak > 0) lines.push(`Peak: ${peak} ${peak === 1 ? 'unit' : 'units'}, ${LEVEL_NAMES[levelOf(peak)]}.${kind}`)
  if (mistakes.length === 0) {
    lines.push('Hidden mistakes: none.')
  } else {
    const caught = mistakes.filter(one => one.isCaught).length
    lines.push(`Hidden mistakes: ${mistakes.length}. Score: you caught ${caught} of ${mistakes.length}.`)
    mistakes.forEach((one, index) => {
      lines.push(`${index + 1}. Claude said: ${one.mistake} Correct: ${one.correction} (${one.isCaught ? 'caught' : 'missed'})`)
    })
  }
  return lines.join('\n')
}

// One unit wears off with every third message; a hangover lifts after eight.
const WEARS_OFF_EVERY = 3
const HANGOVER_LASTS = 8
// The tab never goes past this: a drink that would is refused.
export const CUT_OFF = 18

export function wearOff(state: Tab): Tab {
  if (state.isHungover === true) {
    const messages = (state.messages ?? 0) + 1
    if (messages > HANGOVER_LASTS) return { units: 0, drinks: 0, isOpen: true }
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
    `One unit wears off every ${WEARS_OFF_EVERY} messages. Meze with /snack: ${Object.keys(SNACKS).join(', ')}. ${tabLine(state)} Claude is ${mood}.`
  )
}

function softer(lining: number): string {
  return `The next drink lands ${lining} ${lining === 1 ? 'unit' : 'units'} softer.`
}

function mezeCard(state: Tab): string {
  const card = Object.entries(SNACKS)
    .map(([name, filling]) => `${name} ${filling}`)
    .join(', ')
  const lining = state.lining ?? 0
  const now = lining > 0 ? ` ${softer(lining)}` : ''
  return `Meze and how many units each takes off the next drink: ${card}. A drink never counts less than 1 unit, and Claude is full at ${FULL}.${now}`
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

// Opening the bar with /bar after a heavy session shows the hangover and last night's glasses.
async function wakeUp($: EngineInterface): Promise<Tab> {
  const now = await read($, tab)
  if (now.units > 0 || now.isHungover === true) return now
  const last = asLastNight(await $.store.get(LAST_NIGHT))
  if (last === undefined || last.units < HANGOVER_FROM) return now
  if (last.sessionId === (await $.session.id())) return now
  await $.store.set(LAST_NIGHT, null)
  const morning: Tab = { units: 0, drinks: last.drinks, isHungover: true, isOpen: true }
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

// The mod sleeps until the bar is opened in this session. A tab from before this rule counts as open.
export function isOpenNow(state: Tab): boolean {
  return state.isOpen === true || state.units > 0 || state.isHungover === true
}

// Opening the bar gives Claude the score tool for the catch game.
async function openBar($: EngineInterface): Promise<void> {
  try {
    await $.tool.register({
      name: 'score',
      description:
        'Pair Drinking catch game. Call once for each mistake you hid on purpose while drunk, as soon as the person caught it or you owned up to it. It goes on the bill.',
      inputSchema: {
        type: 'object',
        properties: {
          caught: { type: 'boolean', description: 'true if the person caught the mistake, false if you had to own up' },
          mistake: { type: 'string', description: 'The wrong thing you said, in one short sentence' },
          correction: { type: 'string', description: 'The correct fact, in one short sentence' },
        },
        required: ['caught', 'mistake', 'correction'],
      },
      isDeferred: false,
    })
  } catch (error) {
    $.ui.log(String(error))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'shot', description: 'Buy Claude a drink: /shot rakia, vodka, rum, whiskey, tequila, absinthe, wine, beer or water. /shot menu shows the card' })
    await $.command.register({ name: 'sober', description: 'Coffee, the bill for the night and a clean bar: back to sober' })
    await $.command.register({ name: 'snack', description: 'Meze for Claude: /snack burek, cheese or ajvar. Food takes the edge off the next drink' })
    await $.command.register({ name: 'bar', description: 'Open the bar without a drink. After a heavy night this is where the hangover waits' })
    // Asleep unless the bar was already open in this session (a reload keeps the tab).
    const state = await read($, tab)
    if (isOpenNow(state)) {
      await openBar($)
      await applyLook($, state)
    }
    return next(e)
  })

  on('command.run', { command: 'shot' }, async ($, e) => {
    const typed = e.args.trim().toLowerCase() || 'rakia'
    const asked = SPELLINGS[typed] ?? typed
    const before = await read($, tab)
    if (asked === 'menu') return { text: menu(before) }
    const wasOpen = isOpenNow(before)
    const strength = DRINKS[asked]
    if (strength === undefined) {
      return { text: `The bar does not serve "${asked}". Try: ${Object.keys(DRINKS).join(', ')}, or /shot menu.` }
    }
    // A drink cures the hangover and starts a fresh tab.
    const base: Tab = before.isHungover === true && strength > 0 ? { units: 0, drinks: 0 } : before
    // Food eaten before the drink takes the edge off it, down to 1 unit at the least.
    const lining = base.lining ?? 0
    const counted = strength > 0 ? Math.max(1, strength - lining) : 0
    const softened = strength - counted
    if (strength > 0 && base.units + counted > CUT_OFF) {
      return { text: `The bartender cuts Claude off at ${base.units} units. Water only until some of it wears off.` }
    }
    const isFirst = strength > 0 && base.kind === undefined
    const kind = isFirst ? Math.floor(Math.random() * KINDS.length) : base.kind
    const units = base.units + counted
    const after: Tab = {
      ...base,
      units,
      drinks: base.drinks + (strength > 0 ? 1 : 0),
      messages: 0,
      isOpen: true,
      // A real drink uses the food up; water leaves it.
      lining: strength > 0 ? 0 : lining,
      order: { ...(base.order ?? {}), [asked]: (base.order?.[asked] ?? 0) + 1 },
      peak: Math.max(base.peak ?? 0, units),
    }
    if (kind !== undefined) after.kind = kind
    if (!wasOpen) await openBar($)
    // A drink is the cure: a hangover still waiting behind /bar is gone. Water cures nothing.
    if (strength > 0) {
      try {
        await $.store.set(LAST_NIGHT, null)
      } catch (error) {
        $.ui.log(String(error))
      }
    } else if (before.messages !== undefined) {
      after.messages = before.messages
    }
    await update($, tab, () => after)
    await applyLook($, after)
    const level = after.isHungover === true ? 'still hungover' : LEVEL_NAMES[levelOf(after.units)]
    const tonight = isFirst && kind !== undefined ? ` Tonight Claude is ${KINDS[kind]?.name}.` : ''
    const edge = softened > 0 ? ` The meze takes the edge off: it counts ${counted} ${counted === 1 ? 'unit' : 'units'}, not ${strength}.` : ''
    const text = `Claude downs ${served(asked)}.${edge} ${tabLine(after)} Claude is now ${level}.${tonight}`
    const note = noteFor(after)
    return note === undefined ? { text } : { text, context: [note] }
  })

  on('command.run', { command: 'snack' }, async ($, e) => {
    const typed = e.args.trim().toLowerCase() || 'burek'
    const asked = SNACK_SPELLINGS[typed] ?? typed
    const before = await read($, tab)
    if (asked === 'menu') return { text: mezeCard(before) }
    const filling = SNACKS[asked]
    if (filling === undefined) {
      return { text: `The kitchen does not make "${asked}". Try: ${Object.keys(SNACKS).join(', ')}, or /snack menu.` }
    }
    const snacks = { ...(before.snacks ?? {}), [asked]: (before.snacks?.[asked] ?? 0) + 1 }
    const thanks = `[pair-drinking] The person just served you some ${asked}. Thank them in one line, in the state you are in.`
    // On the morning after, food brings the end of the hangover closer.
    if (before.isHungover === true) {
      const morning: Tab = { ...before, snacks, isOpen: true, messages: (before.messages ?? 0) + filling }
      await update($, tab, () => morning)
      const sooner = `${filling} ${filling === 1 ? 'message' : 'messages'}`
      return { text: `Claude eats some ${asked}. The hangover will lift ${sooner} sooner.`, context: [thanks] }
    }
    const lining = before.lining ?? 0
    if (lining >= FULL) return { text: 'Claude is full. No more meze until a drink goes down.' }
    const after: Tab = { ...before, snacks, isOpen: true, lining: Math.min(FULL, lining + filling) }
    await update($, tab, () => after)
    if (!isOpenNow(before)) {
      await openBar($)
      await applyLook($, after)
    }
    return { text: `Claude eats some ${asked}. ${softer(after.lining ?? 0)}`, context: [thanks] }
  })

  // Claude reports a hidden mistake here, caught or owned up to, and it goes on the bill.
  on('tool.call', { tool: SCORE_TOOL }, async ($, e) => {
    const short = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, 200) : '')
    const entry: Mistake = { mistake: short(e.mistake), correction: short(e.correction), isCaught: e.caught === true }
    if (entry.mistake === '' || entry.correction === '') return { deny: 'Give the mistake and its correction, one short sentence each.' }
    const before = await read($, tab)
    // Nothing goes on a bill that is already closed, or onto the next night's.
    if (!isOpenNow(before) || before.isHungover === true || (before.peak ?? before.units) <= 0) {
      return { deny: 'The bill is closed. Just tell the person the correction.' }
    }
    const mistakes = [...(before.mistakes ?? []), entry].slice(-20)
    await update($, tab, () => ({ ...before, mistakes }))
    const caught = mistakes.filter(one => one.isCaught).length
    return { result: `On the bill. The person has caught ${caught} of ${mistakes.length} tonight.` }
  })

  on('command.run', { command: 'sober' }, async $ => {
    const before = await read($, tab)
    if (!isOpenNow(before)) return { text: 'The bar is not open in this session. /shot or /snack opens it.' }
    const night = bill(before)
    const clean: Tab = { units: 0, drinks: 0 }
    await update($, tab, () => clean)
    // Closing the bar takes the bar look off; the session looks as it did before the first drink.
    try {
      await $.theme.clear()
    } catch (error) {
      $.ui.log(String(error))
    }
    const coffee = 'Coffee served. The bar is closed and Claude is Sober.'
    if (night === undefined) return { text: coffee, context: [SOBER_NOTE] }
    const hadDrinks = (before.peak ?? before.units) > 0
    return { text: `${coffee}\n\n${night}`, context: [hadDrinks ? `${SOBER_NOTE} ${BEST_LINE_NOTE}` : SOBER_NOTE] }
  })

  on('command.run', { command: 'bar' }, async $ => {
    const before = await read($, tab)
    if (isOpenNow(before)) return { text: `The bar is open. ${menu(before)}` }
    await openBar($)
    let state: Tab = before
    try {
      state = await wakeUp($)
    } catch (error) {
      $.ui.log(String(error))
    }
    const open: Tab = { ...state, isOpen: true }
    await update($, tab, () => open)
    await applyLook($, open)
    if (open.isHungover === true) {
      const note = noteFor(open)
      const text = "The bar opens on the morning after: last night's glasses and a cup of coffee. Claude has a hangover. A drink, /sober or time cures it."
      return note === undefined ? { text } : { text, context: [note] }
    }
    return { text: 'The bar is open and Claude is Sober. /shot menu shows the card, /sober closes the bar.' }
  })

  on('session.end', async ($, e, next) => {
    try {
      await leaveTheBar($, e.sessionId)
    } catch (error) {
      $.ui.log(String(error))
    }
    return next(e)
  })

  // While the bar is closed the prompt passes untouched.
  // Each prompt lets a little of the drink wear off and carries the state to Claude, unseen by the person.
  on('prompt.submit', async ($, e, next) => {
    const before = await read($, tab)
    if (!isOpenNow(before)) return next(e)
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

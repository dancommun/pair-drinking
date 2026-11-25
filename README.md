# drunk-bar

Buy Claude a drink. A mod for Claude Code that puts a bar behind your chat and makes both the bar and Claude drunker with every `/shot`.

![The bar at Sober, Tipsy, Drunk, Wasted and the morning after](assets/levels.png)

Claude does the drinking. You only serve.

## Install

In a Claude Code terminal session, type:

```
/plugin install drunk-bar --marketplace dancommun/drunk-bar
```

Answer `y` to add the marketplace, then pick a scope.

The bar picture shows in the Claude desktop and mobile apps. In the terminal there is no picture, but the drinks and the drunk writing work the same.

## How to play

| You type | What happens |
|---|---|
| `/shot rakia` | Claude downs a rakia. The tab goes up and the bar changes. |
| `/shot` | Same as `/shot rakia`. It is a Balkan bar. |
| `/shot menu` | Shows the drinks, their strength and the tab. |
| `/sober` | Coffee. The bar is cleaned and Claude writes normally again. |

## The drinks

| Drink | Units |
|---|---|
| water | 0 |
| beer | 1 |
| wine | 2 |
| vodka, rum, whiskey, tequila | 3 |
| rakia | 4 |
| absinthe | 5 |

The bar also understands `rakija`, `ракија`, `whisky`, `вино`, `пиво`, `вотка` and `вода`.

## The levels

| Level | From | The bar | Claude |
|---|---|---|---|
| Sober | 0 units | Dim brown bar, still lamp | Writes as usual |
| Tipsy | 1 unit | Warm orange light, the lamp starts to swing | Chatty and warm, at most one typo, one bolder idea |
| Drunk | 6 units | Purple neon, the room sways, the bottles double, every third glass has fallen | Typos left uncorrected, pauses, a lost word, big feelings, one confident mistake in harmless chat |
| Wasted | 12 units | Green and red neon, stronger sway, every second glass has fallen | Short fragments like a burst of text messages, mood swings, two or three mistakes |

Three more rules of the bar:

- Drinks wear off. One unit goes with every third message you send. To keep Claude drunk you have to keep serving.
- The bartender cuts Claude off. A drink that would take the tab past 18 units is refused. Water is still served.
- The hangover. End a session at Drunk or worse and the next session opens on a grey morning bar with last night's glasses and a cup of coffee. Claude is quiet, slow and a little irritable for eight messages, or until `/sober` or the next drink.

## A drunk type per night

With the first drink of a tab the bar picks one of four types, and Claude keeps it for the night:

- The hugger admires you, your project and at least one of your files by name.
- The philosopher finds a big question inside every small one.
- The storyteller is reminded of a story that does not quite arrive anywhere.
- The one who is fine types very carefully and tells you, unasked, that it is completely fine.

## House rules

- Mistakes happen only in harmless chat: trivia, small talk, opinions, brainstorms.
- Code, commands, file edits, links, figures you will rely on, and anything about health, safety, money or law stay sober and correct at every level.
- A reply that holds a mistake made on purpose, or something you must act on, ends with a line that starts `Sober summary:` and gives the correct answer.
- If you are upset, in a hurry, or ask Claude to be serious, it drops the act for that reply.
- Claude never encourages you to drink, and drops the act if under-age drinking, driving or a drinking problem comes up.

## Why Claude does not slur every word

The drunk writing follows what studies of drunk speech and drunk texting report. The cartoon drunk who slurs every word is not in them.

- A study of 150 speakers recorded sober and drunk found speech only slightly slower, with more and longer pauses and more broken-off words: [Schiel and Heinrich, 2015](https://www.bas.uni-muenchen.de/forschung/publikationen/IJSLL_SchielHeinrich_2015.pdf). So Claude pauses and restarts a word. Slurring at most one or two words per reply is our own choice.
- A study of tweets written drunk and sober found spelling errors, capital letters and repeated letters among the signals that separate them: [Joshi and others, 2015](https://arxiv.org/pdf/1610.00879).
- Typing gets less accurate as blood alcohol rises: [University of Washington, 2018](https://ubicomplab.cs.washington.edu/pdfs/dui.pdf).
- People do not all get drunk the same way, and some over-correct. That is where "the one who is fine" comes from.

Which typos Claude makes (a neighbouring key, a dropped apostrophe, a stray capital) is our own choice. We found no study that names the kinds.

## For developers

The mod is one hooks module, `hooks/register.tsx`, with its tests beside it.

```
claude plugin validate .
```

```
claude plugin test .
```

Tested on Claude Code 2.1.327.

## Licence

MIT. See [LICENSE](LICENSE).

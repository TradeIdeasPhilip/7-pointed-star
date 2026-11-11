# Ordering Fourier terms

The author's tricks for ordering Fourier terms, from the hexagram videos, organized, and what each would take here.
Written 2026-11-10 from `random-svg-tests/src/fourier-smackdown.ts` and its git history.  Nothing built yet.

## The short version

Every trick is one of three kinds:

| Kind | What it needs here | Tricks |
| --- | --- | --- |
| **By rank** | Nothing.  Term Groups can say it today. | Small ones early, hold back three, forward and back, pauses |
| **By frequency** | Ranks worked out per circuit.  Today, `scripts/fourier-analysis.ts` can do that. | Forced symmetry, shared frequencies |
| **Several at once** | Several components, each with its own Term Groups.  Today, by hand. | Same circuit in different orders, shared frequencies, staggered starts, 8 variants |

Term Groups only names ranks:  0 is the biggest term.  The same frequency has a different rank in each circuit.
So a by-frequency trick has to be turned into ranks, separately for each circuit.

## Where the old code is

- `random-svg-tests/src/fourier-smackdown.ts`.  The hexagram:  6 points, 66 circuits after removing rotations (`ShapeMaker6.allPaths`).
- **✶N is circuit #N of those 66.**  The screen said "#N of 66" (`showIndex()`).  The videos went through the list in order, a few circuits at a time.
- **Each video's code is the commit that names it.**  `git log --format="%h %ad %s" -- src/fourier-smackdown.ts`, then `git show "<hash>:src/fourier-smackdown.ts"`.
  In zsh, keep the quotes:  without them, `$hash:src` reads `:s` as a zsh modifier.
- **The orderings are near the bottom, each under a `// MARK:`,** switched on and off with `if (true)` and `if (false)`.
  Each rewrites `terms`, in the order they're added, and `keyframes`, where each step ends.  Together those are what Term Groups says.
- **The earliest videos used `groupTerms()` in `fourier-shared.ts`,** the ancestor of the library's Term Groups.

## The tricks

### Biggest first

The default, then and now.  One term per step, or groups that grow:  `0, 1, 2, 3, 4, 5-9, 10-19, …`.

### Small ones early

`moveSmallOnesToTheFront()`.  By rank.

The big terms one at a time, except that all the small ones arrive together, early.
The corners turn sharp while the overall shape is still wrong, and then the big terms move the sharp pieces into place.
`which` says how early.  The version in the file today, as Term Groups:

- which 0:  `0, 1, 2, 25-1023, 3, 4, 5, 6 7, 8 9, 10-14, 15-19, 20-24`
- which 1:  `0, 1, 2, 3, 4, 25-1023, 5, 6 7, 8 9, 10-14, 15-19, 20-24`
- which 2:  `0, 1, 2, 3, 4, 5, 6 7, 25-1023, 8 9, 10-14, 15-19, 20-24`

First used for "Curves and corners".
The same circuit three times, with which 0, 1 and 2, made ✶33 to ✶36:  three copies that start and end together but get their detail at different times.

### Hold back three

`holdBackThree()`.  By rank, for 8 copies of one circuit.

Ranks 3, 4 and 5 are held back.  `which`, 0 to 7, is read as 3 bits:  each bit says whether that term comes near the start or at the very end.
So 8 copies pass through 8 different shapes and end at the same picture.
An empty group is a pause, while other copies add the term this one skips.

- which 0:  `2, , , , 0, 1, 6 7, 16-1023, 8 9, 10-12, 13-15, 3, 4, 5`
- which 5:  `2, 3, , 5, 0, 1, 6 7, 16-1023, 8 9, 10-12, 13-15, , 4, `
- which 7:  `2, 3, 4, 5, 0, 1, 6 7, 16-1023, 8 9, 10-12, 13-15, , , `

The editor warns about each empty group.  Here they're on purpose.
The ✶37 to ✶40 videos used an earlier version, then called `moveSmallOnesToTheFront()`, that held back ranks 5, 6 and 7.

**Here:**  `src/eight-pack.ts`, Scratch 4 in the Shorts (2026-11-10).  It holds back the first three groups, not ranks 3 to 5, and the colors show each copy's choices.
`philDebug.eightPack.setTermGroups()` writes all eight strings from the last copy's Term Groups.

**Pause with empty groups, not with Step.**  Scratch 3 kept circuits in step with complicated Step schedules.  That was a mistake (the author, 2026-11-10).
Give every copy the same number of groups, and the same plain Step from 0 to the end.  A copy that should wait while the others draw gets an empty group there.

### Forward and back

The `// MARK: Forward and back` block.  By rank.

The 6 biggest terms one at a time, but two of them wait:  ranks 0, 1, 3 and 4, then everything else at once, then 5, then 2.
The picture gets all its detail while two big terms are still missing, and the last two steps move big pieces into place.

- ✶64:  `0, 1, 3, 4, 6-1023, 5, 2`
- ✶54 and the next few:  `0, 1, 3, 4, 6-8, 9-11, 15-1023, 12-14, 5, 2`

The trick in every video from ✶54 to ✶65.

### Forced symmetry

`reorderForSymmetry(terms, n, direction)`.  By frequency.

First come the terms whose frequency is s plus or minus a multiple of n, where s is 1 or −1, biggest first.
On their own, those terms make a curve with n-fold rotational symmetry, so the first steps look like an n-fold pattern.
Then everything else, in rank order.

- **Its cutoff:**  matching terms smaller than 5% of the biggest matching term go to the back with the rest.
  `fourier-analysis.ts` uses a fixed 0.05 instead:  5% of the star's radius.
- **Its `direction` is −s:**  `reorderForSymmetry(terms, 4, -1)` keeps the frequencies that are 1 mod 4.
  In `fourier-analysis.ts` the same thing is `start`, which is s itself.
- **The comments at ✶30 to ✶32 record what was tried for each circuit,** like "3,-1.  better 4,+1 or 4,-1".  `npm run fourier-analysis` now does that search.
- **"Exploring symmetries with vibrant colors" ran circuit ✶24 three times,** 3-fold, 4-fold and 5-fold, side by side.
- **Before the function, there were hand-made lists:**  3-fold `-1, 2, 5, -4, 8, -7, 11, -10`, and 4-fold `-1, 3, 7, -5, 11, -9, 15, -13`.  Smallest |frequency| first.

### Shared frequencies

The `// MARK: Group multiple different ones` block.  By frequency, several at once.

Several different circuits start with the same frequencies, in the same order, at the same time.
They look related at first, then each goes its own way.

- **Version 1** (✶12 to ✶14):  add up each frequency's amplitude across the 3 circuits.  The top 10 come first, in that order, for all three.
  A circuit without that frequency gets a zero term, so it sits still for that step.  Then each circuit's own terms, one per step.
- **With symmetry** (✶15 to ✶21):  only the shared frequencies that also force symmetry, 4-fold in one video and 3-fold in the next two.
  All three circuits pass through n-fold shapes together.
- **Version 2,** "The null hypothesis" (✶47 to ✶51, five different circuits):  score each frequency by its 3rd smallest amplitude, among the circuits that have it.
  With 5 circuits that's the median, so a frequency only scores well if most of them have it.
  Keep at most 6, and only those above 5% of the best score.
  Then each circuit's own terms, with all the small ones as one group, placed at a different step for each circuit.
- **A trick left commented out:**  negate every frequency of one circuit.  That's the same circuit traced backwards,
  so a circuit that runs the other way can share frequencies with the rest.

### Several copies, staggered

Several at once.

- **✶52:**  5 copies of one circuit through the shared-frequency code.
  They're identical except where the small terms land:  1, 2, 3, 2 and 1 steps after the shared part, so the layout stays symmetric.
- **✶53, "Dark Rorschach":**  copy i also waits i steps at the start and 4 − i at the end.
  A canon:  the same animation, each copy a step behind the one before.
  In Term Groups, that's empty groups at the start, like `, , 0, 1, 2, …`.

## Videos

From the commit messages.  ✶N with no link means the commit names only the circuit.

| Commit | Date | Video | Circuits | Ordering |
| --- | --- | --- | --- | --- |
| ee1ec47 | 2025-07-28 | [Pentagram](https://www.youtube.com/watch?v=ykN3wYOBq40) | pentagrams | `groupTerms()` |
| 8ebc69c | 2025-08-09 | [Cgd5FBHE1_E](https://youtu.be/Cgd5FBHE1_E) |  | `groupTerms()`, first frequency spinners |
| e154461 | 2025-08-11 | [9oR8aUYE97w](https://youtu.be/9oR8aUYE97w) | ✶2 | `groupTerms()` |
| 8abe993 | 2025-08-12 | [1d280cIzJfA](https://youtu.be/1d280cIzJfA) | ✶3–5 | `groupTerms()`, first with 3 at once |
| b293948 | 2025-08-13 | [PS_eTjxRLRg](https://youtu.be/PS_eTjxRLRg) | ✶6–8 | `groupTerms()` |
| d0d9493 | 2025-08-14 | [PM40U_Ly-7Y](https://youtu.be/PM40U_Ly-7Y) |  | `groupTerms()` |
| 96c87d5 | 2025-08-16 | [ulXDPMuA9Ww](https://youtu.be/ulXDPMuA9Ww) | ✶12–14 | shared frequencies, version 1 |
| 22157ad | 2025-08-16 | [ICOMQ8y7Y4Y](https://youtu.be/ICOMQ8y7Y4Y) | ✶15–17 | shared, 4-fold (−1 mod 4) |
| 405f456 | 2025-08-17 | [iOYEg6xP9jg](https://youtu.be/iOYEg6xP9jg) | ✶18–20 | shared, 3-fold (−1 mod 3) |
| bc18072 | 2025-08-19 | [2xvAxZoyJgQ](https://youtu.be/2xvAxZoyJgQ) | ✶18, 19, 21 | shared, 3-fold (1 mod 3) |
| 63a333c | 2025-08-20 | [Curves and corners](https://youtu.be/URE5La20jyI) | ✶18, 19, 22 | small ones early, first circuit only |
| 2430471 | 2025-08-21 | [eQHoNBm_HPQ](https://youtu.be/eQHoNBm_HPQ) | ✶23 | small ones early |
| 9be041b | 2025-08-22 | [Exploring symmetries](https://youtu.be/HetS4wEkeYY) | ✶24 × 3 | forced symmetry:  3-, 4- and 5-fold |
| 5862768 | 2025-08-22 | [qmNP5XHIUwQ](https://youtu.be/qmNP5XHIUwQ) | ✶25 | biggest first, one per step |
| fdea849 | 2025-08-23 | [QvOc_qrxC9o](https://youtu.be/QvOc_qrxC9o) | ✶26–28 | small ones early (arguments 12, 10, 8) |
| a6666e8 | 2025-08-24 | [LmKHVbNRV0Q](https://youtu.be/LmKHVbNRV0Q) | ✶29 × 3 | small ones early (6, 6, 6) |
| 862fe79 | 2025-08-24 | ✶30–32 | ✶30–32 | forced symmetry for each, then small ones early |
| 2695849 | 2025-08-24 | ✶33 | ✶33 × 3 | small ones early, which 0, 1, 2 |
| 8177949 | 2025-08-25 | Laser light show, ✶34 | ✶34 × 3 | the same |
| 63db3c7, 3b2e4c4 | 2025-08-26, 27 | ✶35, ✶36 | × 3 | the same |
| fc5c4ee | 2025-08-29 | 8 versions, ✶37 | ✶37 × 8 | hold back three (ranks 5–7) |
| 0707534 | 2025-08-31 | ✶38, ✶39 | ✶39 × 7 | hold back three, which 1–7 |
| f0b3034 | 2025-08-31 | ✶40 | ✶40 | hold back three |
| 9b338e5 | 2025-09-01 | ✶41 | ✶41 × 5 | small ones early, which 0–4 |
| a208a9e | 2025-09-04 | The null hypothesis | ✶47–51 | shared frequencies, version 2 |
| 9c69201 | 2025-09-04 | ✶52 | ✶52 × 5 | shared code on 5 copies |
| fdd7372 | 2025-09-04 | Dark Rorschach, ✶53 | ✶53 × 5 | the same, plus staggered starts |
| 122e6fa | 2025-09-07 | Pan and Zoom, ✶54 | ✶54 × 5 | forward and back, 10 groups |
| eefa4d3 … 9bf779b | 2025-09-08 … 16 | ✶55–63 |  | forward and back |
| 9375055 | 2025-09-20 | [CGA, ✶65](https://youtu.be/vcTsA1oHbl0) | ✶65 | forward and back |
| d57b260 | 2025-09-20 | [CGA perfected, ✶64](https://youtu.be/rPeXg-yBeTs) | ✶64 × 2 | forward and back, 7 groups |

## What this means here

### Possible today, with no code

- **Every by-rank trick:**  type the strings above into Term Groups.  The ranks mean the same thing in our circuits.
- **Several copies:**  copy a Star Circuit and change its Term Groups.
- **A canon:**  start each copy's Term Groups with empty groups.  Better than shifting its Step keyframes (see Hold back three).

### Next, in `scripts/fourier-analysis.ts`

- **Print Term Groups strings.**  For each symmetry, the ranks of the matching big terms, as a string ready to paste.  That makes forced symmetry usable today.
- **Shared frequencies for a set of circuits.**  Score each frequency across the set, and print one Term Groups string per circuit:  the same frequencies, each at that circuit's own ranks.
  Try both old scores:  the plain total, and the 3rd smallest.
- **Try each circuit backwards too.**  It's the same loop with every frequency negated, and the Circuit field takes the vertices in reverse order.

### Later

- **Frequencies in Term Groups.**  A way to name a term by its frequency, like `f-6`.
  Then one string means the same thing for every circuit, and keeps working when the circuit changes.
  Star Circuit could turn frequencies into ranks before calling the library's parser, so trying it needs no library change.
- **A parent that coordinates.**  One component that works out the shared frequencies for its Star Circuit children.  Not needed until doing it by hand gets tedious.
- **Frequency spinners.**  The old videos showed each step's new terms as small spinning circles (`FrequencySpinners`, `MotionBlurSpinner`).  A display idea.

### For the database

See `enumerate-all-circuits.md`.
The amplitude at each frequency doesn't change with the starting vertex, or with rotating the star:  those only change the phases.
Tracing a loop backwards, or taking its mirror image, moves each amplitude from frequency f to −f, apart from tiny differences in sampling.
So one table per loop covers both directions.  When looking for shared frequencies, compare each circuit forwards and backwards.

# Warped Path

I upgraded to library 0.8.3, built the Warped Path prototype, and put a test scene for it in the landscape video. Nothing is committed. `tsc` and the production build are clean.

## Warped Path

The new component is [warped-path.ts](src/warped-path.ts), registered as "Warped Path" in both videos (imported from [setup.ts](src/setup.ts)).

- **Pipeline:**
  - It parses the path string, then samples it with the library's `samplesFromPath()`, so every corner is a sample.
  - Each sample goes through `polarWarp()`, and the moved samples become a closed PathShape of straight lines, which is stroked.
  - To try another function, override `makeWarp()`.
- **The transform:** radius becomes `Math.max(0, r − offset)`, and the angle gets the angle added, unclamped. At offset 0 and angle 0 it returns the point itself, so the finished frame is exactly the path.
- **Fields:**
  - Path, Radius Offset (default 1 → 0), Angle in degrees, Samples (1024), Dest Rect, Color and Line Width.
  - **Source Rect (not in your spec):** it's the part of the path's own coordinates that fits in Dest Rect, the unit circle's square by default. I added it because the three shapes have different bounds, and they would not have lined up without it.
- **Warnings:** a bad path is an error in Checks. An open path or several pieces is a warning, because the gaps are joined with straight lines, as in the Fourier component. I tested garbage, empty, open, two pieces and relative commands. Nothing throws or opens a dialog.
- **Test scene:** "Warped Paths" is now scene 9 in [full-video.ts](src/full-video.ts), and Scratch is 10. It has three replaceable children: the red circle from your arc string, and the blue and white stars from `makePolygon()` as strings. They start at 1 s, 2.5 s and 4 s and each take 7 s. The stars unwind 180° and −180° as they grow, and the scene is 14 s. It ends as the finished Star Circuit.
- **Circle dot:** before the circle starts, a tiny red dot shows. The arc's cubics are 0.03% outside the unit circle, so a little radius is left. The stars show nothing there.
- **Not tested:** how it looks at 60 fps in the real player. I only checked still frames.

## The upgrade

I compared 250 frames from every chapter of both videos, built on 0.8.1 and on 0.8.3. 247 are byte-identical. The three that differ are Warped Paths at 0.3, 4 and 10 s. On 0.8.1 the circle's arc path draws nothing, so the arc test passes.

- **Error message, in this project:**
  - **Problem:** in the portrait video the text came out small and off to the left. 0.8.3's `showError()` lays text out at the canvas width, but four components still scaled it as if the canvas were 16 wide. Landscape was unaffected.
  - **Fix:**
    - Star Circuit and Tessellating Triangles now scale by `rect.width / canvasRecorder.width`.
    - Night Sky and Freaky Dots no longer scale.
  - **Verified:** all four show centered, full-width text in portrait. The three besides Star Circuit were checked in a throwaway copy with forced errors, not your files. The rule is in CLAUDE.md.

## What's left for you to test

My frames used the TypeScript defaults. Your real work is in the editor's saved state, which I didn't load.

1. **Text in your saved scenes.** All font glyphs go through the rewritten path parser. The cursive default text is identical, but I didn't render Multi Text in other fonts. Check anything text-based you've tuned by hand, especially Scratch 13's Multi Text lined up with the Bridged Fourier.
2. **Error messages in the Shorts.** Give a Star Circuit a bad circuit. Library components that show errors and aren't ours aren't covered.
3. **Any path strings you've pasted** into a Fourier or Bridged Path source. The parser now follows the SVG spec exactly. `1.2.3` is read as two numbers, so some malformed strings that used to load silently are now errors, and your saved ones may show a Checks error.

The rest of 0.8.2 and 0.8.3 is the halftone aspect-ratio fix and a quieter service-worker log, neither of which this project uses.

## Also changed

- **Docs and memory:** CLAUDE.md has the scene, the component and the error rule. I saved your frame-centers fact to memory: the recorder samples each frame at the middle of its time slice.
- **Unrelated diffs:** `properties/7-pointed-star-ts-defaults.json` and the Shorts properties changed on their own, from your dev server's editor. I left them alone.
- **Prettier:** it's clean on every file I touched.

# Twisted Paths

Yes, that was enough to build from. There's a new "Twisted Paths" scene, number 10 in the landscape video, and a new Twisted Path component in [twisted-path.ts](src/twisted-path.ts). It's a subclass of Warped Path, so your Scratch 15 example isn't affected. I re-rendered the Warped Paths frames and all 9 are identical to before. The only edit to the first version's file is a type-only change so a subclass can have its own registry key. Nothing is committed.

## What it does

For each point, in order:

1. Pull it toward the origin by Radius Offset, as before. Call the new distance `r`.
2. Turn it by Angle, as before. Every point turns the same amount.
3. Turn it by **Twist × (1 − r / Effect Radius) ^ Falloff Power**. The center gets all of Twist, and points at Effect Radius or beyond get none.

The new fields are Twist (degrees), Effect Radius and Falloff Power, which sit next to Angle. With Power 1 the falloff is linear, as you described.

## Your open questions

- **Which end leads?** Your two pictures are the same effect plus one rigid turn of the whole drawing. "The rim leads, the inside lags" is Angle = A with Twist = −A. A point halfway out then turns A/2. "The center leads" is Twist alone. So I didn't need two modes, and the demo shows one of each. The fat star uses the center-leads form and the thin star uses the rim-leads form.
- **How do we know the extremes?** I made Effect Radius an explicit number in the path's units, 1 by default. Source Rect is only the window, and it can show more or less than the path. Checks gives a note saying how far the path actually reaches, to help you pick a value.
- **Straightening it out:** both of your options work.
  - Twist → 0 is the exact identity, all at once.
  - Effect Radius → 0 pulls the swirl into the center. I haven't rendered that one.
- **What `r` means:** the twist uses the distance after the offset. The swirl is a field fixed on the screen, and the shrinking path moves through it. It's a one-line change if you'd rather tie it to the original radius.

## What the frames show

- The stars curl into spirals while growing, then unwind, and the last frame is the finished Star Circuit.
- The circle never changes, since every point on it is the same distance out. That's expected.
- **Linear vs Power 2** (compared on a throwaway copy):
  - Linear gives S-curves across the whole star. I like it for "curves everywhere", and the creases at Effect Radius are milder than I expected.
  - Power 2 leaves the outer edges straighter, with a tighter curl near the center.
- **Samples:** a swirl shows facets in the polyline at 1024 samples, so the demo uses 4096. At a very small Effect Radius only a few samples would land in the swirl and it would look jagged. A real fix would be adaptive sampling, like the glitch-free path.

## Ideas for what's next

- A Falloff shape other than a power, like smoothstep.
- The twist center somewhere other than the origin.
- Twist depending on the original radius.

Which of these interests you?

I also added the component to CLAUDE.md. I noticed a `philip-needs-to-investigate.md` file that I didn't create, and I left it alone.

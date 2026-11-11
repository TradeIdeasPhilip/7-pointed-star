Written for: you, coming back to this later, and future sessions.

Yes, the old code made sense, and I've organized it in [term-ordering.md](development-plans/term-ordering.md). For each trick it has what it does, the function that does it, the commits, and a table of 31 commits matched to their videos. The ✶ numbers are circuit numbers: the screen said "#N of 66", and you worked through the hexagram's 66 circuits in order.

**Every trick is one of three kinds:**
- **By rank: you can use these today.** "Small ones early", "hold back three" and "forward and back" are all just orders of ranks. I ran the old functions and turned their output into Term Groups strings you can paste. For example, ✶64's forward and back is `0, 1, 3, 4, 6-1023, 5, 2`.
- **By frequency: these need ranks worked out per circuit.** Forced symmetry (`reorderForSymmetry()`) and shared frequencies across circuits. The same frequency has a different rank in each circuit, so the next step is to have `fourier-analysis.ts` print a ready-to-paste Term Groups string for each circuit.
- **Several at once:** the same circuit in different orders, staggered starts, and the 8 variants of one circuit. These need several components; today that means doing it by hand.

**Old videos worth looking at:**
- **[Exploring symmetries](https://youtu.be/HetS4wEkeYY):** circuit ✶24 three times, ordered for 3-fold, 4-fold and 5-fold symmetry. That's the side-by-side idea you described.
- **The common-frequency trick had two versions:**
  - [ulXDPMuA9Ww](https://youtu.be/ulXDPMuA9Ww) scored each frequency by its total amplitude across the circuits.
  - "The null hypothesis" (✶47–51) scored it by the 3rd smallest amplitude, so a frequency only counted if most of the circuits had it.
- **[ICOMQ8y7Y4Y](https://youtu.be/ICOMQ8y7Y4Y) combined the two ideas:** frequencies the circuits share and that also force 4-fold symmetry.
- **"Dark Rorschach" (✶53) staggered the starts:** five copies of one circuit, each a step behind the one before. In Term Groups that's empty groups at the start.

**One idea for the database.** You left a trick commented out: negate every frequency of one circuit. That's the same circuit traced backwards. A mirror image changes the amplitudes the same way, while the starting vertex and rotating the star only change phases. So one table of amplitudes per loop covers both directions, and a search for shared frequencies should compare each circuit forwards and backwards.

**Downloading your YouTube data:** the playlist page builds its list with JavaScript, so I only got its title. Two ways to get everything:
- **yt-dlp:** this is what I'd use. It gets each video's title, description, upload date and transcript (including YouTube's automatic captions) without downloading the videos. Install it with `brew install yt-dlp`, then:
  ```
  yt-dlp --skip-download --write-info-json --write-description \
    --write-auto-subs --write-subs --sub-langs "en.*" --sleep-requests 1 \
    -o "%(playlist_index)03d %(title)s [%(id)s].%(ext)s" \
    -P ~/Documents/youtube-metadata/fourier-tidbits \
    "https://www.youtube.com/playlist?list=PLJNSFdg--j7frNYLnOyVen1Rb7SjHRd3C"
  ```
  For the whole channel, use `https://www.youtube.com/@<your handle>/videos` instead. It only sees public videos, plus unlisted ones that are in a public playlist. Add `--cookies-from-browser chrome` to see the rest.
- **[Google Takeout](https://takeoutday.org/guides/how-to-export-youtube-data):** this gets your original uploads with their titles and descriptions. It includes caption files you uploaded, but apparently not YouTube's automatic transcripts. The export is huge because it includes the video files.

I haven't installed anything. If you install yt-dlp, or tell me to, I can download this playlist's metadata and match each video to its commit. With the transcripts, I could add what you said about each technique to the document.

I also added the document to CLAUDE.md's list, and saved your "a good one, even if it's easy" preference to my notes. Nothing is committed.

Sources:
- [How to export YouTube data (takeoutday.org)](https://takeoutday.org/guides/how-to-export-youtube-data)
- [YouTube and YouTube Music schema reference (Google)](https://developers.google.com/data-portability/schema-reference/youtube)
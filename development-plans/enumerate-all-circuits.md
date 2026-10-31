# Enumerate all circuits

Compute the Fourier decomposition of every one of the 4,642,014 circuits, and store the results somewhere easy to search.
A tool for writing the video's script, never used while rendering.
Not started.  Copied from the discussion on 2026-10-30.

Yes, we can process all 4,642,014. I timed the real pipeline (our path code plus the library's own sampling and FFT) on 3,000 circuits: 1.8 ms each. The library's FFT is 1.5 ms of that.

- **One core:** about 2.3 hours.
- **All 8 cores of this Mac:** about 20 minutes.
- **With a faster FFT:** a few minutes. I'd write one and check it against the library's on a sample, to confirm it gives the same terms in the same order.

Either way it's a one-time job.

## What to store for each circuit

- **The circuit itself,** plus each vertex's pairing number, so you can still ask for "shows every kind of vertex".
- **The top 20 or so terms,** each a frequency and an amplitude.
  - Every circuit is drawn at the same size, so amplitudes compare directly across circuits.
  - I'd skip phases. Any single circuit can be recomputed in 2 ms when you want to see it.
- **A few ready-made columns** for your usual questions:
  - The first term's |frequency|.
  - A signature like `1,7,2,6`: the top few frequencies in order, so circuits with the same start group together.
  - The amplitude at each low frequency, for "frequency 7 is strong enough in every example".

## Where to store it

- **Spreadsheet: no, except for extracts.** Excel stops at about 1 million rows and Google Sheets at 10 million cells. Fine for a summary or a page of query results.
- **SQLite: the zero-install option.** It's built into macOS, and Node 26 can write it directly.
  - A file of roughly 1–2 GB.
  - You can browse it with DB Browser for SQLite, TablePlus, or a VS Code extension.
  - Grouping and counting all 4.6M rows takes seconds.
- **DuckDB: my pick for poking around.** It's built for exactly this: grouping, counting and filtering millions of rows, usually in well under a second.
  - It stores the top terms as a list, so "frequency 7 is in the top 5" is one short expression.
  - `duckdb -ui` opens a notebook in your browser.
  - It needs `brew install duckdb`, and it can read a SQLite file directly. So writing SQLite first loses nothing.

## The piece that makes it useful

Queries give you rows of numbers, but you'll want to see the pictures. The cheap fix is a **Circuits** text field on the Circuit Grid. Paste in circuits from a query, and they animate with their reference images in the editor. A real explorer page can wait until we know which questions matter.

Update, later the same day:  Star Circuit's Circuit field now takes a pasted list of vertices, so a query result can go straight into one.

## Things the existing counts already tell us

- **Exactly 6 circuits look the same after a 1/7 turn.** Our Interleaved circuit is one. Their decompositions should use only every 7th frequency, which should look striking on screen.
  - This falls out of the counts: 9,284,028 × 7 is 36 more than 64,988,160, so 6 circuits are their own rotations.
- **No circuit is its own mirror image.** That's why removing mirror images halves 9,284,028 exactly.

The 3,000 circuits I timed also give a first peek at the first term's |frequency|. 1 is most common, then 7 and 2, but every value from 1 to 9 shows up. Those 3,000 come from one corner of the search, so treat that as a hint, not a result.

## Suggested first step

A script that writes SQLite using all 8 cores, plus a way to paste circuits into a component. Install DuckDB only if SQLite feels slow.

## Notes for whoever builds it

- Node won't strip types from TypeScript in `node_modules`, so a script that uses the library's `samplesFromPath()` has to be bundled first.
  `node_modules/.bin/rolldown script.ts --platform node --format esm -o script.mjs` works.
- Import the library by package name (`canvas-recorder-lib/src/...`), not by file path, or the bundle gets two copies of `PathShape` and `instanceof` fails.
- The library runs self-tests at load time that need `DOMMatrix`, which Node doesn't have.  A small 2D stand-in, set on `globalThis` before the library loads, is enough.
- `tsc` checks `scripts/`, and there's no `@types/node`, so `node:sqlite` and `process` won't type check there without adding it.

## Reading

- [The DuckDB Local UI](https://duckdb.org/2025/03/12/duckdb-ui) (DuckDB blog, March 2025):  a short introduction to DuckDB's browser notebook.
- [Why DuckDB](https://duckdb.org/why_duckdb):  what DuckDB is for.

/**
 * Everything the videos set up when they load:  components, Fourier sources and console commands.
 * Like `main.C` in a C++ project, the one place that wires the project together.
 *
 * Each file registers itself when it's imported, so this file is only imports.
 * Both videos import it, so the Visual Editor can insert or paste any component into either one,
 * the Source fields offer every path, and the console commands work in both.
 * Add each new component, source or console command here.
 * @module
 */

// MARK: Components

import "./bridged-fourier.ts";
import "./bridged-path.ts";
import "./circuit-grid.ts";
import "./colorful-star.ts";
import "./freaky-dots.ts";
import "./night-sky.ts";
import "./rounded-star.ts";
import "./star-circuit.ts";
import "./tessellating-triangles.ts";
import "./vertex-pairings.ts";
import "./warped-path.ts";

// MARK: Fourier sources

// Read by each FourierComponent and Bridged Path when it's made, so they're registered when the videos load.
import "./star-sources.ts";
import "./svg-sources.ts";

// MARK: Console commands

// philDebug.*, for whatever is chosen in the Edit list, in either video.
import "./delayed-start-each.ts";
import "./eight-pack.ts";
import "./four-plus-four.ts";
import "./temp-console.ts";

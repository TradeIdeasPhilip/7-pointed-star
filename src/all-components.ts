/**
 * Every custom component in this project, plus the Fourier component's sources.
 *
 * Each video imports this, so the Visual Editor can insert or paste any of them into any video.
 * Importing a component's file is what registers it.
 * @module
 */

import "./circuit-grid.ts";
import "./colorful-star.ts";
import "./freaky-dots.ts";
import "./night-sky.ts";
import "./rounded-star.ts";
import "./star-circuit.ts";
import "./star-sources.ts";
import "./tessellating-triangles.ts";
import "./vertex-pairings.ts";

// Not component, but console commands, philDebug.*, work with any video.
import "./eight-pack.ts";
import "./four-plus-four.ts"
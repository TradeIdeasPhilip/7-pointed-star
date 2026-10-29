import { FourierComponent } from "canvas-recorder-lib/src/slide-components/fourier";
import {
  EVERY_KIND_A_7,
  EVERY_KIND_B_7,
  GROUPED_7,
  INTERLEAVED_7,
} from "./euler-circuits.ts";
import { circuitToPath } from "./star-path.ts";

/**
 * The 7 pointed stars offered by the Fourier component's Source field.
 *
 * Import this before constructing any FourierComponent:  the Source field reads
 * its choices when a component is created.  Registering is cheap.  Nothing is
 * computed until a component draws one.
 * @module
 */

/** The circle, then the fat star, then the thin star. */
export const GROUPED_SOURCE = "7-Star: grouped";
/** Steps of 1, 2, 3, repeated 7 times. */
export const INTERLEAVED_SOURCE = "7-Star: interleaved";

FourierComponent.sources.set(GROUPED_SOURCE, {
  path: circuitToPath(7, GROUPED_7).pathShape,
});
FourierComponent.sources.set(INTERLEAVED_SOURCE, {
  path: circuitToPath(7, INTERLEAVED_7).pathShape,
});
// Between them, these two show every kind of vertex.
FourierComponent.sources.set("7-Star: every kind A", {
  path: circuitToPath(7, EVERY_KIND_A_7).pathShape,
});
FourierComponent.sources.set("7-Star: every kind B", {
  path: circuitToPath(7, EVERY_KIND_B_7).pathShape,
});

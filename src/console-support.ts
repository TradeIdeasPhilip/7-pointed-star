import { Showable } from "canvas-recorder-lib";
import { philDebug } from "canvas-recorder-lib/src/utility";

/**
 * The Visual Editor's root:  what's chosen in the Edit list.
 * @throws If the Visual Editor isn't open.
 */
export function root(): Showable {
  const result: Showable | undefined = philDebug.VisualEditor?.rootComponent;
  if (!result) {
    throw new Error("Open the Visual Editor first.");
  }
  return result;
}


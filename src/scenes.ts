import {
  canvasRecorder,
  DurationAgnosticComponent,
  InSeriesComponent,
  RectangleComponent,
  Showable,
} from "canvas-recorder-lib";

/**
 * Give a replaceable child a name that lasts.
 * The editor rebuilds replaceable children from the registry when it loads saved state,
 * so a `description` given to the constructor is lost.  This name is saved with the rest.
 */
export function named<T extends Showable>(name: string, component: T): T {
  component.userEditableDescription = name;
  return component;
}

/**
 * A new scene with a black background, added to the end of the video.
 * The background fills the canvas, so set `canvasRecorder.size` before calling this.
 *
 * The scenes are fixed children, so the Visual Editor saves their contents by description.
 * Each scene has its own background, so each one can stand alone.
 * @param minDuration How long the scene lasts, unless something in it asks for longer.
 */
export function addScene(
  root: InSeriesComponent,
  description: string,
  minDuration = 0,
) {
  const scene = new DurationAgnosticComponent(description);
  scene.minDurationScalar.value = minDuration;
  scene.replaceableComponents!.push(
    named(
      "Background",
      new RectangleComponent({
        color: "black",
        rect: {
          x: 0,
          y: 0,
          width: canvasRecorder.width,
          height: canvasRecorder.height,
        },
      }),
    ),
  );
  root.add(scene);
  return scene;
}

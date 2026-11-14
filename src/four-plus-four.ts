/**
 * Scripts for Scratch 5 in the Shorts:  four Star Circuits, maybe on a Night Sky.
 *
 * `addFourPlusFourPanel()` gives that scene buttons for the commands below.
 * On the console, choose a scene with four in the Edit list, then:
 * * `philDebug.fourPlusFour.find()`:  the four.
 * * `philDebug.fourPlusFour.setEndTime()`:  each one's last Step keyframe, and a two-keyframe Night Sky's Bottom Color, to the end of the scene.
 * * `philDebug.fourPlusFour.showIntro()`:  round the corners first, then start every Step at 15 s.
 * @module
 */

import { Showable } from "canvas-recorder-lib";
import { philDebug } from "canvas-recorder-lib/src/utility";
import { root, saveOutsideChanges } from "./console-support";
import { NightSky } from "./night-sky";
import { addScriptPanel } from "./script-panel";
import { StarCircuit } from "./star-circuit";

// MARK: Commands

/**
 * A scene's four Star Circuits, in order.
 * @param scene What's chosen in the Edit list, by default, for the console.
 * @throws Unless the scene has exactly 4 Star Circuits.
 */
function find(
  scene?: Showable,
): [StarCircuit, StarCircuit, StarCircuit, StarCircuit] {
  const chosen = scene ?? root();
  const result = (chosen.replaceableComponents?.get() ?? []).filter(
    (child) => child instanceof StarCircuit,
  );
  if (result.length != 4) {
    throw new Error(
      `"${chosen.userEditableDescription ?? chosen.description}" has ${result.length} Star Circuits, not 4.` +
        (scene ? "" : "  Choose the scene with the four in the Edit list."),
    );
  }
  return result as [StarCircuit, StarCircuit, StarCircuit, StarCircuit];
}

/**
 * Move each Star Circuit's last Step keyframe, and a two-keyframe Night Sky's Bottom Color, to the end of the scene.
 * @returns The end of the scene, in ms, and whether a Night Sky moved.
 */
function setEndTime(scene?: Showable) {
  const chosen = scene ?? root();
  const endTime = chosen.duration;
  find(scene).forEach((starCircuit) => {
    starCircuit.stepSchedule.schedule.at(-1)!.time = endTime;
  });
  let nightSky = false;
  chosen.children?.forEach(({ child }) => {
    if (child instanceof NightSky) {
      const schedule = child.bottomColorSchedule.schedule;
      if (schedule.length == 2) {
        schedule[1].time = endTime;
        nightSky = true;
      }
    }
  });
  return { endTime, nightSky };
}

/** Round the corners first, from 2 s to 13 s, then start every Step at 15 s. */
function showIntro(scene?: Showable) {
  find(scene).forEach((starCircuit) => {
    starCircuit.roundingSchedule.set(0.6);
    starCircuit.roundingStepSchedule.set(0.25);
    starCircuit.cornerSizeSchedule.set([
      { time: 2000, value: 0 },
      { time: 8_000, value: 0.45 },
      { time: 10_000, value: 0.45 },
      { time: 13_000, value: 0.4 },
    ]);
    starCircuit.stepSchedule.schedule[0].time = 15000;
  });
}

// MARK: Buttons

/** Buttons for the commands, with `scene`'s properties in the Visual Editor.  The same functions as the console commands. */
export function addFourPlusFourPanel(scene: Showable) {
  addScriptPanel(scene, {
    title: "Four Plus Four",
    status(scene) {
      find(scene);
      return "4 Star Circuits  ✓";
    },
    buttons: [
      {
        label: "Set End Time",
        title:
          "Move each Star Circuit's last Step keyframe, and a two-keyframe Night Sky's Bottom Color, to the end of the scene.",
        run(scene) {
          const { endTime, nightSky } = setEndTime(scene);
          return (
            `Moved to ${endTime / 1000} s:  the last Step keyframe of all four` +
            (nightSky ? ", and the Night Sky's Bottom Color." : ".")
          );
        },
      },
      {
        label: "Show Intro",
        title:
          "In all four:  Corner Size grows from 0 at 2 s to 0.45 at 8 s, then 0.4 at 13 s.  Rounding 0.6, Rounding Step 0.25.  Step's first keyframe moves to 15 s.",
        run(scene) {
          showIntro(scene);
          return "Intro:  corners round from 2 s to 13 s, and Step starts at 15 s, in all four.";
        },
      },
    ],
  });
}

// MARK: Console

function save() {
  if (!saveOutsideChanges()) {
    console.warn("Not saved yet.  Any edit in the Visual Editor will save it.");
  }
}

philDebug.fourPlusFour = {
  find: () => find(),
  setEndTime() {
    setEndTime();
    save();
  },
  showIntro() {
    showIntro();
    save();
  },
};

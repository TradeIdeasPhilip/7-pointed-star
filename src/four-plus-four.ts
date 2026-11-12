import { philDebug } from "canvas-recorder-lib/src/utility";
import { saveOutsideChanges } from "./editor-messages";
import { StarCircuit } from "./star-circuit";
import { root } from "./console-support";
import { NightSky } from "./night-sky";

function save() {
  if (!saveOutsideChanges()) {
    console.warn("Not saved yet.  Any edit in the Visual Editor will save it.");
  }
}

function find(): [StarCircuit, StarCircuit, StarCircuit, StarCircuit] {
  const scene = root();
  const result = (scene.replaceableComponents?.get() ?? []).filter(
    (child) => child instanceof StarCircuit,
  );
  if (result.length != 4) {
    throw new Error(
      `"${scene.userEditableDescription ?? scene.description}" has ${result.length} Star Circuits, not 4.  ` +
        "Choose the scene with the four in the Edit list.",
    );
  }
  return result as [StarCircuit, StarCircuit, StarCircuit, StarCircuit];
}

philDebug.fourPlusFour = {
  find,
  setEndTime() {
    const rootComponent = root();
    const endTime = rootComponent.duration;
    find().forEach((starCircuit) => {
      starCircuit.stepSchedule.schedule.at(-1)!.time = endTime;
    });
    rootComponent.children?.forEach(({ child }) => {
      if (child instanceof NightSky) {
        const schedule = child.bottomColorSchedule.schedule;
        if (schedule.length == 2) {
          schedule[1].time = endTime;
        }
      }
    });
    save();
  },
  showIntro() {
    find().forEach((starCircuit) => {
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
  },
};

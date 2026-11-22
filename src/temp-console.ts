import { NumberScheduleInfo, Showable } from "canvas-recorder-lib";

// Quick temp:

import { only } from "phil-lib/misc";
import { root, saveOutsideChanges } from "./console-support";
import { philDebug } from "canvas-recorder-lib/src/utility";


function spreadIt(component: Showable | undefined) {
  const scheduleHelper = only(
    component?.schedules?.flatMap((schedule) =>
      schedule.description == "Step" ? [schedule] : [],
    ) ?? [],
  );
  if (!(scheduleHelper instanceof NumberScheduleInfo)) {
    throw new Error("wtf");
  }
  const startTime = 8000;
  const pauseTime = 1000;
  const period = 4500;
  let nextStart = startTime;
  const stepCount = 12;
  const schedule = scheduleHelper.schedule;
  schedule.length = 0;
  schedule.push({ time: nextStart, value: -1 });
  for (let i = stepCount; i >= 0; i--) {
    schedule.push({ time: nextStart, value: i });
    if (i > 0) {
      schedule.push({ time: nextStart + pauseTime, value: i });
    }
    nextStart += period;
  }
  saveOutsideChanges();
}

philDebug.spreadIt=spreadIt;
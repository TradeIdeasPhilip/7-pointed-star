/**
 * Eight copies of one circuit, like the hexagram video ✶37.
 *
 * Each copy makes three choices:  draw its first, second and third term groups at the start, or hold each one until the end.
 * 2 × 2 × 2 = 8.  The colors show the choices:  bright when that group comes at the start, darker when it waits.
 * The circle's color is the first group, the fat star's the second, and the thin star's the third.
 *
 * The groups that wait leave an empty group where they were, so that copy pauses while the others draw.
 * They go into three empty groups at the end, which the copies that didn't wait spend paused.
 * So every copy has the same number of steps, and they all draw step N at the same time.
 *
 * `fillEightPack()` builds one in a scene, from TypeScript.  `addEightPackPanel()` gives that scene buttons for the commands below.
 * On the console, choose a scene with eight in the Edit list, then:
 * * `philDebug.eightPack.find()`:  the eight, and each one's choices.
 * * `philDebug.eightPack.setTermGroups()`:  copy the last one's Term Groups to the others, with their own choices.
 * * `philDebug.eightPack.setSteps()`:  every Step from 0, at the start of the scene, to the last group, at its end.
 * * `philDebug.eightPack.setCircuit("Random 1")`:  the same circuit in all eight.
 * @module
 */

import { ReadOnlyRect } from "phil-lib/misc";
import {
  DurationAgnosticComponent,
  parseTermGroups,
  Showable,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { philDebug } from "canvas-recorder-lib/src/utility";
import { root, saveOutsideChanges } from "./console-support.ts";
import { parseCircuit7 } from "./euler-circuits.ts";
import { NightSky } from "./night-sky.ts";
import { named } from "./scenes.ts";
import { addScriptPanel } from "./script-panel.ts";
import { StarCircuit, StarColors } from "./star-circuit.ts";

/** Draw a term group at the start, or hold it until the end. */
export type When = "start" | "end";

/** One of the eight, and its three choices. */
export type EightPackItem = {
  /** For the first, second and third term groups. */
  readonly when: readonly [When, When, When];
  readonly component: StarCircuit;
};

/**
 * The choices for each of the eight, by its place among the scene's Star Circuits.
 * Bit k says group k is at the start, as `which` did in ✶37.
 * So the first one holds all three for the end, and the last does all three at the start.
 */
export function whenFor(index: number): [When, When, When] {
  const bit = (k: number): When => ((index >> k) & 1 ? "start" : "end");
  return [bit(0), bit(1), bit(2)];
}

/** The circle, the fat star and the thin star, for each choice of the first, second and third term groups. */
const COLORS: Record<When, StarColors> = {
  //  start: [myRainbow.red, myRainbow.myBlue, myRainbow.green],
  //  /** About 5/8 as bright.  Still easy to see on the Night Sky. */
  //  end: ["#a00000", "#0050a0", "#009500"],
  end: [myRainbow.red, myRainbow.green, "#5050ff"],
  start: ["#00FFFF", "#FF00FF", "#FFFF00"],
};

/** The colors that show these choices. */
export function colorsFor(when: EightPackItem["when"]): StarColors {
  return [COLORS[when[0]][0], COLORS[when[1]][1], COLORS[when[2]][2]];
}

/**
 * ✶37's layout, turned for a 9 × 16 canvas:  four rows of two, every other row a unit to the right.
 * In reading order, so the last one, which does everything at the start, is at the bottom right.
 */
const RECTS: readonly ReadOnlyRect[] = [0, 1, 2, 3].flatMap((row) =>
  [0, 1].map((column) => ({
    x: 0.5 + (row % 2) + 4 * column,
    y: 0.5 + 4 * row,
    width: 3,
    height: 3,
  })),
);

// MARK: Term Groups and Step

/**
 * Term Groups for one of the eight.
 * @param base The Term Groups of the one that does all three at the start.
 * If it doesn't end with three empty groups, they're added, to make room.  So the result of an earlier call works too.
 * @param when For each of the first three groups.
 * @returns `base`, except each of the first three groups that waits is empty, and its terms are in one of the three empty groups at the end, in the same order.
 * @throws If any of the first three groups is empty.
 */
export function eightPackTermGroups(
  base: string,
  when: EightPackItem["when"],
): string {
  const groups = base.split(",").map((group) => group.trim());
  let emptyAtTheEnd = 0;
  while (
    emptyAtTheEnd < groups.length &&
    groups[groups.length - 1 - emptyAtTheEnd] == ""
  ) {
    emptyAtTheEnd++;
  }
  for (; emptyAtTheEnd < 3; emptyAtTheEnd++) {
    groups.push("");
  }
  if (groups.slice(0, 3).includes("")) {
    throw new Error(
      `The first three groups each need a term.  These are the three that start or wait:  "${base}"`,
    );
  }
  const end = groups.length - 3;
  when.forEach((choice, k) => {
    if (choice == "end") {
      groups[end + k] = groups[k];
      groups[k] = "";
    }
  });
  // "0, , 2, , 1," ends with a comma:  the last group is empty.
  return groups.join(", ").trimEnd();
}

/**
 * Give all eight the last one's Term Groups, each with its own choices.
 * @throws If the last one's Term Groups changes over time, or any of its first three groups is empty.
 */
function applyTermGroups(items: readonly EightPackItem[]) {
  const keyframes =
    items[items.length - 1].component.termGroupsSchedule.schedule;
  if (keyframes.length != 1) {
    throw new Error(
      `The last Star Circuit's Term Groups has ${keyframes.length} keyframes.  This needs exactly 1.`,
    );
  }
  const base = keyframes[0].value;
  // All of them first, so a problem changes nothing.
  const termGroups = items.map(({ when }) => eightPackTermGroups(base, when));
  items.forEach(({ component }, index) =>
    component.termGroupsSchedule.set(termGroups[index]),
  );
}

/** Every Step goes from 0, at time 0, to that circuit's number of groups, at `duration`. */
function applySteps(items: readonly EightPackItem[], duration: number) {
  for (const { component } of items) {
    const groups = parseTermGroups(component.termGroupsSchedule.at(duration))
      .groups.length;
    component.stepSchedule.set([
      { time: 0, value: 0 },
      { time: duration, value: groups },
    ]);
  }
}

// MARK: TypeScript

/**
 * Fill a scene with eight copies of one circuit, on a Night Sky, for a 9 × 16 canvas.
 *
 * Everything is a replaceable child, so the Visual Editor can change, copy or delete any of it.
 * The Night Sky replaces `addScene()`'s black background.
 * Term Groups and Step are set the same way the console commands set them.
 * Set the scene's Min Duration first:  Step ends at the end of the scene.
 * @param circuit A name from `NAMED_CIRCUITS_7`, or the vertices in order.
 */
export function fillEightPack(
  scene: DurationAgnosticComponent,
  circuit: string,
) {
  const components = scene.replaceableComponents!;
  components.replace([named("Night Sky", new NightSky())]);
  const items: EightPackItem[] = RECTS.map((rect, index) => {
    const when = whenFor(index);
    const [circleColor, fatStarColor, thinStarColor] = colorsFor(when);
    const component = new StarCircuit({
      circuit,
      fourierRect: rect,
      circleColor,
      fatStarColor,
      thinStarColor,
      // Scaled from the 0.15 in Scratch 1's 7 × 7 circuits.
      fourierLineWidth: 0.06,
      // No reference images:  no room.
      referenceLineWidth: 0,
    });
    components.push(named(when.join(" "), component));
    return { when, component };
  });
  applyTermGroups(items);
  applySteps(items, scene.duration);
}

// MARK: Commands

/**
 * A scene's eight Star Circuits, in order, and each one's choices.
 * @param scene What's chosen in the Edit list, by default, for the console.
 * @throws Unless the scene has exactly 8 Star Circuits.
 */
function find(scene?: Showable): EightPackItem[] {
  const chosen = scene ?? root();
  const circuits = (chosen.replaceableComponents?.get() ?? []).filter(
    (child) => child instanceof StarCircuit,
  );
  if (circuits.length != 8) {
    throw new Error(
      `"${chosen.userEditableDescription ?? chosen.description}" has ${circuits.length} Star Circuits, not 8.` +
        (scene ? "" : "  Choose the scene with the eight in the Edit list."),
    );
  }
  return circuits.map((component, index) => ({
    when: whenFor(index),
    component,
  }));
}

/**
 * Copy the last one's Term Groups to all eight, each with its own choices.  Then {@link setSteps}.
 * @returns The Term Groups copied.
 */
function setTermGroups(scene?: Showable): string {
  const items = find(scene);
  applyTermGroups(items);
  return items[items.length - 1].component.termGroupsSchedule.at(0);
}

/**
 * Every Step from 0, at the start of the scene, to the last group, at its end.  Do this after changing either one.
 * @returns The scene's length, in ms.
 */
function setSteps(scene?: Showable): number {
  const items = find(scene);
  const duration = (scene ?? root()).duration;
  if (!(duration > 0)) {
    throw new Error(`The scene is ${duration} ms long.`);
  }
  applySteps(items, duration);
  return duration;
}

/**
 * The same circuit in all eight.
 * @param circuit A name from the Circuit field's suggestions, or the vertices in order.
 * @throws If it doesn't parse, and changes nothing.
 */
function setCircuit(scene: Showable | undefined, circuit: string) {
  const parsed = parseCircuit7(circuit);
  if (typeof parsed == "string") {
    throw new Error(parsed);
  }
  for (const { component } of find(scene)) {
    component.circuitSchedule.set(circuit);
  }
}

// MARK: Buttons

/** Buttons for the commands, with `scene`'s properties in the Visual Editor.  The same functions as the console commands. */
export function addEightPackPanel(scene: Showable) {
  addScriptPanel(scene, {
    title: "Eight Pack",
    status(scene) {
      find(scene);
      return "8 Star Circuits  ✓";
    },
    buttons: [
      {
        label: "Set Term Groups",
        title:
          "Copy the last Star Circuit's Term Groups to all eight, each with its own choices.  Then Set Steps.",
        run(scene) {
          const termGroups = setTermGroups(scene);
          return `Term Groups:  “${termGroups}”, with each one's choices.  Now Set Steps.`;
        },
      },
      {
        label: "Set Steps",
        title:
          "Every Step from 0, at the start of the scene, to its last group, at the end.",
        run(scene) {
          const duration = setSteps(scene);
          return `Step:  0 at 0 s to the last group at ${duration / 1000} s, in all eight.`;
        },
      },
      {
        label: "Set Circuit",
        title: "The same circuit in all eight.",
        argument: { placeholder: "Random 1, or 0 1 2 0 3 …" },
        run(scene, circuit) {
          setCircuit(scene, circuit);
          return `Circuit:  “${circuit}” in all eight.`;
        },
      },
    ],
  });
}

// MARK: Console

/** Save what the console changed, and show it. */
function finish(scene?: Showable) {
  if (!saveOutsideChanges()) {
    console.warn("Not saved yet.  Any edit in the Visual Editor will save it.");
  }
  console.table(
    find(scene).map(({ when, component }) => ({
      name: component.userEditableDescription ?? component.description,
      when: when.join(" "),
      termGroups: component.termGroupsSchedule.at(0),
      step: JSON.stringify(component.stepSchedule.schedule),
    })),
  );
}

philDebug.eightPack = {
  find: () => find(),
  /** Copy the last one's Term Groups to all eight, each with its own choices.  Then call setSteps(). */
  setTermGroups() {
    setTermGroups();
    finish();
  },
  /** Every Step from 0, at the start of the scene, to the last group, at its end.  Call this after changing either one. */
  setSteps() {
    setSteps();
    finish();
  },
  /** The same circuit in all eight:  a name from the Circuit field's suggestions, or the vertices in order. */
  setCircuit(circuit: string) {
    setCircuit(undefined, circuit);
    finish();
  },
};

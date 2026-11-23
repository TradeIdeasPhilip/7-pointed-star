/**
 * Quick and dirty console commands, promoted to code.
 * * `philDebug.ve_dump()`:  search the chosen chapter's components.  With no arguments, a summary of ready-to-paste searches.
 * * `philDebug.staggeredWithin(numberOfSteps)`:  the chapter's Star Circuits start one after another, then finish together.
 * @module
 */

import { easeIn, parseTermGroups, Showable } from "canvas-recorder-lib";
import { philDebug } from "canvas-recorder-lib/src/utility";
import { root, saveOutsideChanges } from "./console-support";
import { StarCircuit } from "./star-circuit";
import { only, makeLinear } from "phil-lib/misc";

// MARK: dump()

/** A class of components.  `abstract`, so an abstract base class works too, like `DurationAgnosticComponent`. */
type ShowableClass<T extends Showable> = abstract new (...args: never) => T;

type DumpFilters = {
  /**
   * Throw an exception if the number of results is less than this.
   * Defaults to allow anything.
   */
  assertMin?: number;
  /**
   * Throw an exception if the number of results is greater than this.
   * Defaults to allow anything.
   */
  assertMax?: number;
  /**
   * 0 matches the root of the tree.
   * 1 is the root's direct descendants.
   * `undefined` matches anything.
   */
  level?: number;
  /**
   * This corresponds to the "Name" field on the GUI and the `Showable.userEditableDescription` field in the code.
   * `undefined` matches anything.
   */
  name?: string;
  /**
   * We focus on the name of the class because this is aimed at the console, and the class definitions are not usually available.
   * A string matches the class's name exactly.
   *
   * In code, pass the class itself:  `dump({ className: StarCircuit })`.
   * That matches with `instanceof`, so subclasses count, and the result is typed:  `StarCircuit[]`.
   */
  className?: string | ShowableClass<Showable>;
};

/**
 * Search for components in the current chapter.
 * @param filters What to search for.
 * The filters are and'ed together.
 * `{}` Requests the entire tree.
 * @returns A list of matches.
 * If called with no arguments it will dump useful status on the console.
 * @throws If a requested assertion fails, or the Visual Editor isn't open.
 */
function dump<T extends Showable>(
  filters: DumpFilters & { readonly className: ShowableClass<T> },
): T[];
function dump(filters?: DumpFilters): Showable[];
function dump(filters?: DumpFilters): Showable[] {
  const top = root();
  if (!filters) {
    // Print help on the console.
    // This tool is aimed heavily at the console.
    const functionName = "philDebug.ve_dump";
    let message = "";
    message += `${functionName}(); // for a summary.\n`;
    message += `${functionName}({}); // for all nodes.\n`;
    const byLevel = new Map<number, Showable[]>();
    const byName = new Map<string, Showable[]>();
    const byClassName = new Map<string, Showable[]>();
    function dfs(node: Showable, level: number) {
      const name = node.userEditableDescription ?? "";
      const className = node.constructor.name;
      byLevel.getOrInsertComputed(level, () => []).push(node);
      byName.getOrInsertComputed(name, () => []).push(node);
      byClassName.getOrInsertComputed(className, () => []).push(node);
      node.children?.forEach(({ child }) => {
        dfs(child, level + 1);
      });
    }
    dfs(top, 0);
    // JSON.stringify() quotes the strings, so each line can be pasted back in.
    byLevel.forEach((matches, level) => {
      message += `${functionName}({level: ${level}, assertMin: ${matches.length}, assertMax: ${matches.length}});\n`;
    });
    byName.forEach((matches, name) => {
      message += `${functionName}({name: ${JSON.stringify(name)}, assertMin: ${matches.length}, assertMax: ${matches.length}});\n`;
    });
    byClassName.forEach((matches, className) => {
      message += `${functionName}({className: ${JSON.stringify(className)}, assertMin: ${matches.length}, assertMax: ${matches.length}});\n`;
    });
    console.log(message);
    return [];
  } else {
    const result = new Array<Showable>();
    const filterLevel = filters.level;
    const filterName = filters.name;
    const filterClass = filters.className;
    function classMatches(node: Showable) {
      if (filterClass === undefined) {
        return true;
      } else if (typeof filterClass === "string") {
        return filterClass === node.constructor.name;
      } else {
        return node instanceof filterClass;
      }
    }
    function dfs(node: Showable, level: number) {
      // Test node.
      if (
        (filterLevel === level || filterLevel === undefined) &&
        (filterName === undefined ||
          filterName === (node.userEditableDescription ?? "")) &&
        classMatches(node)
      ) {
        result.push(node);
      }
      // Test node's children.
      if (filterLevel === undefined || filterLevel > level) {
        node.children?.forEach(({ child }) => {
          dfs(child, level + 1);
        });
      }
    }
    dfs(top, 0);
    if (filters.assertMin !== undefined && result.length < filters.assertMin) {
      console.error(filters, result);
      throw new Error("Not enough results.");
    }
    if (filters.assertMax !== undefined && result.length > filters.assertMax) {
      console.error(filters, result);
      throw new Error("Too many results.");
    }
    return result;
  }
}

// TODO Move this into the library as philDebug.VisualEditor.dump.
philDebug.ve_dump = dump;

// MARK: staggeredWithin()

/**
 * Rewrite the Step schedule of every Star Circuit in the chosen chapter.
 * Each of the first `numberOfSteps` steps is staggered:  the circuits take turns starting it,
 * and every one finishes it before any starts the next.  The rest of the steps run together, with no pauses.
 *
 * Every step takes the same time, `s`, staggered or not.  With `x` the delay between starts, and 3 circuits:
 * * The first starts at 0, the second at `x`, the third at `2x`.
 * * The first ends at `s`, the second at `s + x`, the third at `s + 2x`.
 * * One more `x` with no action.  The next step starts at `s + 3x`, staggered the same way or not.
 *
 * So a staggered step takes `s + N·x` for N circuits, and the whole thing takes `steps·s + numberOfSteps·N·x`,
 * the chapter's duration.  One equation, two unknowns, so `staggerInSteps` picks the ratio:  `x = staggerInSteps·s`.
 * The default, 0.1, is like 1 s delays for 10 s steps.
 *
 * The keyframes use the chapter's time, so this is for Star Circuits that are its children,
 * or inside something that doesn't shift time.  Every keyframe is replaced, easing included.
 * @param numberOfSteps How many steps are staggered.  A whole number, from 1 to the number of term groups.
 * @param staggerInSteps The delay between starts, and the pause after the last one ends, as a fraction of a step.  0 for none.
 * @returns The times it chose, in ms.
 * @throws If the chapter has no Star Circuits, they don't all have the same number of term groups,
 * or an argument is out of range.
 */
function staggeredWithin(numberOfSteps: number, staggerInSteps = 0.1) {
  const { duration } = root();
  const elements = dump({ className: StarCircuit, assertMin: 1 });
  /** Each one's number of term groups, at the end, as `setSteps()` in `eight-pack.ts` counts them. */
  const groupCounts = elements.map(
    (element) =>
      parseTermGroups(element.termGroupsSchedule.at(duration)).groups.length,
  );
  const steps = groupCounts[0];
  if (groupCounts.some((count) => count != steps)) {
    throw new Error(
      `The Star Circuits don't all have the same number of term groups:  ${groupCounts.join(", ")}.`,
    );
  }
  if (
    !(
      Number.isInteger(numberOfSteps) &&
      numberOfSteps >= 1 &&
      numberOfSteps <= steps
    )
  ) {
    throw new Error(
      `numberOfSteps should be a whole number from 1 to ${steps}, the number of term groups.`,
    );
  }
  if (!(staggerInSteps >= 0)) {
    throw new Error("staggerInSteps can't be negative.");
  }
  const count = elements.length;
  const stepTime = duration / (steps + numberOfSteps * count * staggerInSteps);
  const stagger = staggerInSteps * stepTime;
  /** How long each staggered step takes, from the first start to the start of the next step. */
  const staggeredStepTime = stepTime + count * stagger;
  /** When the staggered steps are done.  Then they all go together. */
  const together = numberOfSteps * staggeredStepTime;
  elements.forEach((element, index) => {
    const offset = index * stagger;
    const keyframes: { time: number; value: number }[] = [];
    /** Whole milliseconds, and no repeats where two times meet, as at the start of the first circuit. */
    function add(time: number, value: number) {
      time = Math.round(time);
      const previous = keyframes.at(-1);
      if (previous?.time !== time || previous.value !== value) {
        keyframes.push({ time, value });
      }
    }
    add(0, 0);
    for (let step = 0; step < numberOfSteps; step++) {
      const start = step * staggeredStepTime + offset;
      add(start, step);
      add(start + stepTime, step + 1);
    }
    add(together, numberOfSteps);
    add(duration, steps);
    element.stepSchedule.set(keyframes);
  });
  return {
    count,
    steps,
    stepTime,
    stagger,
    staggeredStepTime,
    together,
    duration,
  };
}

// MARK: staggered2()

/**
 * Aimed at "scratch 17" in the portrait aspect ratio video.
 *
 * The top component should have twice as many steps as the bottom component.
 * But we adjust the speed so every time the top component does two steps, the bottom does one.
 *
 * This pauses briefly between every time the top does two steps and the bottom does one.
 * The assumption is that we will be pausing every time the two look identical.
 * I created the second component's step list by combining every two step from the first component.
 */
function staggered2() {
  /**
   * Use the Visual Editor's root component to decide what this script is applied to.
   */
  const rootComponent = root();
  const [top, bottom] = dump({
    className: StarCircuit,
    assertMin: 2,
    assertMax: 2,
  });
  /**
   * Number of steps.
   */
  const topCount = only(top.termGroupsSchedule.schedule).value.split(
    ",",
  ).length;
  /**
   * Number of steps.
   */
  const bottomCount = only(bottom.termGroupsSchedule.schedule).value.split(
    ",",
  ).length;
  if (topCount != bottomCount * 2) {
    console.error({
      topCount,
      bottomCount,
      expected: "topCount == bottomCount * 2",
    });
    throw new Error("wtf");
  }
  /**
   * Give the reference diagram some time to get out of the way.
   */
  const startTime = 500;
  const endTime = rootComponent.duration;
  /**
   * The input is the bottom component's starting index.
   * The output is the time (relative to this component) that this component should start making its first move.
   */
  const sectionStart = makeLinear(0, startTime, bottomCount, endTime);
  /**
   * Time between the start of one pause and the start of the next.
   * I.e. 1/frequency.
   */
  const sectionTotalDuration = (endTime - startTime) / bottomCount;
  /**
   * We pause for the last 1/5 of each time period.
   */
  const pauseStartsAt = sectionTotalDuration * (4 / 5);
  const topSchedule = top.stepSchedule.schedule;
  topSchedule.length = 0;
  const bottomSchedule = bottom.stepSchedule.schedule;
  bottomSchedule.length = 0;
  for (let bottomIndex = 0; bottomIndex < bottomCount; bottomIndex++) {
    const thisSectionStartsAt = sectionStart(bottomIndex);
    const thisPauseStartsAt = thisSectionStartsAt + pauseStartsAt;
    topSchedule.push(
      { time: thisSectionStartsAt, value: bottomIndex * 2 },
      { time: thisPauseStartsAt, value: (bottomIndex + 1) * 2 },
    );
    bottomSchedule.push(
      { time: thisSectionStartsAt, value: bottomIndex },
      { time: thisPauseStartsAt, value: bottomIndex + 1 },
    );
  }
  topSchedule[0].easeAfter = easeIn;
  bottomSchedule[0].easeAfter = easeIn;
  save();
}

philDebug.staggered2 = staggered2;

// MARK: Console

function save() {
  if (!saveOutsideChanges()) {
    console.warn("Not saved yet.  Any edit in the Visual Editor will save it.");
  }
}

philDebug.staggeredWithin = (numberOfSteps: number, staggerInSteps = 0.1) => {
  const result = staggeredWithin(numberOfSteps, staggerInSteps);
  save();
  return result;
};

/**
 * Tools in the Visual Editor for any Fourier animation with Term Groups and Step, like the library's Fourier component.
 *
 * * {@link fourierStepPanel}:  a panel that says what Step means at the playhead.  The terms all the way in, the ones coming in,
 *   and how much of the curve they are.  When Step's last keyframe doesn't match the number of groups, a button fixes it.
 *   And a button that rebuilds Term Groups by size, {@link termGroupsBySize}, as a starting point to edit by hand.
 * * {@link fourierMessages}:  the checks that Term Groups and Step agree.  `editor-messages.ts` shows them.
 *
 * A component gets both by being a {@link SteppedFourier}.  Star Circuit, Bridged Fourier, Bridged Path and Bridged Morph are.
 *
 * Built on library 0.7.3's hooks.  See `development-plans/editor-panels.md`.
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import {
  checkStepRange,
  checkTermGroups,
  type EditorPanel,
  type EditorPanelAPI,
  type Keyframe,
  type NumberScheduleInfo,
  parseTermGroups,
  type StringScheduleInfo,
} from "canvas-recorder-lib";
import type { FourierTerm } from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { sum } from "phil-lib/misc";
import type { EditorMessage } from "./editor-messages.ts";

// MARK: What a component needs

/** Anything with the Fourier component's Term Groups and Step. */
export type SteppedFourier = {
  /** The Fourier component's Term Groups.  See `parseTermGroups()`. */
  readonly termGroupsSchedule: StringScheduleInfo;
  /** The Fourier component's Step:  negative hides it, 0 is a dot, the number of groups is the finished curve. */
  readonly stepSchedule: NumberScheduleInfo;
  /**
   * The terms Term Groups numbers, largest first, the way `samplesToFourier()` returns them.
   * @returns Or why there are none, like a circuit that doesn't parse.
   */
  fourierTermsAt(timeInMs: number): readonly FourierTerm[] | string;
};

// MARK: What Step means

/**
 * Term numbers in the Term Groups format, as one group:  "2 7-11".
 * Sorted, repeats dropped, and runs of 3 or more written as ranges.
 * @returns "none" when there are none, not an empty string.
 */
export function formatTerms(terms: Iterable<number>): string {
  const sorted = [...new Set(terms)].sort((a, b) => a - b);
  if (sorted.length == 0) {
    return "none";
  }
  const pieces: string[] = [];
  let first = 0;
  while (first < sorted.length) {
    let last = first;
    while (last + 1 < sorted.length && sorted[last + 1] == sorted[last] + 1) {
      last++;
    }
    if (last - first >= 2) {
      pieces.push(`${sorted[first]}-${sorted[last]}`);
    } else {
      pieces.push(...sorted.slice(first, last + 1).map(String));
    }
    first = last + 1;
  }
  return pieces.join(" ");
}

/** What Step means at one moment, as numbers.  See {@link analyzeStep}. */
export type StepAnalysis = {
  readonly groupCount: number;
  /** The terms all the way in. */
  readonly done: readonly number[];
  /** The terms coming in now.  Empty unless Step is between two whole numbers. */
  readonly adding: readonly number[];
  /** The group coming in, counting from 1, and how far along it is, 0 to 1.  Only while it's coming in. */
  readonly coming?: { readonly group: number; readonly progress: number };
  /** Asked for, but past the last term. */
  readonly missing: readonly number[];
};

/**
 * Which terms Step means:  the ones all the way in, and the ones coming in.
 * The same arithmetic as the library's Fourier component, `orderTerms()` and `ColoredAnimations.frameAt()`.
 * A repeated term only counts the first time.  A term past the end goes in `missing` instead.
 *
 * Pure.
 * @param termCount How many terms the source has.  `undefined` when that's not known, so nothing is missing.
 * @returns `undefined` when Step is negative, so nothing is drawn.
 */
export function analyzeStep(
  groups: readonly (readonly number[])[],
  step: number,
  termCount: number | undefined,
): StepAnalysis | undefined {
  if (!(step >= 0)) {
    return undefined;
  }
  const groupCount = groups.length;
  if (groupCount == 0) {
    return { groupCount, done: [], adding: [], missing: [] };
  }
  const index = Math.min(Math.floor(step), groupCount - 1);
  /** 1 only at or past the end. */
  const progress = Math.min(1, step - index);
  /** Every term number asked for so far, so a repeat only counts the first time. */
  const used = new Set<number>();
  const missing: number[] = [];
  /** The terms `group` adds:  no repeats, nothing past the end. */
  const take = (group: readonly number[]): number[] => {
    const result: number[] = [];
    for (const term of group) {
      if (used.has(term)) {
        continue;
      }
      used.add(term);
      if (termCount !== undefined && term >= termCount) {
        missing.push(term);
      } else {
        result.push(term);
      }
    }
    return result;
  };
  const done = groups
    .slice(0, progress == 1 ? groupCount : index)
    .flatMap(take);
  if (progress > 0 && progress < 1) {
    const adding = take(groups[index]);
    return {
      groupCount,
      done,
      adding,
      coming: { group: index + 1, progress },
      missing,
    };
  }
  return { groupCount, done, adding: [], missing };
}

/** One line of the amplitude table:  how many terms, and their share of the total amplitude, 0 to 1. */
export type TermShare = { readonly count: number; readonly amplitude: number };

/** What Step means, ready to show.  See {@link describeStep}. */
export type StepReport = {
  /** Step rounded to 2 places, and the number of groups:  "2.47 of 11".  Or why nothing is drawn. */
  readonly step: string;
  /** The terms all the way in, in the Term Groups format, or "none". */
  readonly terms: string;
  /** The terms coming in now, which group they are, and how far along:  "2 7-11  (group 3, 47%)".  Only during a change. */
  readonly adding?: string;
  /**
   * Like the table in "Will it Fourier?":  the terms in, coming in, and not used yet,
   * and each one's share of the sum of every term's amplitude.  Only when the terms are known.
   */
  readonly shares?: {
    readonly in: TermShare;
    readonly adding?: TermShare;
    readonly left: TermShare;
  };
  /** Things to fix, like terms that don't exist. */
  readonly warnings: readonly string[];
};

/**
 * What Step means at one moment, in words.  Built on {@link analyzeStep}.
 *
 * Pure.
 * @param termGroups The Term Groups field.
 * @param step The Step field.
 * @param terms The source's terms, largest first, or why there are none.
 */
export function describeStep(
  termGroups: string,
  step: number,
  terms: readonly FourierTerm[] | string,
): StepReport {
  const rounded = step.toFixed(2);
  const known = typeof terms == "string" ? undefined : terms;
  const analysis = analyzeStep(
    parseTermGroups(termGroups).groups,
    step,
    known?.length,
  );
  const warnings: string[] = [];
  if (typeof terms == "string") {
    warnings.push(terms);
  }
  if (!analysis) {
    return { step: `${rounded}, so hidden`, terms: "none", warnings };
  }
  const { groupCount, done, adding, coming, missing } = analysis;
  if (groupCount == 0) {
    warnings.push("Term Groups is empty, so nothing is drawn.");
    return { step: rounded, terms: "none", warnings };
  }

  let stepText = `${rounded} of ${groupCount}`;
  if (step > groupCount) {
    stepText += ", past the end, so finished";
  } else if (step == groupCount) {
    stepText += ", finished";
  }
  const addingText = coming
    ? `${formatTerms(adding)}  (group ${coming.group}, ${Math.round(coming.progress * 100)}%)`
    : undefined;

  let shares: StepReport["shares"];
  if (known) {
    const total = sum(known.map(({ amplitude }) => amplitude));
    const share = (list: readonly number[]): TermShare => ({
      count: list.length,
      amplitude:
        total > 0 ? sum(list.map((term) => known[term].amplitude)) / total : 0,
    });
    const shareIn = share(done);
    const shareAdding = coming ? share(adding) : undefined;
    const addingAmplitude = shareAdding?.amplitude ?? 0;
    shares = {
      in: shareIn,
      adding: shareAdding,
      left: {
        count: known.length - done.length - adding.length,
        amplitude: Math.max(0, 1 - shareIn.amplitude - addingAmplitude),
      },
    };
    if (missing.length > 0) {
      const count = known.length;
      warnings.push(
        `Not in this source:  ${formatTerms(missing)}.  ` +
          (count == 0
            ? "It has no terms."
            : count == 1
              ? "It has 1 term, 0."
              : `It has ${count} terms, 0-${count - 1}.`),
      );
    }
  }
  return {
    step: stepText,
    terms: formatTerms(done),
    adding: addingText,
    shares,
    warnings,
  };
}

/**
 * When Step's last keyframe doesn't end at the number of groups, the keyframe and the value it needs.
 * Only for the usual shape:  two or more keyframes, the last one not negative, so not one that hides the curve.
 * The number of groups is Term Groups at that keyframe's time.
 *
 * Pure.
 */
export function stepFix(
  component: SteppedFourier,
): { readonly keyframe: Keyframe<number>; readonly to: number } | undefined {
  const keyframes = component.stepSchedule.schedule;
  const last = keyframes.at(-1);
  if (!last || keyframes.length < 2 || !(last.value >= 0)) {
    return undefined;
  }
  const groupCount = parseTermGroups(component.termGroupsSchedule.at(last.time))
    .groups.length;
  if (groupCount == 0 || last.value == groupCount) {
    return undefined;
  }
  return { keyframe: last, to: groupCount };
}

// MARK: Rebuilding Term Groups

/** The Minimum box's starting value, in percent. */
const DEFAULT_MINIMUM_PERCENT = 3;

/**
 * New Term Groups, by size:  every group but the last is at least `minShare` of the total amplitude.
 * From the largest term down, a term that big gets a group of its own.  Smaller ones are gathered until the group is that big.
 * The last group gets what's left, so it can be smaller.  A starting point to edit by hand.
 *
 * Pure.
 * @param terms Largest first, the way `samplesToFourier()` returns them.
 * @param minShare A share of the sum of every term's amplitude, 0 to 1.  0.03 is 3%.
 * @returns In the Term Groups format, like "0, 1, 2 3, 4-9, 10-1022".  Empty when there are no terms.
 */
export function termGroupsBySize(
  terms: readonly { readonly amplitude: number }[],
  minShare: number,
): string {
  const total = sum(terms.map(({ amplitude }) => amplitude));
  const groups: number[][] = [];
  let group: number[] = [];
  let groupShare = 0;
  terms.forEach(({ amplitude }, rank) => {
    group.push(rank);
    groupShare += total > 0 ? amplitude / total : 0;
    if (groupShare >= minShare) {
      groups.push(group);
      group = [];
      groupShare = 0;
    }
  });
  if (group.length > 0) {
    groups.push(group);
  }
  return groups.map(formatTerms).join(", ");
}

/**
 * The keyframe in effect at `timeInMs`, the one `StringScheduleInfo.at()` reads:
 * the last one at or before that time, or the first one when it's earlier than all of them.
 */
function keyframeAt<T>(
  keyframes: readonly Keyframe<T>[],
  timeInMs: number,
): Keyframe<T> | undefined {
  let result = keyframes[0];
  for (const keyframe of keyframes) {
    if (keyframe.time <= timeInMs) {
      result = keyframe;
    }
  }
  return result;
}

// MARK: The checks

/**
 * Do Term Groups and Step agree, and does every term exist?
 * The library's own checks, `checkTermGroups()` and `checkStepRange()`, the same ones its Fourier panel shows.
 * Each Term Groups keyframe is checked against the terms at that keyframe's time.
 * For `HasEditorMessages.editorMessages()`.
 * @param options.sourceErrors false when the component already says why there are no terms,
 * like Star Circuit's line about a circuit that doesn't parse.  Then it isn't said twice.
 */
export function fourierMessages(
  component: SteppedFourier,
  { sourceErrors = true }: { readonly sourceErrors?: boolean } = {},
): EditorMessage[] {
  const messages: EditorMessage[] = [];
  /** Says which keyframe, when a field has more than one. */
  const at = (keyframes: readonly Keyframe<unknown>[], time: number) =>
    keyframes.length > 1 ? `At ${time} ms:  ` : "";
  const plural = (count: number, noun: string) =>
    `${count} ${noun}${count == 1 ? "" : "s"}`;

  // MARK: Term Groups
  const termKeyframes = component.termGroupsSchedule.schedule;
  const groupCounts = new Set<number>();
  for (const { time, value } of termKeyframes) {
    const parsed = parseTermGroups(value);
    groupCounts.add(parsed.groups.length);
    const termCount = sum(parsed.groups.map((group) => group.length));
    const terms = component.fourierTermsAt(time);
    const problems = [...parsed.warnings];
    if (typeof terms == "string") {
      if (sourceErrors) {
        messages.push({
          level: "error",
          text: `${at(termKeyframes, time)}${terms}`,
        });
      }
    } else {
      problems.push(...checkTermGroups(parsed.groups, terms));
    }
    // Without terms to check against, no ✓.
    const clean =
      typeof terms != "string" &&
      parsed.errors.length == 0 &&
      problems.length == 0;
    messages.push({
      level: clean ? "ok" : "note",
      text: `${at(termKeyframes, time)}Term Groups:  ${plural(parsed.groups.length, "group")}, ${plural(termCount, "term")}`,
    });
    for (const error of parsed.errors) {
      messages.push({ level: "error", text: error });
    }
    for (const problem of problems) {
      messages.push({ level: "warning", text: problem });
    }
  }

  // MARK: Step
  if (groupCounts.size == 1) {
    const [groupCount] = groupCounts;
    const problems = checkStepRange(
      component.stepSchedule.schedule,
      groupCount,
    );
    if (problems.length == 0) {
      messages.push({ level: "ok", text: `Step runs from 0 to ${groupCount}` });
    }
    for (const problem of problems) {
      messages.push({ level: "warning", text: problem });
    }
  } else {
    messages.push({
      level: "note",
      text: "Term Groups changes over time, so Step can't be checked against one number of groups.",
    });
  }
  return messages;
}

// MARK: The panel

/** "71.2%". */
function percent(fraction: number): string {
  return `${(100 * fraction).toFixed(1)}%`;
}

/**
 * A component's own panel, bottom right, with its properties:  what Step means at the playhead.
 * The terms are in the Term Groups format, like "2 7-11", and selectable, so they can be copied back into that field.
 *
 * One panel object for the life of `component`.  No DOM until `start()`.
 * Set it as the component's `editorPanel`, or offer it to other components with `canvasRecorder.addEditorPanel()`.
 */
export function fourierStepPanel(component: SteppedFourier): EditorPanel {
  let editor: EditorPanelAPI | undefined;
  let legend: HTMLLegendElement | undefined;
  let body: HTMLDivElement | undefined;
  /** What the body shows now, so a frame that changes nothing doesn't touch it. */
  let shown = "";
  /** The Minimum box, in percent.  Kept here, because a rebuild restarts the panel. */
  let minimumText = String(DEFAULT_MINIMUM_PERCENT);
  /** What the last rebuild did, or why it didn't.  Kept here for the same reason. */
  let rebuilt: { readonly text: string; readonly warning: boolean } | undefined;

  /**
   * Replace the Term Groups keyframe in effect at the playhead with {@link termGroupsBySize}.
   * A mistake is a message, not an error.
   * @param show Puts the message on the screen, before the change restarts the panel.
   */
  function rebuild(api: EditorPanelAPI, show: () => void) {
    const fail = (text: string) => {
      rebuilt = { text: `⚠ ${text}`, warning: true };
      show();
    };
    const minimum = Number(minimumText);
    if (minimumText.trim() == "" || !(minimum > 0)) {
      return fail("The minimum should be more than 0%.");
    }
    const timeInMs = api.getTimeMs();
    const terms = component.fourierTermsAt(timeInMs);
    if (typeof terms == "string") {
      return fail(terms);
    }
    if (terms.length == 0) {
      return fail("This source has no terms.");
    }
    const keyframes = component.termGroupsSchedule.schedule;
    const keyframe = keyframeAt(keyframes, timeInMs);
    if (!keyframe) {
      return fail("Term Groups has no keyframes.");
    }
    const value = termGroupsBySize(terms, minimum / 100);
    const groupCount = parseTermGroups(value).groups.length;
    rebuilt = {
      text:
        `Rebuilt${keyframes.length > 1 ? ` the keyframe at ${keyframe.time} ms` : ""}:  ` +
        `${groupCount} groups of at least ${minimum}%, except maybe the last.`,
      warning: false,
    };
    show();
    keyframe.value = value;
    // Saves, redraws, and rebuilds the properties, which restarts this panel.  Undo works.
    api.propertyChanged(component.termGroupsSchedule);
  }

  /** The Minimum box, the Rebuild button, and what the last rebuild did.  Built once per start(), not every frame. */
  function rebuildTools(api: EditorPanelAPI): HTMLDivElement {
    const tools = document.createElement("div");
    tools.style.cssText =
      "font-size:0.9em;margin-top:0.4em;padding-top:0.4em;border-top:1px solid #ccd";
    const label = document.createElement("label");
    label.append("Groups of at least ");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.5";
    input.value = minimumText;
    input.style.width = "4.5em";
    input.addEventListener("input", () => {
      minimumText = input.value;
    });
    label.append(input, "%  ");
    const button = document.createElement("button");
    button.textContent = "Rebuild Term Groups";
    button.title =
      "Replaces Term Groups at the playhead.  From the largest term down, each group gets terms " +
      "until it has at least this much of the total amplitude.  The last group gets what's left.  Undo works.";
    const result = document.createElement("div");
    const show = () => {
      result.textContent = rebuilt?.text ?? "";
      result.style.color = rebuilt?.warning ? "#a06000" : "#555";
    };
    show();
    const click = () => rebuild(api, show);
    button.addEventListener("click", click);
    input.addEventListener("keydown", (event) => {
      if (event.key == "Enter") {
        click();
      }
    });
    tools.append(label, button, result);
    return tools;
  }

  function row(label: string, value: string): HTMLDivElement {
    const line = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = `${label}:  `;
    name.style.color = "#555";
    line.append(name, value);
    return line;
  }

  /** Like the table in "Will it Fourier?". */
  function sharesTable(shares: NonNullable<StepReport["shares"]>) {
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;margin:0.2em 0";
    const tableRow = (cells: readonly string[], header = false) => {
      const tr = table.insertRow();
      cells.forEach((text, column) => {
        const cell = document.createElement(
          header || column == 0 ? "th" : "td",
        );
        cell.textContent = text;
        cell.style.cssText = `padding:0 0.8em 0 0;font-weight:normal;text-align:${column == 0 ? "left" : "right"};color:${header || column == 0 ? "#555" : "inherit"}`;
        tr.append(cell);
      });
    };
    tableRow(["", "Terms", "Amplitude"], true);
    const line = (label: string, { count, amplitude }: TermShare) =>
      tableRow([label, String(count), percent(amplitude)]);
    line("In", shares.in);
    if (shares.adding) {
      line("Adding", shares.adding);
    }
    line("Left", shares.left);
    return table;
  }

  function refresh() {
    if (!editor || !legend || !body) {
      return;
    }
    const api = editor;
    const timeInMs = api.getTimeMs();
    legend.textContent = `At the playhead:  ${(timeInMs / 1000).toFixed(2)} s`;
    const report = describeStep(
      component.termGroupsSchedule.at(timeInMs),
      component.stepSchedule.at(timeInMs),
      component.fourierTermsAt(timeInMs),
    );
    const fix = stepFix(component);
    const key = JSON.stringify([report, fix?.keyframe.value, fix?.to]);
    if (key == shown) {
      return;
    }
    shown = key;
    const lines: HTMLElement[] = [
      row("Step", report.step),
      row("Terms", report.terms),
    ];
    if (report.adding !== undefined) {
      lines.push(row("Adding", report.adding));
    }
    if (report.shares) {
      lines.push(sharesTable(report.shares));
    }
    for (const warning of report.warnings) {
      const line = document.createElement("div");
      line.textContent = `⚠ ${warning}`;
      line.style.color = "#a06000";
      lines.push(line);
    }
    if (fix) {
      const button = document.createElement("button");
      button.textContent = `Make Step end at ${fix.to}, not ${fix.keyframe.value}`;
      button.title =
        "Sets the last Step keyframe to the number of groups.  Undo works.";
      button.addEventListener("click", () => {
        fix.keyframe.value = fix.to;
        // Saves, redraws, and rebuilds the properties, which restarts this panel.
        api.propertyChanged(component.stepSchedule);
      });
      lines.push(button);
    }
    body.replaceChildren(...lines);
  }

  return {
    start(api) {
      editor = api;
      shown = "";
      const panel = document.createElement("fieldset");
      panel.style.cssText = "border-color:#6a7fae;margin-bottom:0.4em";
      legend = document.createElement("legend");
      body = document.createElement("div");
      // Selectable, so a list of terms can be copied into Term Groups.
      body.style.cssText =
        "font-size:0.9em;line-height:1.4;user-select:text;font-variant-numeric:tabular-nums";
      panel.append(legend, body, rebuildTools(api));
      refresh();
      return panel;
    },
    suspend() {
      editor = undefined;
      legend = undefined;
      body = undefined;
    },
    update: refresh,
    // Step changes with time, and so can Term Groups and the source.
    timeChanged: refresh,
  };
}

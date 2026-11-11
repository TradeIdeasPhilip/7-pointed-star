/**
 * Star Circuit's own panel in the Visual Editor, bottom right, with its properties.
 *
 * It says where the Fourier animation is at the playhead:  Step, rounded, and the terms that means.
 * The terms are in the Term Groups format, like "2 7-11", so they can be copied back into that field.
 *
 * This is library 0.7.3's `Showable.editorPanel`.  See `development-plans/editor-panels.md`.
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import {
  type EditorPanel,
  type EditorPanelAPI,
  parseTermGroups,
} from "canvas-recorder-lib";
import { coloredSource } from "./colored-fourier.ts";
import type { StarCircuit } from "./star-circuit.ts";

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

/** What Step means at one moment.  See {@link describeStep}. */
export type StepReport = {
  /** Step rounded to 2 places, and the number of groups:  "2.47 of 11".  Or why nothing is drawn. */
  readonly step: string;
  /** The terms all the way in, in the Term Groups format, or "none". */
  readonly terms: string;
  /** The terms coming in now, which group they are, and how far along:  "2 7-11  (group 3, 47%)".  Only during a change. */
  readonly adding?: string;
  /** Things to fix, like terms that don't exist. */
  readonly warnings: readonly string[];
};

/**
 * Which terms Step means:  the ones all the way in, and the ones coming in.
 * The same arithmetic as `ColoredAnimations.frameAt()`, `orderTerms()` and the library's FourierComponent.
 * A repeated term only counts the first time.  A term past the end is left out of the lists, and listed in a warning instead.
 *
 * Pure.
 * @param termGroups The Term Groups field.
 * @param step The Step field.
 * @param termCount How many terms the source has.  `undefined` when that's not known, like when the circuit doesn't parse.
 */
export function describeStep(
  termGroups: string,
  step: number,
  termCount: number | undefined,
): StepReport {
  const { groups } = parseTermGroups(termGroups);
  const groupCount = groups.length;
  const rounded = step.toFixed(2);
  if (!(step >= 0)) {
    return { step: `${rounded}, so hidden`, terms: "none", warnings: [] };
  }
  if (groupCount == 0) {
    return {
      step: rounded,
      terms: "none",
      warnings: ["Term Groups is empty, so nothing is drawn."],
    };
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

  const fullGroups = progress == 1 ? groupCount : index;
  const done = groups.slice(0, fullGroups).flatMap(take);
  let adding: string | undefined;
  if (progress > 0 && progress < 1) {
    adding = `${formatTerms(take(groups[index]))}  (group ${index + 1}, ${Math.round(progress * 100)}%)`;
  }

  let stepText = `${rounded} of ${groupCount}`;
  if (step > groupCount) {
    stepText += ", past the end, so finished";
  } else if (step == groupCount) {
    stepText += ", finished";
  }

  const warnings: string[] = [];
  if (missing.length > 0 && termCount !== undefined) {
    warnings.push(
      `Not in this circuit:  ${formatTerms(missing)}.  ` +
        (termCount == 0
          ? "It has no terms."
          : termCount == 1
            ? "It has 1 term, 0."
            : `It has ${termCount} terms, 0-${termCount - 1}.`),
    );
  }
  if (termCount === undefined) {
    warnings.push(
      "The circuit doesn't parse, so these terms can't be checked.",
    );
  }
  return { step: stepText, terms: formatTerms(done), adding, warnings };
}

// MARK: The panel

/** One panel object for the life of `component`.  No DOM until `start()`. */
export function starCircuitPanel(component: StarCircuit): EditorPanel {
  let editor: EditorPanelAPI | undefined;
  let legend: HTMLLegendElement | undefined;
  let body: HTMLDivElement | undefined;
  /** What the body shows now, so a frame that changes nothing doesn't touch it. */
  let shown = "";

  function row(label: string, value: string): HTMLDivElement {
    const line = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = `${label}:  `;
    name.style.color = "#555";
    line.append(name, value);
    return line;
  }

  function refresh() {
    if (!editor || !legend || !body) {
      return;
    }
    const timeInMs = editor.getTimeMs();
    legend.textContent = `At the playhead:  ${(timeInMs / 1000).toFixed(2)} s`;
    const circuit = component.circuitAt(timeInMs);
    const report = describeStep(
      component.termGroupsSchedule.at(timeInMs),
      component.stepSchedule.at(timeInMs),
      typeof circuit == "string"
        ? undefined
        : coloredSource(circuit).terms.length,
    );
    const key = JSON.stringify(report);
    if (key == shown) {
      return;
    }
    shown = key;
    const lines = [row("Step", report.step), row("Terms", report.terms)];
    if (report.adding !== undefined) {
      lines.push(row("Adding", report.adding));
    }
    for (const warning of report.warnings) {
      const line = document.createElement("div");
      line.textContent = `⚠ ${warning}`;
      line.style.color = "#a06000";
      lines.push(line);
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
      panel.append(legend, body);
      refresh();
      return panel;
    },
    suspend() {
      editor = undefined;
      legend = undefined;
      body = undefined;
    },
    update: refresh,
    // Step changes with time, and so can Term Groups and the circuit.
    timeChanged: refresh,
  };
}

/**
 * Quick and dirty panels:  plain buttons that run a script on one component, usually a scene.
 *
 * HyperCard's idea:  the library's Visual Editor is the standard part, and these are the plain text buttons.
 * For scripts written for one slide or template, a little too long to type on the console.
 * Plain on purpose.  See "Quick and dirty panels" in `development-plans/editor-panels.md`.
 *
 * A button's change saves, redraws and becomes one undo step, like any edit in the Visual Editor.
 * The panel shows with the component's properties, bottom right:  choose the scene in the Edit list,
 * or click its row at the top of the component list.
 *
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import {
  canvasRecorder,
  type EditorPanel,
  type EditorPanelAPI,
  type Showable,
} from "canvas-recorder-lib";

/** One button, and what it does. */
export type ScriptButton<T extends Showable> = {
  readonly label: string;
  /** Shown when the mouse is over the button. */
  readonly title?: string;
  /** A text box next to the button, whose value goes to {@link run}. */
  readonly argument?: {
    readonly initial?: string;
    readonly placeholder?: string;
  };
  /**
   * Do it.  It may throw, and the message goes on the result line.
   * Change values only:  the panel saves with `refreshGUI("properties")`, which doesn't see new or removed components.
   * @param argument The text box's value, or "" when there's no text box.
   * @returns What to say on the result line.  Nothing says "Done."
   */
  run(component: T, argument: string): string | void;
};

/** Everything a script panel shows. */
export type ScriptPanelOptions<T extends Showable> = {
  /** The legend. */
  readonly title: string;
  /**
   * A line above the buttons, read again after every edit, like "8 Star Circuits ✓".
   * Say here when the buttons can't work, e.g. the scene doesn't have the components they expect.
   * It may throw:  the message is shown instead.
   */
  readonly status?: (component: T) => string;
  readonly buttons: readonly ScriptButton<T>[];
};

/** A message from anything thrown. */
function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * One panel object for the life of `component`.  No DOM until `start()`.
 *
 * Each click rebuilds the properties, which restarts the panel.
 * So the result line and the text boxes' values live here, not only in the DOM.
 */
function scriptPanel<T extends Showable>(
  component: T,
  { title, status, buttons }: ScriptPanelOptions<T>,
): EditorPanel {
  let editor: EditorPanelAPI | undefined;
  let statusLine: HTMLDivElement | undefined;
  let resultLine: HTMLDivElement | undefined;
  /** The last button's result. */
  let result: { readonly text: string; readonly failed: boolean } | undefined;
  /** Each button's text box value, by index. */
  const argumentValues = buttons.map(({ argument }) => argument?.initial ?? "");

  function showStatus() {
    if (!statusLine || !status) {
      return;
    }
    let text: string;
    try {
      text = status(component);
    } catch (reason) {
      text = `✗ ${messageFrom(reason)}`;
    }
    if (statusLine.textContent != text) {
      statusLine.textContent = text;
    }
  }

  function showResult() {
    if (!resultLine) {
      return;
    }
    resultLine.hidden = !result;
    resultLine.textContent = result?.text ?? "";
    resultLine.style.color = result?.failed ? "#b00" : "#070";
  }

  function click(index: number) {
    const api = editor;
    const button = buttons[index];
    try {
      const said = button.run(component, argumentValues[index]);
      result = { text: said || `${button.label}:  done.`, failed: false };
    } catch (reason) {
      result = { text: `✗ ${messageFrom(reason)}`, failed: true };
      // Nothing changed, so there's nothing to save.
      showResult();
      return;
    }
    // Saves, redraws, and rebuilds the properties, which restarts this panel.
    api?.refreshGUI("properties");
    showResult();
  }

  return {
    start(api) {
      editor = api;
      const panel = document.createElement("fieldset");
      panel.style.cssText = "border-color:#6a7fae;margin-bottom:0.4em";
      const legend = document.createElement("legend");
      legend.textContent = title;
      panel.append(legend);
      if (status) {
        statusLine = document.createElement("div");
        statusLine.style.cssText = "font-size:0.9em;color:#555";
        panel.append(statusLine);
        showStatus();
      }
      buttons.forEach((button, index) => {
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;gap:0.4em;align-items:center;margin-top:0.3em";
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = button.label;
        if (button.title) {
          element.title = button.title;
        }
        element.addEventListener("click", () => click(index));
        row.append(element);
        if (button.argument) {
          const input = document.createElement("input");
          input.value = argumentValues[index];
          input.placeholder = button.argument.placeholder ?? "";
          input.style.cssText = "flex:1;min-width:0";
          input.addEventListener("input", () => {
            argumentValues[index] = input.value;
          });
          // Enter is the same as the button.
          input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
              click(index);
            }
          });
          row.append(input);
        }
        panel.append(row);
      });
      resultLine = document.createElement("div");
      resultLine.style.cssText =
        "font-size:0.9em;margin-top:0.3em;user-select:text";
      panel.append(resultLine);
      showResult();
      return panel;
    },
    suspend() {
      editor = undefined;
      statusLine = undefined;
      resultLine = undefined;
    },
    // After every edit, which can change what the scene holds.
    update: showStatus,
  };
}

/**
 * Show a panel of buttons with `component`'s properties, and only that component's.
 *
 * A copy of the component, like a pasted scene, doesn't get the panel.  The console commands still work there.
 */
export function addScriptPanel<T extends Showable>(
  component: T,
  options: ScriptPanelOptions<T>,
) {
  const panel = scriptPanel(component, options);
  // The library asks once for each component, so this only builds one panel.
  canvasRecorder.addEditorPanel((candidate) =>
    candidate === component ? panel : undefined,
  );
}

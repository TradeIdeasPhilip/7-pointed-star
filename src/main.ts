/**
 * Every video in this project, and a way to choose one.
 *
 * The page's `?toShow=` parameter says which video to show.
 * Without one, or with one that isn't listed, the page shows a menu.
 * canvas-recorder had this built in.  In canvas-recorder-lib, `canvasRecorder.start()` takes
 * one Showable, so the choosing happens here.
 *
 * Each video's code only loads when that video is chosen.  So a video can set
 * `canvasRecorder.size` at the top of its own module, and it won't affect the others.
 * @module
 */

import type { Showable } from "canvas-recorder-lib";

type VideoOption = {
  /** For the menu, and the browser tab. */
  readonly title: string;
  /** For the menu. */
  readonly description: string;
  create(): Promise<Showable>;
};

/**
 * The keys are the `?toShow=` values, and the `name` given to `canvasRecorder.start()`.
 * So a key also names that video's saved work, and its files in `properties/`.
 * Changing a key makes the editor forget that video's saved work.
 */
const VIDEOS: ReadonlyMap<string, VideoOption> = new Map([
  [
    "7-pointed-star",
    {
      title: "✶ 7 Pointed Star",
      description: "The main video.  16:9.",
      async create() {
        return (await import("./full-video.ts")).fullVideo;
      },
    },
  ],
  [
    "7-pointed-star-shorts",
    {
      title: "✶ 7 Pointed Star Shorts",
      description: "Previews of the main video, for YouTube Shorts.  9:16.",
      async create() {
        return (await import("./shorts.ts")).shorts;
      },
    },
  ],
]);

/** Replace the page with a link to each video. */
function showMenu() {
  const heading = document.createElement("h1");
  heading.textContent = "Select a video";
  const list = document.createElement("ul");
  for (const [name, { title, description }] of VIDEOS) {
    const url = new URL(location.href);
    url.searchParams.set("toShow", name);
    const link = document.createElement("a");
    link.href = url.href;
    link.textContent = title;
    // A new tab starts with empty sessionStorage.  The player keeps its place there, not by video,
    // so in the same tab the next video would open at the last one's chapter and time.
    // And two tabs are handy for copying from one video to the other.
    link.target = "_blank";
    const item = document.createElement("li");
    item.append(link, ` — ${description}`);
    list.append(item);
  }
  document.body.replaceChildren(heading, list);
}

/** Replace the page with the player, showing this video. */
async function startVideo(name: string, video: VideoOption) {
  document.title = video.title;
  const [showable, { canvasRecorder }] = await Promise.all([
    video.create(),
    import("canvas-recorder-lib"),
  ]);
  // Don't await this.  See canvasRecorder.start().
  canvasRecorder.start(showable, { name });
}

const name = new URLSearchParams(location.search).get("toShow");
const video = name === null ? undefined : VIDEOS.get(name);
if (name !== null && video) {
  void startVideo(name, video);
} else {
  showMenu();
}

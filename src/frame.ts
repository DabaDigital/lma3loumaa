/** A scroll-driven effect's work for one frame: `read` measures the page,
 * `write` updates it. */
export type FrameTask = {
  read: () => void;
  write: (time: number) => void;
};

const queued = new Set<FrameTask>();
let frame = 0;

// The hero, the menu stage and the reels all follow the scroll. Sharing one
// animation frame runs every read before any write, so no effect forces the
// browser to lay the page out again right after another one changed it.
function run(time: number) {
  frame = 0;
  const tasks = [...queued];
  queued.clear();
  for (const task of tasks) task.read();
  for (const task of tasks) task.write(time);
}

/** Runs the task in the next shared frame. A task requested again from its
 * own `write` runs in the frame after. */
export function requestFrame(task: FrameTask) {
  queued.add(task);
  if (!frame) frame = requestAnimationFrame(run);
}

export function cancelFrame(task: FrameTask) {
  queued.delete(task);
  if (!queued.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

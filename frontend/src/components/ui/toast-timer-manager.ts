export type ToastTimerManager = {
  schedule: (id: string, callback: () => void, delay: number) => void;
  cancel: (id: string) => void;
  dispose: () => void;
};

export function createToastTimerManager<Timer>(
  setTimer: (callback: () => void, delay: number) => Timer,
  clearTimer: (timer: Timer) => void,
): ToastTimerManager {
  const timers = new Map<string, Timer>();

  return {
    schedule(id, callback, delay) {
      const previous = timers.get(id);
      if (previous !== undefined) clearTimer(previous);

      const timer = setTimer(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.set(id, timer);
    },
    cancel(id) {
      const timer = timers.get(id);
      if (timer !== undefined) clearTimer(timer);
      timers.delete(id);
    },
    dispose() {
      for (const timer of timers.values()) clearTimer(timer);
      timers.clear();
    },
  };
}

export function dispatchActivitySync(
  schedule: (task: () => Promise<void>) => void,
  task: () => Promise<void>,
) {
  schedule(async () => {
    try {
      await task();
    } catch (error) {
      console.error("Activity sync failed", error);
    }
  });
}

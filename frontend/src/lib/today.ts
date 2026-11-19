import { createSignal, onCleanup, onMount } from "solid-js";
import { todayIso } from "./dates";

export function createToday() {
  const [today, setToday] = createSignal(todayIso());

  onMount(() => {
    const refresh = () => setToday(todayIso());
    const onVisibility = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    onCleanup(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    });
  });

  return today;
}

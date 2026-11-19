import { For, onCleanup, onMount, Show } from "solid-js";
import type { Occurrence } from "../api";
import { formatIsoDate, isoDate } from "../lib/dates";
import { formatMinor } from "../lib/money";
import { occurrenceTileStatus, tileStatusLabel } from "./CalendarGrid";

interface DayDialogProps {
  date: Date;
  today: string;
  occurrences: Occurrence[];
  currency: string;
  onClose: () => void;
  onSelectOccurrence: (occurrence: Occurrence) => void;
  onAdd: () => void;
}

export function DayDialog(props: DayDialogProps) {
  let dialog: HTMLDialogElement | undefined;
  const dateIso = () => isoDate(props.date);

  onMount(() => {
    dialog?.showModal();
  });

  onCleanup(() => {
    if (dialog?.open) {
      dialog.close();
    }
  });

  return (
    <dialog
      ref={dialog}
      class="modal"
      aria-labelledby="day-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          props.onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === dialog) {
          props.onClose();
        }
      }}
    >
      <section class="modal-panel">
        <header class="modal-head">
          <div>
            <p class="eyebrow">Day</p>
            <h2 id="day-title">{formatIsoDate(dateIso())}</h2>
          </div>
          <button
            type="button"
            class="icon-button"
            onClick={props.onClose}
            aria-label="Close day dialog"
          >
            ×
          </button>
        </header>

        <Show
          when={props.occurrences.length > 0}
          fallback={<p class="muted">Nothing is due on this day.</p>}
        >
          <ul class="day-list">
            <For each={props.occurrences}>
              {(occurrence) => {
                const status = () =>
                  occurrenceTileStatus(occurrence, props.today);

                return (
                  <li>
                    <button
                      type="button"
                      class="day-list-item"
                      onClick={() => props.onSelectOccurrence(occurrence)}
                    >
                      <span
                        class={`status-dot status-${status()}`}
                        aria-hidden="true"
                      />
                      <span class="day-list-main">
                        <span class="day-list-name">{occurrence.billName}</span>
                        <span class="muted">
                          {formatMinor(occurrence.amountMinor, props.currency)}
                        </span>
                      </span>
                      <span class="status-pill">
                        {tileStatusLabel(status())}
                      </span>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>

        <footer class="modal-actions">
          <button type="button" class="button ghost" onClick={props.onClose}>
            Close
          </button>
          <button type="button" class="button primary" onClick={props.onAdd}>
            Add bill for this day
          </button>
        </footer>
      </section>
    </dialog>
  );
}

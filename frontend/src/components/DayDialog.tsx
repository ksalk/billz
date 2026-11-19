import { Index, onCleanup, onMount, Show } from "solid-js";
import type { Occurrence, OccurrenceStatus } from "../api";
import { formatIsoDate, isoDate } from "../lib/dates";
import { formatMinor } from "../lib/money";
import {
  occurrenceActionLabel,
  occurrenceTileStatus,
  tileStatusLabel,
} from "./CalendarGrid";

interface DayDialogProps {
  date: Date;
  today: string;
  occurrences: Occurrence[];
  currency: string;
  busyKey: string | null;
  locked: boolean;
  actionError: string | null;
  actionNotice: string;
  onDismissError: () => void;
  onClose: () => void;
  onSetStatus: (occurrence: Occurrence, status: OccurrenceStatus) => void;
  onShowDetails: (occurrence: Occurrence) => void;
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
        <p class="sr-only" role="status">
          {props.actionNotice}
        </p>

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

        <Show when={props.actionError}>
          <div class="form-error dialog-error" role="alert">
            <span>{props.actionError}</span>
            <button
              type="button"
              class="text-button"
              onClick={props.onDismissError}
            >
              Dismiss
            </button>
          </div>
        </Show>

        <Show
          when={props.occurrences.length > 0}
          fallback={<p class="muted">Nothing is due on this day.</p>}
        >
          <ul class="day-list">
            <Index each={props.occurrences}>
              {(item) => {
                const occurrence = item;
                const status = () =>
                  occurrenceTileStatus(occurrence(), props.today);
                const busy = () =>
                  props.busyKey ===
                  `${occurrence().billId}:${occurrence().dueDate}`;
                const unavailable = () => props.locked || busy();
                const choose = (target: "paid" | "skipped") => {
                  if (!unavailable() && occurrence().status === "pending") {
                    props.onSetStatus(occurrence(), target);
                  }
                };
                const statusTitle = (target: "paid" | "skipped") => {
                  if (occurrence().status === target) {
                    return `Already marked ${target}`;
                  }

                  if (occurrence().status !== "pending") {
                    return "Reset first to change status";
                  }

                  return undefined;
                };
                const reset = () => {
                  if (!unavailable()) {
                    props.onSetStatus(occurrence(), "pending");
                  }
                };

                return (
                  <li
                    class="day-list-item"
                    aria-busy={busy() ? "true" : undefined}
                  >
                    <span
                      class={`status-dot status-${status()}`}
                      aria-hidden="true"
                    />
                    <span class="day-list-main">
                      <span class="day-list-name">{occurrence().billName}</span>
                      <span class="muted">
                        {formatMinor(occurrence().amountMinor, props.currency)}
                      </span>
                    </span>
                    <span class="status-pill">{tileStatusLabel(status())}</span>
                    <div class="day-list-actions">
                      <button
                        type="button"
                        class="button compact"
                        classList={{
                          "is-active": occurrence().status === "paid",
                        }}
                        aria-pressed={occurrence().status === "paid"}
                        aria-label={occurrenceActionLabel(occurrence(), "paid")}
                        title={statusTitle("paid")}
                        aria-disabled={
                          unavailable() || occurrence().status !== "pending"
                            ? "true"
                            : undefined
                        }
                        onClick={() => choose("paid")}
                      >
                        Paid
                      </button>
                      <button
                        type="button"
                        class="button compact"
                        classList={{
                          "is-active": occurrence().status === "skipped",
                        }}
                        aria-pressed={occurrence().status === "skipped"}
                        aria-label={occurrenceActionLabel(
                          occurrence(),
                          "skipped",
                        )}
                        title={statusTitle("skipped")}
                        aria-disabled={
                          unavailable() || occurrence().status !== "pending"
                            ? "true"
                            : undefined
                        }
                        onClick={() => choose("skipped")}
                      >
                        Skipped
                      </button>
                      <Show when={occurrence().status !== "pending"}>
                        <button
                          type="button"
                          class="button ghost compact"
                          aria-label={`Reset ${occurrence().billName} due ${formatIsoDate(
                            occurrence().dueDate,
                          )} to pending`}
                          aria-disabled={unavailable() ? "true" : undefined}
                          onClick={reset}
                        >
                          Reset
                        </button>
                      </Show>
                      <button
                        type="button"
                        class="button ghost compact"
                        aria-label={`Details for ${occurrence().billName} due ${formatIsoDate(
                          occurrence().dueDate,
                        )}`}
                        aria-disabled={unavailable() ? "true" : undefined}
                        onClick={() => {
                          if (!unavailable()) {
                            props.onShowDetails(occurrence());
                          }
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </li>
                );
              }}
            </Index>
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

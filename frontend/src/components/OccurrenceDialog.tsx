import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  ApiError,
  type Occurrence,
  type OccurrenceStatus,
  resetOccurrence,
  saveOccurrence,
} from "../api";
import { formatIsoDate, todayIso } from "../lib/dates";
import { formatMinor, minorToInput, parseAmountToMinor } from "../lib/money";

interface OccurrenceDialogProps {
  occurrence: Occurrence;
  currency: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onSaveFailed?: () => void;
}

const STATUS_OPTIONS: Array<{ value: OccurrenceStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "skipped", label: "Skipped" },
];

export function OccurrenceDialog(props: OccurrenceDialogProps) {
  let dialog: HTMLDialogElement | undefined;
  const [status, setStatus] = createSignal<OccurrenceStatus>(
    props.occurrence.status,
  );
  const [paidOn, setPaidOn] = createSignal(
    props.occurrence.paidOn ?? todayIso(),
  );
  const [amount, setAmount] = createSignal(
    minorToInput(
      props.occurrence.amountPaidMinor ?? props.occurrence.amountMinor,
      props.currency,
    ),
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>(
    {},
  );
  const generalErrors = () =>
    Object.entries(fieldErrors())
      .filter(([field]) => field !== "paidOn" && field !== "amountMinor")
      .flatMap(([, messages]) => messages);

  onMount(() => {
    dialog?.showModal();
  });

  onCleanup(() => {
    if (dialog?.open) {
      dialog.close();
    }
  });

  function close() {
    if (!saving()) {
      props.onClose();
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();

    if (saving()) {
      return;
    }

    setError(null);
    setFieldErrors({});
    setSaving(true);

    try {
      if (status() === "pending") {
        if (props.occurrence.status !== "pending") {
          await resetOccurrence(
            props.occurrence.billId,
            props.occurrence.dueDate,
          );
        }
      } else if (status() === "paid") {
        if (!paidOn()) {
          setFieldErrors({ paidOn: ["Paid date is required."] });
          return;
        }

        const amountMinor = parseAmountToMinor(amount(), props.currency);

        if (amountMinor === null) {
          setFieldErrors({
            amountMinor: ["Enter an amount with up to two decimals."],
          });
          return;
        }

        await saveOccurrence(
          props.occurrence.billId,
          props.occurrence.dueDate,
          {
            status: "paid",
            paidOn: paidOn(),
            amountMinor,
          },
        );
      } else {
        await saveOccurrence(
          props.occurrence.billId,
          props.occurrence.dueDate,
          {
            status: "skipped",
          },
        );
      }

      await props.onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status < 500) {
        setError(caught.message);
        setFieldErrors(caught.errors ?? {});
      } else {
        props.onSaveFailed?.();
        setError(
          "Could not confirm this payment. Check the calendar before retrying.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      class="modal"
      aria-labelledby="occurrence-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      onClick={(event) => {
        if (event.target === dialog) {
          close();
        }
      }}
    >
      <form class="modal-panel" onSubmit={submit}>
        <header class="modal-head">
          <div>
            <p class="eyebrow">Payment</p>
            <h2 id="occurrence-title">{props.occurrence.billName}</h2>
            <p class="muted">
              Due {formatIsoDate(props.occurrence.dueDate)} ·{" "}
              {formatMinor(props.occurrence.amountMinor, props.currency)}
            </p>
          </div>
          <button
            type="button"
            class="icon-button"
            onClick={close}
            aria-label="Close payment dialog"
          >
            ×
          </button>
        </header>

        <fieldset class="status-fieldset">
          <legend>Status</legend>
          <div class="segmented">
            <For each={STATUS_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  classList={{ "is-active": status() === option.value }}
                  aria-pressed={status() === option.value}
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </fieldset>

        <Show when={status() === "paid"}>
          <div class="field-row">
            <label class="field">
              <span>Paid on</span>
              <input
                type="date"
                value={paidOn()}
                onInput={(event) => setPaidOn(event.currentTarget.value)}
              />
              <Show when={fieldErrors().paidOn?.length}>
                <span class="field-error" role="alert">
                  {fieldErrors().paidOn?.[0]}
                </span>
              </Show>
            </label>

            <label class="field">
              <span>Amount paid</span>
              <input
                type="text"
                inputmode="decimal"
                value={amount()}
                onInput={(event) => setAmount(event.currentTarget.value)}
              />
              <Show when={fieldErrors().amountMinor?.length}>
                <span class="field-error" role="alert">
                  {fieldErrors().amountMinor?.[0]}
                </span>
              </Show>
            </label>
          </div>
        </Show>

        <Show when={status() === "skipped"}>
          <p class="muted">
            This occurrence will be ignored and marked handled.
          </p>
        </Show>

        <Show when={status() === "pending"}>
          <p class="muted">
            Pending occurrences stay visible as due or overdue until handled.
          </p>
        </Show>

        <Show when={error()}>
          <p class="form-error" role="alert">
            {error()}
          </p>
        </Show>

        <Show when={generalErrors().length > 0}>
          <ul class="form-error" role="alert">
            <For each={generalErrors()}>{(message) => <li>{message}</li>}</For>
          </ul>
        </Show>

        <footer class="modal-actions">
          <button type="button" class="button ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" class="button primary" disabled={saving()}>
            {saving() ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

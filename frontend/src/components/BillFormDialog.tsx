import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  ApiError,
  type Bill,
  type BillFrequency,
  type BillInput,
  createBill,
  updateBill,
} from "../api";
import { todayIso } from "../lib/dates";
import { minorToInput, parseAmountToMinor } from "../lib/money";
import {
  CUSTOM_PRESET,
  FREQUENCY_PRESETS,
  presetByValue,
  presetFor,
} from "../lib/presets";
import { scheduleSummary } from "../lib/schedule";

interface BillFormDialogProps {
  bill: Bill | null;
  initialDate?: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}

const FREQUENCIES: Array<{ value: BillFrequency; label: string }> = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function BillFormDialog(props: BillFormDialogProps) {
  let dialog: HTMLDialogElement | undefined;
  const editing = () => props.bill !== null;
  const [name, setName] = createSignal(props.bill?.name ?? "");
  const [amount, setAmount] = createSignal(
    props.bill ? minorToInput(props.bill.amountMinor, props.currency) : "",
  );
  const [preset, setPreset] = createSignal(
    props.bill
      ? presetFor(props.bill.frequency, props.bill.interval)
      : "monthly",
  );
  const [frequency, setFrequency] = createSignal<BillFrequency>(
    props.bill?.frequency ?? "monthly",
  );
  const [interval, setInterval] = createSignal(props.bill?.interval ?? 1);
  const [startDate, setStartDate] = createSignal(
    props.bill?.startDate ?? props.initialDate ?? todayIso(),
  );
  const [endDate, setEndDate] = createSignal(props.bill?.endDate ?? "");
  const [category, setCategory] = createSignal(props.bill?.category ?? "");
  const [notes, setNotes] = createSignal(props.bill?.notes ?? "");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string[]>>(
    {},
  );

  const preview = () => {
    const intervalValue = Number(interval());

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate()) ||
      !Number.isInteger(intervalValue) ||
      intervalValue < 1 ||
      intervalValue > 60
    ) {
      return null;
    }

    try {
      return scheduleSummary({
        frequency: frequency(),
        interval: intervalValue,
        startDate: startDate(),
      });
    } catch {
      return null;
    }
  };

  const hasError = (field: string) => Boolean(fieldErrors()[field]?.length);
  const errorId = (field: string) => `bill-${field}-error`;
  const describedBy = (field: string) =>
    hasError(field) ? errorId(field) : undefined;

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

  function choosePreset(value: string) {
    setPreset(value);
    const chosen = presetByValue(value);

    if (chosen) {
      setFrequency(chosen.frequency);
      setInterval(chosen.interval);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();

    if (saving()) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const errors: Record<string, string[]> = {};
    const trimmedName = name().trim();
    const amountMinor = parseAmountToMinor(amount(), props.currency);
    const intervalValue = Number(interval());
    const trimmedCategory = category().trim();
    const trimmedNotes = notes().trim();

    if (!trimmedName) {
      errors.name = ["Name is required."];
    } else if (trimmedName.length > 120) {
      errors.name = ["Name must be 120 characters or fewer."];
    }

    if (amountMinor === null) {
      errors.amountMinor = ["Enter a valid amount within the supported range."];
    }

    if (
      !Number.isInteger(intervalValue) ||
      intervalValue < 1 ||
      intervalValue > 60
    ) {
      errors.interval = ["Interval must be between 1 and 60."];
    }

    if (!startDate()) {
      errors.startDate = ["First due date is required."];
    }

    if (endDate() && startDate() && endDate() < startDate()) {
      errors.endDate = ["End date must not be before the first due date."];
    }

    if (trimmedCategory.length > 40) {
      errors.category = ["Category must be 40 characters or fewer."];
    }

    if (trimmedNotes.length > 2000) {
      errors.notes = ["Notes must be 2000 characters or fewer."];
    }

    if (Object.keys(errors).length > 0 || amountMinor === null) {
      setFieldErrors(errors);
      return;
    }

    const input: BillInput = {
      name: trimmedName,
      amountMinor,
      frequency: frequency(),
      interval: intervalValue,
      startDate: startDate(),
      endDate: endDate() || null,
      category: trimmedCategory || null,
      notes: trimmedNotes || null,
    };

    setSaving(true);

    try {
      if (props.bill) {
        await updateBill(props.bill.id, input);
      } else {
        await createBill(input);
      }

      props.onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors ?? {});
      } else {
        setError("Could not save this bill. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const generalErrors = () =>
    Object.entries(fieldErrors())
      .filter(
        ([field]) =>
          ![
            "name",
            "amountMinor",
            "interval",
            "startDate",
            "endDate",
            "category",
            "notes",
          ].includes(field),
      )
      .flatMap(([, messages]) => messages);

  return (
    <dialog
      ref={dialog}
      class="modal bill-form-modal"
      aria-labelledby="bill-form-title"
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
            <p class="eyebrow">{editing() ? "Edit bill" : "New bill"}</p>
            <h2 id="bill-form-title">
              {editing() ? props.bill?.name : "Add a bill"}
            </h2>
          </div>
          <button
            type="button"
            class="icon-button"
            onClick={close}
            aria-label="Close bill form"
          >
            ×
          </button>
        </header>

        <div class="form-grid">
          <label class="field field-wide">
            <span>Name</span>
            <input
              type="text"
              value={name()}
              maxlength={120}
              onInput={(event) => setName(event.currentTarget.value)}
              autofocus
              aria-invalid={hasError("name") ? "true" : undefined}
              aria-describedby={describedBy("name")}
            />
            <Show when={fieldErrors().name?.[0]}>
              <span class="field-error" role="alert" id={errorId("name")}>
                {fieldErrors().name?.[0]}
              </span>
            </Show>
          </label>

          <label class="field">
            <span>Amount ({props.currency})</span>
            <input
              type="text"
              inputmode="decimal"
              value={amount()}
              placeholder="0.00"
              onInput={(event) => setAmount(event.currentTarget.value)}
              aria-invalid={hasError("amountMinor") ? "true" : undefined}
              aria-describedby={describedBy("amountMinor")}
            />
            <Show when={fieldErrors().amountMinor?.[0]}>
              <span
                class="field-error"
                role="alert"
                id={errorId("amountMinor")}
              >
                {fieldErrors().amountMinor?.[0]}
              </span>
            </Show>
          </label>

          <label class="field">
            <span>Repeats</span>
            <select
              value={preset()}
              onChange={(event) => choosePreset(event.currentTarget.value)}
            >
              <For each={FREQUENCY_PRESETS}>
                {(option) => (
                  <option value={option.value}>{option.label}</option>
                )}
              </For>
              <option value={CUSTOM_PRESET}>Custom…</option>
            </select>
          </label>

          <Show when={preset() === CUSTOM_PRESET}>
            <label class="field">
              <span>Frequency</span>
              <select
                value={frequency()}
                onChange={(event) =>
                  setFrequency(event.currentTarget.value as BillFrequency)
                }
              >
                <For each={FREQUENCIES}>
                  {(option) => (
                    <option value={option.value}>{option.label}</option>
                  )}
                </For>
              </select>
            </label>

            <label class="field">
              <span>Every N periods</span>
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={interval()}
                onInput={(event) =>
                  setInterval(Number(event.currentTarget.value))
                }
                aria-invalid={hasError("interval") ? "true" : undefined}
                aria-describedby={describedBy("interval")}
              />
              <Show when={fieldErrors().interval?.[0]}>
                <span class="field-error" role="alert" id={errorId("interval")}>
                  {fieldErrors().interval?.[0]}
                </span>
              </Show>
            </label>
          </Show>

          <label class="field">
            <span>First due date</span>
            <input
              type="date"
              value={startDate()}
              onInput={(event) => setStartDate(event.currentTarget.value)}
              aria-invalid={hasError("startDate") ? "true" : undefined}
              aria-describedby={describedBy("startDate")}
            />
            <Show when={fieldErrors().startDate?.[0]}>
              <span class="field-error" role="alert" id={errorId("startDate")}>
                {fieldErrors().startDate?.[0]}
              </span>
            </Show>
          </label>

          <label class="field">
            <span>End date (optional)</span>
            <input
              type="date"
              value={endDate()}
              onInput={(event) => setEndDate(event.currentTarget.value)}
              aria-invalid={hasError("endDate") ? "true" : undefined}
              aria-describedby={describedBy("endDate")}
            />
            <Show when={fieldErrors().endDate?.[0]}>
              <span class="field-error" role="alert" id={errorId("endDate")}>
                {fieldErrors().endDate?.[0]}
              </span>
            </Show>
          </label>

          <label class="field field-wide">
            <span>Category (optional)</span>
            <input
              type="text"
              value={category()}
              maxlength={40}
              onInput={(event) => setCategory(event.currentTarget.value)}
              aria-invalid={hasError("category") ? "true" : undefined}
              aria-describedby={describedBy("category")}
            />
            <Show when={fieldErrors().category?.[0]}>
              <span class="field-error" role="alert" id={errorId("category")}>
                {fieldErrors().category?.[0]}
              </span>
            </Show>
          </label>

          <label class="field field-wide">
            <span>Notes (optional)</span>
            <textarea
              value={notes()}
              maxlength={2000}
              onInput={(event) => setNotes(event.currentTarget.value)}
              aria-invalid={hasError("notes") ? "true" : undefined}
              aria-describedby={describedBy("notes")}
            />
            <Show when={fieldErrors().notes?.[0]}>
              <span class="field-error" role="alert" id={errorId("notes")}>
                {fieldErrors().notes?.[0]}
              </span>
            </Show>
          </label>
        </div>

        <p class="preview-line">
          <span>Schedule</span>
          {preview() ?? "Choose a valid first due date and interval."}
        </p>

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
            {saving() ? "Saving…" : editing() ? "Save changes" : "Add bill"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

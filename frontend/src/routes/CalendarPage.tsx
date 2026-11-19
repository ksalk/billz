import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, onCleanup, Show } from "solid-js";
import {
  ApiError,
  errorMessage,
  getConfig,
  getOccurrences,
  type Occurrence,
  type OccurrenceStatus,
  resetOccurrence,
  saveOccurrence,
} from "../api";
import { CalendarGrid } from "../components/CalendarGrid";
import { DayDialog } from "../components/DayDialog";
import { OccurrenceDialog } from "../components/OccurrenceDialog";
import {
  addMonths,
  calendarRange,
  formatIsoDate,
  isoDate,
  monthKey,
  monthLabel,
  startOfMonth,
  todayIso,
} from "../lib/dates";
import { createToday } from "../lib/today";

export default function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = createSignal(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = createSignal<Date | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] =
    createSignal<Occurrence | null>(null);
  const [actionKey, setActionKey] = createSignal<string | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [actionNotice, setActionNotice] = createSignal("");
  const [cooldown, setCooldown] = createSignal(false);
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;

  const locked = () => actionKey() !== null || cooldown();

  onCleanup(() => {
    if (cooldownTimer) {
      clearTimeout(cooldownTimer);
    }
  });

  const [config, { refetch: refetchConfig }] = createResource(0, getConfig);
  const [occurrences, { refetch }] = createResource(
    () => ({ key: monthKey(month()), range: calendarRange(month()) }),
    async (source) => ({
      key: source.key,
      items: await getOccurrences(source.range.from, source.range.to),
    }),
  );
  const currentItems = () => {
    const data = occurrences();
    return data?.key === monthKey(month()) ? data.items : undefined;
  };

  const today = createToday();
  const occurrencesForDay = (date: Date) => {
    const key = isoDate(date);
    return (currentItems() ?? []).filter((item) => item.dueDate === key);
  };

  const addForDay = (date: Date) => {
    navigate(`/bills?new=${isoDate(date)}`);
  };

  const openDay = (date: Date) => {
    setActionNotice("");
    setSelectedDay(date);
  };

  const occurrenceKey = (occurrence: Occurrence) =>
    `${occurrence.billId}:${occurrence.dueDate}`;

  const actionCooldownMs = 800;

  const setOccurrenceStatus = async (
    occurrence: Occurrence,
    status: OccurrenceStatus,
  ) => {
    if (locked() || occurrence.status === status) {
      return;
    }

    const key = occurrenceKey(occurrence);
    const dueDate = formatIsoDate(occurrence.dueDate);

    setActionError(null);
    setActionNotice("");
    setActionKey(key);

    try {
      if (status === "pending") {
        await resetOccurrence(occurrence.billId, occurrence.dueDate);
      } else if (status === "paid") {
        await saveOccurrence(occurrence.billId, occurrence.dueDate, {
          status: "paid",
          paidOn: todayIso(),
        });
      } else {
        await saveOccurrence(occurrence.billId, occurrence.dueDate, {
          status: "skipped",
        });
      }

      // Refetch instead of inventing client state. This keeps history rows and
      // schedule edits in sync and supersedes any older in-flight list fetch.
      await refetch();

      if (occurrences.error) {
        setSelectedDay(null);
        setSelectedOccurrence(null);
        setActionNotice(
          `${occurrence.billName} due ${dueDate} was saved, but the calendar could not refresh.`,
        );
      } else {
        setActionNotice(
          status === "paid"
            ? `${occurrence.billName} due ${dueDate} marked paid.`
            : status === "skipped"
              ? `${occurrence.billName} due ${dueDate} marked skipped.`
              : `${occurrence.billName} due ${dueDate} reset.`,
        );
      }

      if (status === "pending" && !occurrences.error) {
        const selector = selectedDay()
          ? '[aria-label="Close day dialog"]'
          : `[data-calendar-date="${occurrence.dueDate}"]`;

        setTimeout(() => {
          document.querySelector<HTMLElement>(selector)?.focus();
        }, 0);
      }

      setCooldown(true);
      cooldownTimer = setTimeout(() => setCooldown(false), actionCooldownMs);
    } catch (caught) {
      const detail =
        caught instanceof ApiError
          ? Object.values(caught.errors ?? {})
              .flat()
              .at(0)
          : undefined;

      setActionError(
        detail
          ? `${occurrence.billName} due ${dueDate}: ${detail}`
          : errorMessage(caught),
      );

      if (caught instanceof ApiError && caught.status < 500) {
        await refetch();
      }
    } finally {
      setActionKey(null);
    }
  };

  return (
    <section class="page">
      <Show when={!selectedDay()}>
        <p class="sr-only" role="status">
          {actionNotice()}
        </p>
      </Show>

      <header class="page-head">
        <div>
          <p class="eyebrow">Calendar</p>
          <h1>{monthLabel(month())}</h1>
        </div>

        <div class="page-actions">
          <fieldset class="month-controls" aria-label="Month navigation">
            <button
              type="button"
              class="icon-button"
              onClick={() => setMonth(addMonths(month(), -1))}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              class="button ghost"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </button>
            <button
              type="button"
              class="icon-button"
              onClick={() => setMonth(addMonths(month(), 1))}
              aria-label="Next month"
            >
              →
            </button>
          </fieldset>
          <A href={`/bills?new=${today()}`} class="button primary">
            Add bill
          </A>
        </div>
      </header>

      <Show when={actionError()}>
        <div class="error-card" role="alert">
          <strong>Could not update this payment.</strong>
          <p>{actionError()}</p>
          <button
            type="button"
            class="button ghost"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      </Show>

      <Show when={occurrences.error || config.error}>
        <div class="error-card" role="alert">
          <strong>Could not load the calendar.</strong>
          <p>{errorMessage(occurrences.error ?? config.error)}</p>
          <button
            type="button"
            class="button ghost"
            onClick={() => {
              void refetch();
              void refetchConfig();
            }}
          >
            Try again
          </button>
        </div>
      </Show>

      <Show when={!occurrences.error && !config.error}>
        <Show
          when={config()}
          fallback={<p class="loading-state">Loading calendar…</p>}
        >
          {(loadedConfig) => (
            <>
              <Show when={occurrences.loading && currentItems()}>
                <p class="muted" aria-live="polite">
                  Updating payments…
                </p>
              </Show>

              <Show
                when={currentItems()}
                fallback={<p class="loading-state">Loading payments…</p>}
              >
                {(items) => (
                  <CalendarGrid
                    month={month()}
                    today={today()}
                    occurrences={items()}
                    currency={loadedConfig().currency}
                    busyKey={actionKey()}
                    locked={locked()}
                    onSetStatus={(occurrence, status) => {
                      void setOccurrenceStatus(occurrence, status);
                    }}
                    onSelectDay={openDay}
                    onAddForDay={addForDay}
                  />
                )}
              </Show>

              <Show when={currentItems()?.length === 0}>
                <p class="empty-inline">
                  Nothing is due in this view.{" "}
                  <A href={`/bills?new=${today()}`}>Add a bill</A> to get
                  started.
                </p>
              </Show>

              <Show when={selectedDay()} keyed>
                {(day) => (
                  <DayDialog
                    date={day}
                    today={today()}
                    occurrences={occurrencesForDay(day)}
                    currency={loadedConfig().currency}
                    busyKey={actionKey()}
                    locked={locked()}
                    actionError={actionError()}
                    actionNotice={actionNotice()}
                    onDismissError={() => setActionError(null)}
                    onClose={() => {
                      setSelectedDay(null);
                      setActionNotice("");
                    }}
                    onSetStatus={(occurrence, status) => {
                      void setOccurrenceStatus(occurrence, status);
                    }}
                    onShowDetails={setSelectedOccurrence}
                    onAdd={() => {
                      setSelectedDay(null);
                      addForDay(day);
                    }}
                  />
                )}
              </Show>

              <Show when={selectedOccurrence()} keyed>
                {(occurrence) => (
                  <OccurrenceDialog
                    occurrence={occurrence}
                    currency={loadedConfig().currency}
                    onClose={() => setSelectedOccurrence(null)}
                    onSaved={async () => {
                      const dueDate = formatIsoDate(occurrence.dueDate);
                      setActionError(null);
                      setActionNotice("");
                      setActionKey(
                        `${occurrence.billId}:${occurrence.dueDate}`,
                      );

                      try {
                        await refetch();

                        setActionNotice(
                          occurrences.error
                            ? `${occurrence.billName} due ${dueDate} was saved, but the calendar could not refresh.`
                            : `${occurrence.billName} due ${dueDate} updated.`,
                        );
                        await new Promise((resolve) =>
                          setTimeout(resolve, 250),
                        );
                      } finally {
                        setActionKey(null);
                        setSelectedOccurrence(null);
                        setSelectedDay(null);
                      }
                    }}
                    onSaveFailed={() => {
                      void (async () => {
                        setActionKey(
                          `${occurrence.billId}:${occurrence.dueDate}`,
                        );

                        try {
                          await refetch();
                        } finally {
                          setActionKey(null);
                        }
                      })();
                    }}
                  />
                )}
              </Show>
            </>
          )}
        </Show>
      </Show>
    </section>
  );
}

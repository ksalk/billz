import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, Show } from "solid-js";
import {
  errorMessage,
  getConfig,
  getOccurrences,
  type Occurrence,
} from "../api";
import { CalendarGrid } from "../components/CalendarGrid";
import { DayDialog } from "../components/DayDialog";
import { OccurrenceDialog } from "../components/OccurrenceDialog";
import {
  addMonths,
  calendarRange,
  isoDate,
  monthKey,
  monthLabel,
  startOfMonth,
} from "../lib/dates";
import { createToday } from "../lib/today";

export default function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = createSignal(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = createSignal<Date | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] =
    createSignal<Occurrence | null>(null);

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

  return (
    <section class="page">
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
                    onSelectOccurrence={setSelectedOccurrence}
                    onSelectDay={setSelectedDay}
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
                    onClose={() => setSelectedDay(null)}
                    onSelectOccurrence={setSelectedOccurrence}
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
                    onSaved={() => {
                      setSelectedOccurrence(null);
                      setSelectedDay(null);
                      void refetch();
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

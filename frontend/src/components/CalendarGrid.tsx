import { createMemo, For, Show } from "solid-js";
import type { Occurrence } from "../api";
import {
  calendarDays,
  formatIsoDate,
  isoDate,
  monthLabel,
  weekdayLabels,
} from "../lib/dates";
import { formatMinor } from "../lib/money";

interface CalendarGridProps {
  month: Date;
  today: string;
  occurrences: Occurrence[];
  currency: string;
  onSelectOccurrence: (occurrence: Occurrence) => void;
  onSelectDay: (date: Date) => void;
  onAddForDay: (date: Date) => void;
}

export type CalendarTileStatus = "paid" | "skipped" | "overdue" | "pending";

export function occurrenceTileStatus(
  occurrence: Occurrence,
  today: string,
): CalendarTileStatus {
  if (occurrence.status === "paid") {
    return "paid";
  }

  if (occurrence.status === "skipped") {
    return "skipped";
  }

  return occurrence.dueDate < today ? "overdue" : "pending";
}

export function tileStatusLabel(status: CalendarTileStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "skipped":
      return "Skipped";
    case "overdue":
      return "Overdue";
    default:
      return "Pending";
  }
}

export function CalendarGrid(props: CalendarGridProps) {
  const days = createMemo(() => calendarDays(props.month));
  const activeMonth = createMemo(() => props.month.getMonth());
  const byDate = createMemo(() => {
    const map = new Map<string, Occurrence[]>();

    for (const occurrence of props.occurrences) {
      const items = map.get(occurrence.dueDate) ?? [];
      items.push(occurrence);
      map.set(occurrence.dueDate, items);
    }

    return map;
  });

  return (
    <section
      class="calendar"
      aria-label={`Bill calendar for ${monthLabel(props.month)}`}
    >
      <div class="weekday-row" aria-hidden="true">
        <For each={weekdayLabels()}>{(label) => <span>{label}</span>}</For>
      </div>

      <ol class="calendar-grid">
        <For each={days()}>
          {(date) => {
            const key = isoDate(date);
            const items = () => byDate().get(key) ?? [];
            const visible = () => items().slice(0, 3);
            const outside = () => date.getMonth() !== activeMonth();
            const isToday = () => key === props.today;
            const summaryStatus = (): CalendarTileStatus => {
              const statuses = items().map((item) =>
                occurrenceTileStatus(item, props.today),
              );

              if (statuses.includes("overdue")) {
                return "overdue";
              }

              if (statuses.includes("pending")) {
                return "pending";
              }

              if (statuses.includes("paid")) {
                return "paid";
              }

              return "skipped";
            };

            return (
              <li
                class="day-cell"
                classList={{ "is-today": isToday(), "is-outside": outside() }}
              >
                <div class="day-head">
                  <button
                    type="button"
                    class="day-number"
                    onClick={() => props.onSelectDay(date)}
                    aria-label={`Open ${formatIsoDate(key)}, ${items().length} bills`}
                  >
                    {date.getDate()}
                  </button>
                  <button
                    type="button"
                    class="day-add"
                    onClick={() => props.onAddForDay(date)}
                    aria-label={`Add bill for ${formatIsoDate(key)}`}
                  >
                    +
                  </button>
                </div>

                <Show when={items().length > 0}>
                  <span class="day-count" aria-hidden="true">
                    <span class={`status-dot status-${summaryStatus()}`} />
                    {items().length}
                  </span>
                </Show>

                <div class="calendar-tiles">
                  <For each={visible()}>
                    {(occurrence) => {
                      const status = () =>
                        occurrenceTileStatus(occurrence, props.today);

                      return (
                        <button
                          type="button"
                          class={`tile tile-${status()}`}
                          onClick={() => props.onSelectOccurrence(occurrence)}
                          aria-label={`${occurrence.billName}, ${formatMinor(
                            occurrence.amountMinor,
                            props.currency,
                          )}, ${tileStatusLabel(status())}`}
                        >
                          <span class="tile-dot" aria-hidden="true" />
                          <span class="tile-name">{occurrence.billName}</span>
                          <span class="tile-amount">
                            {formatMinor(
                              occurrence.amountMinor,
                              props.currency,
                            )}
                          </span>
                        </button>
                      );
                    }}
                  </For>

                  <Show when={items().length > 3}>
                    <button
                      type="button"
                      class="more-link"
                      onClick={() => props.onSelectDay(date)}
                    >
                      +{items().length - 3} more
                    </button>
                  </Show>
                </div>
              </li>
            );
          }}
        </For>
      </ol>
    </section>
  );
}

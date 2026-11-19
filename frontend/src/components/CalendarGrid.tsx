import { createMemo, For, Index, Show } from "solid-js";
import type { Occurrence, OccurrenceStatus } from "../api";
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
  busyKey: string | null;
  locked: boolean;
  onSetStatus: (occurrence: Occurrence, status: OccurrenceStatus) => void;
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

export function occurrenceActionLabel(
  occurrence: Occurrence,
  target: "paid" | "skipped",
): string {
  return `Mark ${occurrence.billName} due ${formatIsoDate(
    occurrence.dueDate,
  )} as ${target}`;
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
            const visible = () => items().slice(0, 2);
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
                    data-calendar-date={key}
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
                  <Index each={visible()}>
                    {(item) => {
                      const occurrence = item;
                      const status = () =>
                        occurrenceTileStatus(occurrence(), props.today);
                      const busy = () =>
                        props.busyKey ===
                        `${occurrence().billId}:${occurrence().dueDate}`;
                      const unavailable = () => props.locked || busy();
                      const choose = (target: "paid" | "skipped") => {
                        if (
                          !unavailable() &&
                          occurrence().status === "pending"
                        ) {
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
                        <fieldset
                          class={`tile tile-${status()}`}
                          aria-busy={busy() ? "true" : undefined}
                        >
                          <legend class="sr-only">{`${
                            occurrence().billName
                          }, ${formatMinor(
                            occurrence().amountMinor,
                            props.currency,
                          )}, ${tileStatusLabel(status())}`}</legend>
                          <div class="tile-main">
                            <span class="tile-dot" aria-hidden="true" />
                            <span class="tile-name">
                              {occurrence().billName}
                            </span>
                            <span class="tile-amount">
                              {formatMinor(
                                occurrence().amountMinor,
                                props.currency,
                              )}
                            </span>
                          </div>

                          <div class="tile-actions">
                            <button
                              type="button"
                              class="tile-action"
                              classList={{
                                "is-active": occurrence().status === "paid",
                              }}
                              aria-pressed={occurrence().status === "paid"}
                              aria-label={occurrenceActionLabel(
                                occurrence(),
                                "paid",
                              )}
                              title={statusTitle("paid")}
                              aria-disabled={
                                unavailable() ||
                                occurrence().status !== "pending"
                                  ? "true"
                                  : undefined
                              }
                              onClick={() => choose("paid")}
                            >
                              Paid
                            </button>
                            <button
                              type="button"
                              class="tile-action"
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
                                unavailable() ||
                                occurrence().status !== "pending"
                                  ? "true"
                                  : undefined
                              }
                              onClick={() => choose("skipped")}
                            >
                              Skipped
                            </button>
                          </div>

                          <Show when={occurrence().status !== "pending"}>
                            <button
                              type="button"
                              class="tile-reset"
                              aria-label={`Reset ${occurrence().billName} due ${formatIsoDate(
                                occurrence().dueDate,
                              )} to pending`}
                              aria-disabled={unavailable() ? "true" : undefined}
                              onClick={reset}
                            >
                              Reset
                            </button>
                          </Show>
                        </fieldset>
                      );
                    }}
                  </Index>

                  <Show when={items().length > 2}>
                    <button
                      type="button"
                      class="more-link"
                      onClick={() => props.onSelectDay(date)}
                    >
                      +{items().length - 2} more
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

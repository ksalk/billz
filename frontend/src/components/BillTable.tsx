import { For, Show } from "solid-js";
import type { Bill } from "../api";
import { formatIsoDate } from "../lib/dates";
import { formatMinor } from "../lib/money";
import { scheduleSummary } from "../lib/schedule";

interface BillTableProps {
  bills: Bill[];
  currency: string;
  today: string;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
}

export function isOverdue(bill: Bill, today: string): boolean {
  return bill.nextDue !== null && bill.nextDue < today;
}

export function BillTable(props: BillTableProps) {
  return (
    <table class="bill-table">
      <caption class="sr-only">All bills and their next due dates</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Amount</th>
          <th scope="col">Schedule</th>
          <th scope="col">Category</th>
          <th scope="col">Next due</th>
          <th scope="col">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <For each={props.bills}>
          {(bill) => (
            <tr>
              <td data-label="Name">
                <span class="bill-name">{bill.name}</span>
              </td>
              <td data-label="Amount" class="numeric">
                {formatMinor(bill.amountMinor, props.currency)}
              </td>
              <td data-label="Schedule">
                <span class="schedule-text">{scheduleSummary(bill)}</span>
              </td>
              <td data-label="Category">
                <Show
                  when={bill.category}
                  fallback={<span class="muted">—</span>}
                >
                  <span class="category-pill">{bill.category}</span>
                </Show>
              </td>
              <td data-label="Next due">
                <Show
                  when={bill.nextDue}
                  fallback={<span class="muted">Ended</span>}
                >
                  {(nextDue) => (
                    <span class="next-due">
                      <span>{formatIsoDate(nextDue())}</span>
                      <Show when={isOverdue(bill, props.today)}>
                        <span class="status-pill is-overdue">Overdue</span>
                      </Show>
                    </span>
                  )}
                </Show>
              </td>
              <td data-label="Actions">
                <div class="row-actions">
                  <button
                    type="button"
                    class="button ghost compact"
                    onClick={() => props.onEdit(bill)}
                    aria-label={`Edit ${bill.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="button danger compact"
                    onClick={() => props.onDelete(bill)}
                    aria-label={`Delete ${bill.name}`}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

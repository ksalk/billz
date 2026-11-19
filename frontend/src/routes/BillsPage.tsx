import { useSearchParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import {
  ApiError,
  type Bill,
  deleteBill,
  errorMessage,
  getBills,
  getConfig,
} from "../api";
import { BillFormDialog } from "../components/BillFormDialog";
import { BillTable } from "../components/BillTable";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { todayIso } from "../lib/dates";
import { createToday } from "../lib/today";

export default function BillsPage() {
  const [params, setParams] = useSearchParams<{ new?: string }>();
  const [config, { refetch: refetchConfig }] = createResource(0, getConfig);
  const [bills, { refetch }] = createResource(0, getBills);
  const today = createToday();
  const [editing, setEditing] = createSignal<Bill | "new" | null>(null);
  const [initialDate, setInitialDate] = createSignal(todayIso());
  const [pendingNewDate, setPendingNewDate] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal<Bill | null>(null);
  const [deleteBusy, setDeleteBusy] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  createEffect(() => {
    const requestedDate = params.new;

    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      setPendingNewDate(requestedDate);
    }
  });

  createEffect(() => {
    const requestedDate = pendingNewDate();

    if (requestedDate && config()) {
      setInitialDate(requestedDate);
      setEditing("new");
      setPendingNewDate(null);
      setParams({ new: undefined }, { replace: true });
    }
  });

  const openCreate = () => {
    setInitialDate(todayIso());
    setEditing("new");
  };

  const handleSaved = () => {
    setEditing(null);
    void refetch();
  };

  const confirmDelete = async () => {
    const bill = deleting();

    if (!bill) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await deleteBill(bill.id);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 404)) {
        setDeleteError(errorMessage(caught));
        setDeleteBusy(false);
        return;
      }
    }

    try {
      await refetch();
    } finally {
      setDeleting(null);
      setDeleteBusy(false);
    }
  };

  return (
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Bills</p>
          <h1>All bills</h1>
        </div>

        <div class="page-actions">
          <button
            type="button"
            class="button primary"
            onClick={openCreate}
            disabled={!config()}
          >
            Add bill
          </button>
        </div>
      </header>

      <Show when={bills.error || config.error}>
        <div class="error-card" role="alert">
          <strong>Could not load your bills.</strong>
          <p>{errorMessage(bills.error ?? config.error)}</p>
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

      <Show when={!bills.error && !config.error}>
        <Show
          when={config()}
          fallback={<p class="loading-state">Loading bills…</p>}
        >
          {(loadedConfig) => (
            <Show
              when={bills()}
              fallback={<p class="loading-state">Loading bills…</p>}
            >
              {(items) => (
                <Show
                  when={items().length > 0}
                  fallback={
                    <div class="empty-state">
                      <p class="eyebrow">Empty ledger</p>
                      <h2>No bills yet</h2>
                      <p class="muted">
                        Add rent, subscriptions, insurance, or anything else you
                        need to remember.
                      </p>
                      <button
                        type="button"
                        class="button primary"
                        onClick={openCreate}
                      >
                        Add your first bill
                      </button>
                    </div>
                  }
                >
                  <div class="bill-table-wrap">
                    <BillTable
                      bills={items()}
                      currency={loadedConfig().currency}
                      today={today()}
                      onEdit={(bill) => setEditing(bill)}
                      onDelete={(bill) => {
                        setDeleteError(null);
                        setDeleting(bill);
                      }}
                    />
                  </div>
                </Show>
              )}
            </Show>
          )}
        </Show>
      </Show>

      <Show when={config()}>
        {(loadedConfig) => (
          <Show when={editing()} keyed>
            {(value) => (
              <BillFormDialog
                bill={value === "new" ? null : value}
                initialDate={initialDate()}
                currency={loadedConfig().currency}
                onClose={() => setEditing(null)}
                onSaved={handleSaved}
              />
            )}
          </Show>
        )}
      </Show>

      <Show when={deleting()} keyed>
        {(bill) => (
          <ConfirmDialog
            title={`Delete ${bill.name}?`}
            message="This removes the bill and its payment history. It cannot be undone."
            confirmLabel="Delete bill"
            busy={deleteBusy()}
            error={deleteError()}
            onConfirm={() => {
              void confirmDelete();
            }}
            onClose={() => {
              if (!deleteBusy()) {
                setDeleting(null);
                setDeleteError(null);
              }
            }}
          />
        )}
      </Show>
    </section>
  );
}

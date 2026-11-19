import { onCleanup, onMount, Show } from "solid-js";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  let dialog: HTMLDialogElement | undefined;

  onMount(() => {
    dialog?.showModal();
  });

  onCleanup(() => {
    if (dialog?.open) {
      dialog.close();
    }
  });

  function close() {
    if (!props.busy) {
      props.onClose();
    }
  }

  return (
    <dialog
      ref={dialog}
      class="modal confirm-modal"
      aria-labelledby="confirm-title"
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
      <section class="modal-panel">
        <header class="modal-head">
          <div>
            <p class="eyebrow">Confirm</p>
            <h2 id="confirm-title">{props.title}</h2>
          </div>
        </header>

        <p class="muted">{props.message}</p>

        <Show when={props.error}>
          <p class="form-error" role="alert">
            {props.error}
          </p>
        </Show>

        <footer class="modal-actions">
          <button type="button" class="button ghost" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            class="button danger"
            onClick={props.onConfirm}
            disabled={props.busy}
          >
            {props.busy ? "Deleting…" : (props.confirmLabel ?? "Delete")}
          </button>
        </footer>
      </section>
    </dialog>
  );
}

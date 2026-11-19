import { A, useSearchParams } from "@solidjs/router";
import { todayIso } from "../lib/dates";

export default function BillsPage() {
  const [params] = useSearchParams<{ new?: string }>();

  return (
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Bills</p>
          <h1>All bills</h1>
        </div>
        <A href={`/bills?new=${todayIso()}`} class="button primary">
          Add bill
        </A>
      </header>

      <div class="placeholder-card">
        <h2>The bills table is on the way</h2>
        <p class="muted">
          {params.new
            ? `Adding a bill for ${params.new} arrives with the editable table in the next commit.`
            : "Calendar tracking is ready. The editable table lands in the next commit."}
        </p>
        <A href="/calendar">Back to the calendar</A>
      </div>
    </section>
  );
}

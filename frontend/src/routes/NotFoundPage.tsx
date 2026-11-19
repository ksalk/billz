import { A } from "@solidjs/router";

export default function NotFoundPage() {
  return (
    <section class="page">
      <p class="eyebrow">Not found</p>
      <h1>That page does not exist.</h1>
      <p class="muted">Head back to the calendar to see what is due.</p>
      <A href="/calendar" class="button primary">
        Open calendar
      </A>
    </section>
  );
}

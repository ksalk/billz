import type { Component } from "solid-js";

const App: Component = () => (
  <main class="app-shell">
    <header class="app-header">
      <h1>Billz</h1>
      <p class="tagline">
        Bills and recurring payments, without the spreadsheet.
      </p>
    </header>

    <section class="placeholder-card">
      <h2>Calendar and bills are on the way</h2>
      <p>
        The API is available at <code>/api/health</code>.
      </p>
    </section>
  </main>
);

export default App;

import {
  A,
  Navigate,
  Route,
  Router,
  type RouteSectionProps,
} from "@solidjs/router";
import type { Component } from "solid-js";
import BillsPage from "./routes/BillsPage";
import CalendarPage from "./routes/CalendarPage";
import NotFoundPage from "./routes/NotFoundPage";

const Layout: Component<RouteSectionProps> = (props) => (
  <div class="app-shell">
    <header class="app-header">
      <A href="/calendar" class="brand" aria-label="Billz calendar">
        <span class="brand-mark">B</span>
        <span>Billz</span>
      </A>

      <nav class="app-nav" aria-label="Main navigation">
        <A href="/calendar" activeClass="is-active" end>
          Calendar
        </A>
        <A href="/bills" activeClass="is-active" end>
          Bills
        </A>
      </nav>
    </header>

    <main class="app-main">{props.children}</main>

    <footer class="app-footer">
      <span>Billz</span>
      <span>Private, local bill tracking</span>
    </footer>
  </div>
);

const App: Component = () => (
  <Router root={Layout}>
    <Route path="/" component={() => <Navigate href="/calendar" />} />
    <Route path="/calendar" component={CalendarPage} />
    <Route path="/bills" component={BillsPage} />
    <Route path="*" component={NotFoundPage} />
  </Router>
);

export default App;

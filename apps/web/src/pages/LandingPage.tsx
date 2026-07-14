import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="landing-content">
        <p className="eyebrow">Playable Nation Vertical Slice</p>
        <h1>Statecraft Online</h1>
        <p className="landing-copy">
          A playable prototype shell for managing a fictional nation through stats, public posts, events, a simple map,
          character agents, and military positioning.
        </p>
        <Link className="primary-action" to="/demo">
          Enter Demo Nation
        </Link>
        <Link className="secondary-action" to="/create-nation">
          Create Nation
        </Link>
        <Link className="secondary-action" to="/feed">
          World Feed
        </Link>
        <Link className="secondary-action" to="/login">
          Sign In
        </Link>
        <Link className="secondary-action" to="/register">
          Register
        </Link>
      </section>
    </main>
  );
}

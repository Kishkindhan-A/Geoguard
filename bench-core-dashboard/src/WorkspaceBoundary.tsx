import { Component, type ErrorInfo, type ReactNode } from "react";

export default class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Technical errors stay out of the operator-facing recovery screen.
  }
  render() {
    if (this.state.failed) {
      return (
        <section
          className="panel"
          role="alert"
          style={{ maxWidth: 640, margin: "12vh auto", padding: 32 }}
        >
          <h1>Reconnect to your workspace</h1>
          <p className="helper" style={{ margin: "18px 0" }}>
            A workspace module could not load. Check that the local service is
            running, then reload. Saved assessments remain in the audit store.
            Unsaved form inputs may need to be entered again.
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload workspace
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

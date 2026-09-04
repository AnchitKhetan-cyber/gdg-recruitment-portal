import { Component } from "react"

/**
 * Catches any render crash so a candidate never hits a blank white screen.
 *
 * The message is deliberately reassuring: by the time most crashes happen the
 * answers are already saved and often submitted server-side, so the safe advice
 * is almost always "your work is saved, sign back in" rather than "you lost
 * everything". Reloading re-runs the route guard, which resumes an unsubmitted
 * attempt or shows the submitted screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Left visible in dev; a real deployment would ship this to a logger.
    console.error("[portal] render crash:", error, info?.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <div className="gdg-rule mx-auto mb-5 h-1 w-16 rounded-full" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-ink">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Your answers are saved on our server, including anything you had already submitted.
            Reload to continue - if your test was submitted, you will see the confirmation; if not,
            it resumes where you left off.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 rounded-full bg-gdg-blue px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gdg-blue-dark"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary

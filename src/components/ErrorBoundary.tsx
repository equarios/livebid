import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Surfaces render crashes instead of a blank #root. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card admin-section" style={{ margin: 24, maxWidth: 640 }}>
          <h2>Something broke</h2>
          <p className="muted tiny">The page hit an error. Details:</p>
          <pre className="muted tiny" style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

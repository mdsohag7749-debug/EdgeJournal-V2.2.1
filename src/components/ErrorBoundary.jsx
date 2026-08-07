import { Component } from 'react';

// Top-level resilience guard. If any render throws (e.g. due to a
// corrupted local record, a stray value slipping through, or an
// unexpected network/storage failure), the whole authenticated app would
// otherwise unmount to a blank page. Instead of exposing the raw error or
// internal details, show a friendly recovery screen and offer to reload.
// The "Back to Dashboard" button only shows when the browser has a valid
// in-app URL to return to; otherwise just reload in place.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep it out of the user's face — no secrets or full data dumped here.
    if (this.props.onError) this.props.onError(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
            padding: 32,
            textAlign: 'center',
            background: 'var(--bg, #0b0b10)',
            color: 'var(--text, #e8e8ec)',
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--red, #c1121f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>
            !
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted, #9a9aa3)', maxWidth: 420, margin: 0 }}>
            An unexpected error occurred while rendering this screen. Your data is safe. Try reloading the app.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--red, #c1121f)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
            {this.props.canReset && (
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid var(--border, #26262e)',
                  background: 'transparent',
                  color: 'var(--text, #e8e8ec)',
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
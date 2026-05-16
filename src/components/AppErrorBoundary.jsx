import React from "react";
import { AlertTriangle, RefreshCw, MessageCircle } from "lucide-react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn("UI crashed:", error, info);
    this.setState({ errorInfo: info });
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === "development";
      const errorMsg = this.state.error?.message || "Unknown error";

      return (
        <div className="aeb-page">
          <div className="aeb-shell">
            <div className="aeb-icon">
              <AlertTriangle size={32} />
            </div>

            <div className="aeb-kicker">Terjadi kesalahan</div>
            <h1 className="aeb-title">Oops, ada yang error</h1>
            <p className="aeb-sub">
              Halaman mengalami masalah tak terduga. Coba refresh — biasanya langsung beres.
            </p>

            {isDev && errorMsg ? (
              <div className="aeb-devError">
                <code>{errorMsg}</code>
              </div>
            ) : null}

            <div className="aeb-actions">
              <button className="btn aeb-reloadBtn" type="button" onClick={this.handleReload}>
                <RefreshCw size={16} />
                Refresh halaman
              </button>
              <button className="btn btn-ghost aeb-resetBtn" type="button" onClick={this.handleReset}>
                Coba lagi
              </button>
              <a
                className="btn btn-ghost aeb-waBtn"
                href="https://wa.me/6283136049987"
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={16} />
                Chat admin
              </a>
            </div>

            <p className="aeb-hint">
              Kalau masalah terus berulang, screenshot halaman ini dan kirim ke admin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from "react";
import { Link } from "react-router-dom";

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[PageErrorBoundary]", this.props.pageName, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page">
        <section className="section">
          <div className="container card pad">
            <h1 className="h3">Halaman error</h1>
            <p className="muted">
              {this.props.pageName || "Halaman ini"} gagal dimuat. Coba refresh atau balik ke katalog.
            </p>
            {import.meta.env.DEV && this.state.error ? (
              <pre className="muted" style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>
                {String(this.state.error?.message || this.state.error)}
              </pre>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => window.location.reload()}>
                Refresh
              </button>
              <Link className="btn btn-ghost" to="/produk">Katalog</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }
}
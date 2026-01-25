import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn("UI crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <section className="section">
            <div className="container narrow">
              <div className="card pad">
                <h1 className="h2">Oops… ada yang error</h1>
                <p className="muted">
                  Coba refresh halaman. Kalau masih error, kabari admin ya.
                </p>
                <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button className="btn" onClick={() => window.location.reload()}>
                    Refresh
                  </button>
                  <a
                    className="btn btn-ghost"
                    href="https://wa.me/6283136049987"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chat admin
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}

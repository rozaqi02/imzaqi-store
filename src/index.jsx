import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { warn } from "./lib/log";

// Measure scrollbar width to prevent layout shift when body overflow toggles
if (typeof document !== "undefined") {
  const w = document.documentElement.clientWidth;
  const w2 = window.innerWidth;
  if (w2 > w) document.documentElement.style.setProperty("--scrollbar-width", `${w2 - w}px`);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AppErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </ToastProvider>
    </ThemeProvider>
  </AppErrorBoundary>
);

// Service worker: hanya register di production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      warn('Service worker registration failed:', err);
    });
  });
} else if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  // Unregister any existing SW in development to prevent caching issues
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

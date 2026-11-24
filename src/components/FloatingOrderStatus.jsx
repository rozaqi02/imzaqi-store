import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { getOrderHistory } from "../lib/orderHistory";

const DISMISSED_ORDER_KEY = "imzaqi_floating_order_dismissed_v1";
const TERMINAL_ORDER_STATUSES = new Set(["done", "cancelled", "expired"]);
const MAX_ORDER_AGE_MS = 86_400_000; // 24 jam

export function isActiveOrderForFloatingStatus(order, nowMs = Date.now()) {
  if (!order?.order_code) return false;
  const status = String(order.status || "pending").trim().toLowerCase();
  if (TERMINAL_ORDER_STATUSES.has(status)) return false;

  const createdMs = new Date(order.created_at).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const age = nowMs - createdMs;
  return age >= 0 && age < MAX_ORDER_AGE_MS;
}

function readDismissedOrderCode() {
  try {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(DISMISSED_ORDER_KEY) || ""
      : "";
  } catch {
    return "";
  }
}

function saveDismissedOrderCode(orderCode) {
  try {
    if (typeof sessionStorage !== "undefined" && orderCode) {
      sessionStorage.setItem(DISMISSED_ORDER_KEY, orderCode);
    }
  } catch {}
}

export default function FloatingOrderStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const overlayBlocked = useStorefrontOverlayBlocked();
  const isStatusPage = location.pathname === "/status";
  const [order, setOrder] = useState(null);
  const [dismissedCode, setDismissedCode] = useState(readDismissedOrderCode);

  useEffect(() => {
    try {
      const history = getOrderHistory();
      const latest = history?.[0];
      if (isActiveOrderForFloatingStatus(latest)) {
        setOrder(latest);
      } else {
        setOrder(null);
      }
    } catch {
      setOrder(null);
    }
  }, [location.pathname]);

  const isDismissed = Boolean(order?.order_code && dismissedCode === order.order_code);
  const active = Boolean(order && !isDismissed && !overlayBlocked && !isStatusPage);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("has-floating-order", active);
    return () => document.body.classList.remove("has-floating-order");
  }, [active]);

  if (!active) return null;

  return (
    <div className="floating-order-status">
      <button
        className="floating-order-btn"
        type="button"
        onClick={() => {
          navigate(`/status?order=${encodeURIComponent(order.order_code)}`);
        }}
      >
        <span className="floating-order-label">Order terbaru Anda:</span>
        <span className="floating-order-code">{order.order_code}</span>
        <span className="floating-order-arrow" aria-hidden="true">
          <ArrowRight size={13} />
        </span>
      </button>
      <button
        className="floating-order-dismiss"
        type="button"
        onClick={() => {
          saveDismissedOrderCode(order.order_code);
          setDismissedCode(order.order_code);
        }}
        aria-label="Tutup pengingat order"
      >
        <X size={13} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

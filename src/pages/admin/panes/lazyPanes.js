/**
 * Code-split hooks for admin workspace panes.
 * AdminDashboard remains the data container; panes can be moved here incrementally.
 * App already React.lazy()'s AdminDashboard — these chunks load only when a tab mounts.
 */
import React from "react";

export const LazyVirtualList = React.lazy(() => import("../components/VirtualList"));
export const LazyAdminOrderListItem = React.lazy(() =>
  import("../components/AdminOrderListItem")
);

/** Placeholder for future full pane extractions (Overview, Orders, Products, …). */
export function AdminPaneFallback() {
  return (
    <div className="admin-initialLoad" role="status" aria-label="Memuat panel">
      <div className="admin-initialLoadCard">
        <div className="skeleton" style={{ height: 18, width: "36%", borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 12, width: "62%", marginTop: 10, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 100, marginTop: 16, borderRadius: 14 }} />
      </div>
    </div>
  );
}

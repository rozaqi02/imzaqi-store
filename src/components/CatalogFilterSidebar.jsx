import React from "react";
import { SlidersHorizontal } from "lucide-react";

function FilterShell({ head, body }) {
  return (
    <div className="catalog-filterShell">
      {head}
      <div className="catalog-filterShellBody">{body}</div>
    </div>
  );
}

export default function CatalogFilterSidebar({
  activeFiltersCount = 0,
  onReset,
  children,
}) {
  const head = (
    <div className="catalog-filterHead">
      <div className="catalog-filterHeadMain">
        <span className="catalog-filterHeadIcon" aria-hidden="true">
          <SlidersHorizontal size={18} />
        </span>
        <div>
          <h2 className="catalog-filterHeadTitle">Filter</h2>
          <p className="catalog-filterHeadSub">Sesuaikan katalog kamu</p>
        </div>
      </div>
      {activeFiltersCount ? (
        <button type="button" className="catalog-filterHeadReset" onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );

  return (
    <aside className="catalog-sidebar" aria-label="Filter produk">
      <FilterShell head={head} body={children} />
    </aside>
  );
}
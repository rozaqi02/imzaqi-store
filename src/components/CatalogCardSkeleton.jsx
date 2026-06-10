import React from "react";

export default function CatalogCardSkeleton({ view = "grid" }) {
  const isList = view === "list";

  return (
    <div
      className={`catalog-cardSkeleton catalog-cardSkeletonV2 ${isList ? "list" : "grid"}`}
      role="listitem"
      aria-hidden="true"
    >
      <div className="catalog-cardSkeletonTop">
        <div className="catalog-cardSkeletonIcon" />
        <div className="catalog-cardSkeletonCopy">
          <div className="catalog-cardSkeletonLine is-short" />
          <div className="catalog-cardSkeletonLine is-title" />
          <div className="catalog-cardSkeletonLine is-body" />
        </div>
        {!isList ? <div className="catalog-cardSkeletonPrice" /> : null}
      </div>
      <div className="catalog-cardSkeletonSignals">
        <span />
        <span />
      </div>
      <div className="catalog-cardSkeletonMeta">
        <span />
        <span />
        <span />
      </div>
      <div className="catalog-cardSkeletonFoot" />
    </div>
  );
}
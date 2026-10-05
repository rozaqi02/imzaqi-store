import React from "react";
import { Link } from "react-router-dom";
import BannerGraphic from "./BannerGraphic";

export default function EmptyState({
  title,
  description,
  icon,
  mascot,
  primaryAction,
  secondaryAction,
  suggestions = [],
}) {
  // Support mascot, string icons, and React elements (e.g. lucide icons)
  const isElement = React.isValidElement(icon);

  return (
    <div className="empty empty--animated">
      <div className={`empty-icon${isElement ? " empty-icon-component" : ""}${mascot ? " empty-icon-mascot" : ""}`} aria-hidden="true">
        {mascot ? (
          <BannerGraphic name={mascot} height={56} className="empty-mascotGraphic" />
        ) : (
          icon ?? "[]"
        )}
      </div>
      {title ? <div className="empty-title">{title}</div> : null}
      {description ? <div className="empty-desc">{description}</div> : null}

      {suggestions.length ? (
        <div className="empty-suggestions" aria-label="Saran pencarian">
          {suggestions.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              className="empty-suggestionChip"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {(primaryAction || secondaryAction) ? (
        <div className="empty-actions">
          {primaryAction ? renderAction(primaryAction, "btn") : null}
          {secondaryAction ? renderAction(secondaryAction, "btn btn-ghost") : null}
        </div>
      ) : null}
    </div>
  );
}

function renderAction(action, className) {
  const { label, to, href, onClick } = action;
  if (to) {
    return (
      <Link className={className} to={to} onClick={onClick}>
        {label}
      </Link>
    );
  }
  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer" onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <button className={className} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

import React from "react";
import { Link } from "react-router-dom";

export default function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
}) {
  // Support both string icons and React elements (e.g. lucide icons)
  const iconContent = icon ?? "[]";
  const isElement = React.isValidElement(iconContent);

  return (
    <div className="empty">
      <div className={`empty-icon${isElement ? " empty-icon-component" : ""}`} aria-hidden="true">
        {iconContent}
      </div>
      {title ? <div className="empty-title">{title}</div> : null}
      {description ? <div className="empty-desc">{description}</div> : null}

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

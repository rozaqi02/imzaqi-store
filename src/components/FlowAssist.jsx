import React from "react";
import { Link } from "react-router-dom";

function renderAction(action, index) {
  if (!action?.label) return null;

  const className = action.className || `btn${action.ghost ? " btn-ghost" : ""}${action.sm ? " btn-sm" : ""}`;
  const content = (
    <>
      {action.icon ? <span className="flow-assist-actionIcon">{action.icon}</span> : null}
      <span>{action.label}</span>
    </>
  );

  if (action.to) {
    return (
      <Link key={`${action.label}-${index}`} className={className} to={action.to} state={action.state} onClick={action.onClick}>
        {content}
      </Link>
    );
  }

  if (action.href) {
    return (
      <a
        key={`${action.label}-${index}`}
        className={className}
        href={action.href}
        target={action.target || "_blank"}
        rel={action.rel || "noreferrer"}
        onClick={action.onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button key={`${action.label}-${index}`} type="button" className={className} onClick={action.onClick}>
      {content}
    </button>
  );
}

function renderBadge(badge, index) {
  if (!badge) return null;

  if (typeof badge === "string") {
    return (
      <span key={`${badge}-${index}`} className="flow-assist-badge">
        {badge}
      </span>
    );
  }

  return (
    <span
      key={`${badge.label || badge.text || "badge"}-${index}`}
      className={`flow-assist-badge${badge.tone ? ` ${badge.tone}` : ""}`}
    >
      {badge.icon ? <span className="flow-assist-badgeIcon">{badge.icon}</span> : null}
      <span>{badge.label || badge.text}</span>
    </span>
  );
}

export default function FlowAssist({
  eyebrow,
  title,
  description,
  badges = [],
  actions = [],
  className = "",
  dense = false,
}) {
  const classes = ["flow-assist", dense ? "is-dense" : "", className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      <div className="flow-assist-copy">
        {eyebrow ? <div className="flow-assist-eyebrow">{eyebrow}</div> : null}
        {title ? <div className="flow-assist-title">{title}</div> : null}
        {description ? <p className="flow-assist-desc">{description}</p> : null}

        {badges.length ? <div className="flow-assist-badges">{badges.map(renderBadge)}</div> : null}
      </div>

      {actions.length ? <div className="flow-assist-actions">{actions.map(renderAction)}</div> : null}
    </section>
  );
}

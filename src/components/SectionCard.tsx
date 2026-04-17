import { useId, useState, type PropsWithChildren } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const SectionCard = ({
  title,
  subtitle,
  className,
  collapsible = true,
  defaultCollapsed = false,
  children,
}: SectionCardProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId().replace(/:/g, "");
  const cardClassName = [
    "section-card",
    className,
    collapsible && collapsed ? "section-card-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cardClassName}>
      {collapsible ? (
        <header className="section-header section-header-collapsible">
          <h3 className="section-heading">
            <button
              type="button"
              className="section-toggle"
              onClick={() => setCollapsed((current) => !current)}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
            >
              <span className="section-toggle-copy">
                <span className="section-toggle-title">{title}</span>
                {subtitle ? <span className="section-toggle-subtitle">{subtitle}</span> : null}
              </span>
              <span className="section-toggle-icon" aria-hidden="true">
                {collapsed ? "+" : "-"}
              </span>
            </button>
          </h3>
        </header>
      ) : (
        <header className="section-header">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
      )}
      <div className="section-body" id={bodyId} hidden={collapsible && collapsed}>
        {children}
      </div>
    </section>
  );
};

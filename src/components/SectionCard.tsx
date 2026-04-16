import type { PropsWithChildren } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export const SectionCard = ({ title, subtitle, children }: SectionCardProps) => (
  <section className="section-card">
    <header className="section-header">
      <h3>{title}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
    <div className="section-body">{children}</div>
  </section>
);

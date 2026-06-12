type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export const SectionHeader = ({ title, subtitle }: SectionHeaderProps) => (
  <div className="topbar">
    <div>
      <h2>{title}</h2>
      {subtitle ? <p className="subtle">{subtitle}</p> : null}
    </div>
    <span className="badge">Live</span>
  </div>
);

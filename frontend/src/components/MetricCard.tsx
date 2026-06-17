type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  danger?: boolean;
};

export function MetricCard({ label, value, helper, danger = false }: MetricCardProps) {
  return (
    <article className={`metric-card ${danger ? "metric-card-danger" : ""}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {helper ? <p className="metric-helper">{helper}</p> : null}
    </article>
  );
}

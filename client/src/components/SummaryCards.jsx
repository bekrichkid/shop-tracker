import { formatSum } from "../format.js";

const PERIODS = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "7 kun" },
  { key: "month", label: "Shu oy" },
  { key: "all", label: "Barchasi" },
];

export default function SummaryCards({ period, onPeriodChange, income, expense, synced }) {
  const balance = income - expense;
  return (
    <section className="summary">
      <div className="period-switch">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={"chip" + (period === p.key ? " chip-active" : "")}
            onClick={() => onPeriodChange(p.key)}
          >
            {p.label}
          </button>
        ))}
        <span className={"live-dot" + (synced ? " live-on" : "")} title={synced ? "Sinxronlangan" : "Aloqa yo'q"} />
      </div>
      <div className="cards">
        <div className="card card-balance">
          <span className="card-label">Balans</span>
          <span className={"card-value" + (balance < 0 ? " negative" : "")}>{formatSum(balance)}</span>
        </div>
        <div className="card card-income">
          <span className="card-label">Daromad</span>
          <span className="card-value">{formatSum(income)}</span>
        </div>
        <div className="card card-expense">
          <span className="card-label">Xarajat</span>
          <span className="card-value">{formatSum(expense)}</span>
        </div>
      </div>
    </section>
  );
}

import { formatSum } from "../format.js";

const PERIODS = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "7 kun" },
  { key: "month", label: "Shu oy" },
  { key: "all", label: "Barchasi" },
];

export default function SummaryCards({ period, onPeriodChange, income, expense, inventoryValue, synced }) {
  const balance = income - expense;
  return (
    <section className="summary">
      <div className="chip-row" role="tablist" aria-label="Davr">
        {PERIODS.map((p) => (
          <button key={p.key} className={"chip" + (period === p.key ? " chip-active" : "")} onClick={() => onPeriodChange(p.key)}>
            {p.label}
          </button>
        ))}
        <span className={"sync-dot" + (synced ? " on" : "")} title={synced ? "Sinxronlangan" : "Aloqa yo'q"} />
      </div>

      <div className="hero">
        <span className="hero-label">Balans</span>
        <span className={"hero-value" + (balance < 0 ? " neg" : "")}>{formatSum(balance)}</span>
        <div className="hero-split">
          <div>
            <span className="hero-mini-label">Daromad</span>
            <b className="pos-on-dark">{formatSum(income)}</b>
          </div>
          <div>
            <span className="hero-mini-label">Xarajat</span>
            <b className="neg-on-dark">{formatSum(expense)}</b>
          </div>
          <div>
            <span className="hero-mini-label">Omborda</span>
            <b>{formatSum(inventoryValue)}</b>
          </div>
        </div>
      </div>
    </section>
  );
}

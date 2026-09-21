import { formatSum } from "../format.js";
import { useCountUp } from "../useCountUp.js";

const PERIODS = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "7 kun" },
  { key: "month", label: "Shu oy" },
  { key: "all", label: "Barchasi" },
];

const round2 = (n) => Math.round(n * 100) / 100;

export default function SummaryCards({ period, onPeriodChange, income, expense, inventoryValue, synced }) {
  const balance = income - expense;
  const shownBalance = useCountUp(balance);
  const shownIncome = useCountUp(income);
  const shownExpense = useCountUp(expense);
  const shownInventory = useCountUp(inventoryValue || 0);
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
        <span className={"hero-value" + (balance < 0 ? " neg" : "")}>{formatSum(round2(shownBalance))}</span>
        <div className="hero-split">
          <div>
            <span className="hero-mini-label">Daromad</span>
            <b className="pos-on-dark">{formatSum(round2(shownIncome))}</b>
          </div>
          <div>
            <span className="hero-mini-label">Xarajat</span>
            <b className="neg-on-dark">{formatSum(round2(shownExpense))}</b>
          </div>
          {inventoryValue != null && (
            <div>
              <span className="hero-mini-label">Omborda</span>
              <b>{formatSum(round2(shownInventory))}</b>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

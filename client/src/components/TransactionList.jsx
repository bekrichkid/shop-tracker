import { formatSum, formatDate } from "../format.js";

export default function TransactionList({ transactions, categoryMap, onDelete }) {
  if (transactions.length === 0) {
    return <div className="empty-state">Hozircha yozuvlar yo'q.</div>;
  }
  return (
    <ul className="list-card">
      {transactions.map((t) => {
        const cat = categoryMap[t.category];
        return (
          <li key={t.id} className="row-item">
            <span className="dot" style={{ background: cat?.color || "#999" }} />
            <div className="row-main">
              <div className="row-title">{cat?.name || "Noma'lum"}</div>
              <div className="row-sub">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
            </div>
            <span className={"amount " + (t.type === "income" ? "pos" : "neg")}>
              {t.type === "income" ? "+" : "−"}{formatSum(t.amount)}
            </span>
            <button className="icon-btn" title="O'chirish" aria-label="O'chirish" onClick={() => onDelete(t.id)}>✕</button>
          </li>
        );
      })}
    </ul>
  );
}

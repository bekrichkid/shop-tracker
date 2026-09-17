import { formatSum, formatDate } from "../format.js";

export default function TransactionList({ transactions, categoryMap, onDelete }) {
  if (transactions.length === 0) {
    return <div className="empty-state">Hozircha yozuvlar yo'q.</div>;
  }
  return (
    <ul className="tx-list">
      {transactions.map((t) => {
        const cat = categoryMap[t.category];
        return (
          <li key={t.id} className="tx-item">
            <span className="tx-dot" style={{ background: cat?.color || "#999" }} />
            <div className="tx-main">
              <div className="tx-top">
                <span className="tx-category">{cat?.name || "Noma'lum"}</span>
                <span className={"tx-amount " + (t.type === "income" ? "income" : "expense")}>
                  {t.type === "income" ? "+" : "−"}{formatSum(t.amount)}
                </span>
              </div>
              <div className="tx-bottom">
                <span className="tx-date">{formatDate(t.date)}</span>
                {t.note && <span className="tx-note">{t.note}</span>}
              </div>
            </div>
            <button className="tx-delete" title="O'chirish" onClick={() => onDelete(t.id)}>✕</button>
          </li>
        );
      })}
    </ul>
  );
}

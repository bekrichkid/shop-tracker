import { useState, useMemo } from "react";
import { formatSum } from "../format.js";

export default function CategoryManager({ categories, budgets, monthTransactions, onSetBudget, onDeleteCategory, onAddCategory, onClose }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState("");
  const [newCatType, setNewCatType] = useState("expense");
  const [newCatName, setNewCatName] = useState("");

  const spentByCategory = useMemo(() => {
    const map = {};
    monthTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return map;
  }, [monthTransactions]);

  const expenseCats = categories.filter((c) => c.type === "expense");
  const incomeCats = categories.filter((c) => c.type === "income");

  function startEdit(cat) {
    setEditing(cat.id);
    setValue(budgets[cat.id] || "");
  }

  function save(catId) {
    onSetBudget(catId, value === "" ? null : Number(value));
    setEditing(null);
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    await onAddCategory({ name: newCatName.trim(), type: newCatType });
    setNewCatName("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Kategoriyalar va oylik limit</h3>
          <button className="link-btn" onClick={onClose}>Yopish</button>
        </div>

        <div className="new-cat-form">
          <div className="type-toggle">
            <button
              type="button"
              className={"toggle-btn income" + (newCatType === "income" ? " active" : "")}
              onClick={() => setNewCatType("income")}
            >
              Daromad
            </button>
            <button
              type="button"
              className={"toggle-btn expense" + (newCatType === "expense" ? " active" : "")}
              onClick={() => setNewCatType("expense")}
            >
              Xarajat
            </button>
          </div>
          <div className="new-cat-row">
            <input
              placeholder="Yangi kategoriya nomi"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <button type="button" onClick={handleAddCategory}>Qo'shish</button>
          </div>
        </div>

        <h4 className="cat-section-title">Xarajat kategoriyalari</h4>
        <div className="cat-manage-list">
          {expenseCats.map((c) => {
            const spent = spentByCategory[c.id] || 0;
            const limit = budgets[c.id];
            const pct = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const over = limit && spent > limit;
            return (
              <div key={c.id} className="cat-manage-row">
                <div className="cat-manage-top">
                  <span className="tx-dot" style={{ background: c.color }} />
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-spent">{formatSum(spent)}{limit ? ` / ${formatSum(limit)}` : ""}</span>
                  <button className="link-btn small" onClick={() => startEdit(c)}>Limit</button>
                  <button className="link-btn small danger" onClick={() => onDeleteCategory(c.id)}>O'chirish</button>
                </div>
                {limit ? (
                  <div className="progress-track">
                    <div className={"progress-fill" + (over ? " over" : "")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                {editing === c.id && (
                  <div className="cat-edit-row">
                    <input
                      type="number"
                      placeholder="Oylik limit ($)"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                    <button onClick={() => save(c.id)}>Saqlash</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <h4 className="cat-section-title">Daromad kategoriyalari</h4>
        <div className="cat-manage-list">
          {incomeCats.map((c) => (
            <div key={c.id} className="cat-manage-row">
              <div className="cat-manage-top">
                <span className="tx-dot" style={{ background: c.color }} />
                <span className="cat-name">{c.name}</span>
                <button className="link-btn small danger" onClick={() => onDeleteCategory(c.id)}>O'chirish</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

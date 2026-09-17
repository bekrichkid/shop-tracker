import { useState } from "react";
import { formatSum } from "../format.js";

export default function GoalCard({ goal, monthIncome, monthExpense, onSetGoal }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const saved = Math.max(0, monthIncome - monthExpense);
  const hasGoal = !!goal?.targetAmount;
  const pct = hasGoal ? Math.min(100, Math.round((saved / goal.targetAmount) * 100)) : 0;
  const reached = hasGoal && saved >= goal.targetAmount;

  function startEdit() {
    setName(goal?.name || "Oylik foyda maqsadi");
    setAmount(goal?.targetAmount || "");
    setEditing(true);
  }

  function save() {
    if (!amount || Number(amount) <= 0) return;
    onSetGoal({ name: name.trim() || "Oylik foyda maqsadi", targetAmount: Number(amount) });
    setEditing(false);
  }

  function clear() {
    onSetGoal({ targetAmount: null });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="goal-card">
        <div className="goal-edit-row">
          <input placeholder="Maqsad nomi" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder="Summasi ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="goal-edit-actions">
          <button className="link-btn" onClick={() => setEditing(false)}>Bekor qilish</button>
          {hasGoal && <button className="link-btn danger" onClick={clear}>O'chirish</button>}
          <button className="submit-btn small" onClick={save}>Saqlash</button>
        </div>
      </div>
    );
  }

  if (!hasGoal) {
    return (
      <div className="goal-card goal-empty" onClick={startEdit}>
        <span>+ Shu oy uchun foyda maqsadi qo'yish</span>
      </div>
    );
  }

  return (
    <div className="goal-card">
      <div className="goal-top">
        <span className="goal-name">🎯 {goal.name}</span>
        <button className="link-btn small" onClick={startEdit}>Tahrirlash</button>
      </div>
      <div className="progress-track goal-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: reached ? "var(--income)" : undefined }} />
      </div>
      <div className="goal-bottom">
        <span>{formatSum(saved)} / {formatSum(goal.targetAmount)}</span>
        <span>{reached ? "Maqsadga yetdingiz! 🎉" : `${pct}%`}</span>
      </div>
    </div>
  );
}

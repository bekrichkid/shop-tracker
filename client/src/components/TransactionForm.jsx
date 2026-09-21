import { useState, useMemo } from "react";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function TransactionForm({ categories, onSubmit }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredCats = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const activeCategory = category || filteredCats[0]?.id || "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!amount || Number(amount) <= 0) {
      setError("Summani to'g'ri kiriting");
      return;
    }
    if (!activeCategory) {
      setError("Kategoriya tanlang");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ type, amount: Number(amount), category: activeCategory, note, date: new Date(date).toISOString() });
      setAmount("");
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit}>
      <div className="type-toggle">
        <button
          type="button"
          className={"toggle-btn income" + (type === "income" ? " active" : "")}
          onClick={() => { setType("income"); setCategory(""); }}
        >
          + Daromad
        </button>
        <button
          type="button"
          className={"toggle-btn expense" + (type === "expense" ? " active" : "")}
          onClick={() => { setType("expense"); setCategory(""); }}
        >
          − Xarajat
        </button>
      </div>

      <div className="form-row">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1000"
          placeholder="Summa (so'm)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <select value={activeCategory} onChange={(e) => setCategory(e.target.value)}>
        {filteredCats.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <input
        className="note-input"
        placeholder="Izoh (ixtiyoriy)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </form>
  );
}

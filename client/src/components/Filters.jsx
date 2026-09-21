export default function Filters({ categories, filters, onChange }) {
  function update(patch) {
    onChange({ ...filters, ...patch });
  }
  return (
    <div className="filters">
      <select value={filters.type} onChange={(e) => update({ type: e.target.value, category: "" })}>
        <option value="">Barcha turlar</option>
        <option value="income">Daromad</option>
        <option value="expense">Xarajat</option>
      </select>
      <select value={filters.category} onChange={(e) => update({ category: e.target.value })}>
        <option value="">Barcha kategoriyalar</option>
        {categories
          .filter((c) => !filters.type || c.type === filters.type)
          .map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
      </select>
      <input
        className="search-input"
        placeholder="Izoh bo'yicha qidirish..."
        value={filters.q}
        onChange={(e) => update({ q: e.target.value })}
      />
    </div>
  );
}

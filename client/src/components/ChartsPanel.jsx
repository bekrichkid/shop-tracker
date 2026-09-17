import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatSum } from "../format.js";

export default function ChartsPanel({ periodTransactions, allTransactions, categoryMap }) {
  const pieData = useMemo(() => {
    const totals = {};
    periodTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        totals[t.category] = (totals[t.category] || 0) + t.amount;
      });
    return Object.entries(totals)
      .map(([catId, value]) => ({ name: categoryMap[catId]?.name || "Noma'lum", value, color: categoryMap[catId]?.color || "#999" }))
      .sort((a, b) => b.value - a.value);
  }, [periodTransactions, categoryMap]);

  const barData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, income: 0, expense: 0 });
    }
    const byDay = Object.fromEntries(days.map((d) => [d.key, d]));
    allTransactions.forEach((t) => {
      const key = new Date(t.date).toISOString().slice(0, 10);
      if (byDay[key]) byDay[key][t.type] += t.amount;
    });
    return days;
  }, [allTransactions]);

  return (
    <section className="charts">
      <div className="chart-box">
        <h3>Xarajatlar taqsimoti</h3>
        {pieData.length === 0 ? (
          <div className="empty-state small">Ma'lumot yo'q</div>
        ) : (
          <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 300, height: 220 }}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatSum(v)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="chart-box">
        <h3>Oxirgi 14 kun</h3>
        <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 300, height: 220 }}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} width={40} />
            <Tooltip formatter={(v) => formatSum(v)} />
            <Legend />
            <Bar dataKey="income" name="Daromad" fill="#4a8c6a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Xarajat" fill="#a5473c" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

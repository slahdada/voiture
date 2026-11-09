import { useState } from "react";
import {
  ArrowLeft,
  Wallet,
  TrendingDown,
  Plus,
  Tag,
  Fuel,
  Wrench,
  Calendar,
} from "lucide-react";
import type { Vehicle, Entry, Kind } from "./types";
import { labels } from "./types";
import { fmtDate, money, EntryIcon } from "./Dashboard";
import { total, fmtAmount } from "./calculations";
import { PeriodSelector } from "./PeriodSelector";
import { type PeriodRange, computePeriod, isDateInPeriod, getTunisToday } from "./period";
import { Empty } from "./ui";

interface Props {
  vehicle?: Vehicle;
  entries: Entry[];
  currency: string;
  openEntry: (e: Entry) => void;
  onBack: () => void;
  add: (k: Kind) => void;
}

export function ExpensesScreen({
  vehicle,
  entries,
  currency,
  openEntry,
  onBack,
  add,
}: Props) {
  // Default to current month as explicitly requested in Section 2.B
  const [range, setRange] = useState<PeriodRange>(() =>
    computePeriod("month", getTunisToday())
  );

  const vehicleEntries = vehicle
    ? entries.filter((e) => e.vehicleId === vehicle.id)
    : entries;

  // Filter entries that have a monetary amount
  // Include fuel and charge entries that have an amount, along with maintenance, repair, and expense
  const moneyEntries = vehicleEntries.filter(
    (e) =>
      e.amount !== undefined &&
      Number.isFinite(e.amount) &&
      e.amount >= 0 &&
      (e.kind === "expense" ||
        e.kind === "fuel" ||
        e.kind === "charge" ||
        e.kind === "maintenance" ||
        e.kind === "repair")
  );

  // Filter by period
  const periodExpenses = moneyEntries.filter((e) =>
    isDateInPeriod(e.date, range.start, range.end)
  );

  // Total spent in period
  const periodTotal = total(periodExpenses, currency);

  // Group by category, normalizing fuel/charge into "Carburant & Énergie"
  const getCategoryName = (e: Entry) => {
    if (e.kind === "fuel" || e.kind === "charge") {
      return "Carburant";
    }
    if (e.kind === "maintenance") {
      return e.category?.trim() ? `Entretien (${e.category.trim()})` : "Entretien";
    }
    if (e.kind === "repair") {
      return e.category?.trim() ? `Réparation (${e.category.trim()})` : "Réparation";
    }
    return e.category?.trim() || "Dépense courante";
  };

  const categoryMap = new Map<string, { count: number; total: number; kind: Kind }>();
  for (const e of periodExpenses) {
    const cat = getCategoryName(e);
    const prev = categoryMap.get(cat) ?? { count: 0, total: 0, kind: e.kind };
    categoryMap.set(cat, {
      count: prev.count + 1,
      total: prev.total + (e.amount ?? 0),
      kind: prev.kind,
    });
  }

  const categoryStats = Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total,
      percentage: periodTotal > 0 ? (data.total / periodTotal) * 100 : 0,
      kind: data.kind,
    }))
    .sort((a, b) => b.total - a.total);

  // Chronological list sorted descending for display
  const displayExpenses = [...periodExpenses].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      (b.amount ?? 0) - (a.amount ?? 0)
  );

  return (
    <div className="detail-page-container">
      <div className="page-heading">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={onBack}
            aria-label="Retour au tableau de bord"
          >
            <ArrowLeft size={18} />
            <span>Retour au tableau de bord</span>
          </button>
          <p className="eyebrow">BUDGET & DÉPENSES</p>
          <h1>Dépenses du véhicule</h1>
          <p>
            {vehicle?.name ?? "Véhicule"} · Carburant, entretiens, réparations et
            frais annexes sans double comptage.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => add("expense")}>
            <Plus size={17} />
            Ajouter une dépense
          </button>
        </div>
      </div>

      <PeriodSelector range={range} onChange={setRange} className="mb-4" />

      {/* KPI Cards */}
      <div className="stats-grid mb-4">
        <div className="stat">
          <span>
            Total dépensé sur la période
            <Wallet size={19} />
          </span>
          <strong>{fmtAmount(periodTotal, currency)}</strong>
          <p>{periodExpenses.length} dépense(s) entre {range.start} et {range.end}</p>
        </div>

        <div className="stat">
          <span>
            Nombre de dépenses
            <Calendar size={19} />
          </span>
          <strong>{periodExpenses.length}</strong>
          <p>{range.label}</p>
        </div>

        <div className="stat">
          <span>
            Dépense moyenne
            <TrendingDown size={19} />
          </span>
          <strong>
            {periodExpenses.length > 0
              ? fmtAmount(periodTotal / periodExpenses.length, currency)
              : "—"}
          </strong>
          <p>Par enregistrement sur la période</p>
        </div>

        <div className="stat">
          <span>
            Poste principal
            <Tag size={19} />
          </span>
          <strong style={{ fontSize: "16px" }}>
            {categoryStats[0] ? categoryStats[0].name : "—"}
          </strong>
          <p>
            {categoryStats[0]
              ? `${fmtAmount(categoryStats[0].total, currency)} (${categoryStats[0].percentage.toFixed(1)}%)`
              : "Aucune dépense"}
          </p>
        </div>
      </div>

      {/* Categories Breakdown */}
      {categoryStats.length > 0 && (
        <section className="panel mb-4">
          <div className="section-head">
            <div>
              <p className="eyebrow">RÉPARTITION PAR CATÉGORIE</p>
              <h2>Budget ventilé sur {range.label.toLowerCase()}</h2>
            </div>
            <strong style={{ fontSize: "15px", color: "var(--green)" }}>
              Total : {fmtAmount(periodTotal, currency)}
            </strong>
          </div>

          <div className="category-chart" style={{ marginTop: "12px" }}>
            {categoryStats.map((cat, idx) => (
              <div key={cat.name} style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <i
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: [
                          "#194c3f",
                          "#9b8241",
                          "#69859b",
                          "#a47c69",
                          "#71916c",
                          "#5b7b56",
                        ][idx % 6],
                        display: "inline-block",
                      }}
                    />
                    {cat.name} ({cat.count})
                  </span>
                  <span>
                    <strong>{fmtAmount(cat.total, currency)}</strong>
                    <small style={{ marginLeft: "8px", color: "#728077" }}>
                      {cat.percentage.toFixed(1)}%
                    </small>
                  </span>
                </div>
                <div
                  style={{
                    height: "7px",
                    background: "#f0f2eb",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginTop: "6px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${cat.percentage}%`,
                      background: [
                        "#194c3f",
                        "#9b8241",
                        "#69859b",
                        "#a47c69",
                        "#71916c",
                        "#5b7b56",
                      ][idx % 6],
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detailed List */}
      <section className="panel journal-panel">
        <div className="section-head" style={{ padding: "18px 24px 0" }}>
          <div>
            <p className="eyebrow">DÉTAIL DES TRANSACTIONS</p>
            <h2>Liste des dépenses ({displayExpenses.length})</h2>
          </div>
        </div>

        {displayExpenses.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "#728077",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    background: "#f9faf5",
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Libellé</th>
                  <th style={{ padding: "12px 16px" }}>Catégorie</th>
                  <th style={{ padding: "12px 16px" }}>Véhicule</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>
                    Montant ({currency})
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayExpenses.map((e) => (
                  <tr
                    key={e.id}
                    style={{
                      borderBottom: "1px solid #edf0e6",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() => openEntry(e)}
                  >
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <strong>{fmtDate(e.date)}</strong>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <EntryIcon kind={e.kind} />
                        <div>
                          <strong>{e.title}</strong>
                          {e.garage && <small style={{ display: "block" }}>{e.garage}</small>}
                        </div>
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="tag" style={{ fontSize: "11px" }}>
                        {getCategoryName(e)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {vehicle?.name ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      {fmtAmount(e.amount ?? 0, currency)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: "11px", fontWeight: 600 }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEntry(e);
                        }}
                      >
                        Modifier →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Wallet size={30} />}
            title="Aucune dépense sur cette période"
            text={`Aucune dépense n'a été enregistrée pour ${vehicle?.name ?? "ce véhicule"} sur la période "${range.label}".`}
            action={
              <button className="secondary" onClick={() => add("expense")}>
                <Plus size={16} />
                Ajouter une dépense
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

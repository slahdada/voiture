import { useState } from "react";
import {
  ArrowLeft,
  Fuel,
  TrendingUp,
  Plus,
  Route,
  Wallet,
  Calendar,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Vehicle, Entry, Kind } from "./types";
import { fmtDate } from "./Dashboard";
import {
  analyzeFuelEntries,
  fmtAmount,
  fmtDecimal,
  fmtLitres,
  fmtConsumption,
  fmtUnitPrice,
  type FuelEntryAnalysis,
} from "./calculations";
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

export function FuelScreen({
  vehicle,
  entries,
  currency,
  openEntry,
  onBack,
  add,
}: Props) {
  const [range, setRange] = useState<PeriodRange>(() =>
    computePeriod("month", getTunisToday())
  );

  const vehicleId = vehicle?.id;
  const vehicleEntries = vehicleId
    ? entries.filter((e) => e.vehicleId === vehicleId)
    : entries;

  // Run full fuel analysis for this vehicle
  const analysisMap = analyzeFuelEntries(vehicleEntries, vehicleId);
  const allFuelAnalyses = Array.from(analysisMap.values());

  // 1. Carburant acheté pendant la période (filtré strictement par la date du plein)
  const fuelsPurchasedInPeriod = vehicleEntries.filter(
    (e) => e.kind === "fuel" && isDateInPeriod(e.date, range.start, range.end)
  );

  const periodLitresBought = fuelsPurchasedInPeriod.reduce(
    (sum, e) =>
      sum +
      (e.quantity !== undefined && Number.isFinite(e.quantity) && e.quantity >= 0
        ? e.quantity
        : 0),
    0
  );

  const periodAmountBought = fuelsPurchasedInPeriod.reduce(
    (sum, e) =>
      sum +
      (e.amount !== undefined && Number.isFinite(e.amount) && e.amount >= 0
        ? e.amount
        : 0),
    0
  );

  // 2. Consommations calculées : retenir les intervalles dont le plein complet de FIN appartient à la période sélectionnée
  const validIntervalsInPeriod: FuelEntryAnalysis[] = allFuelAnalyses.filter(
    (fa) =>
      fa.consumptionStatus === "valid" &&
      fa.consumption !== undefined &&
      isDateInPeriod(fa.entry.date, range.start, range.end)
  );

  const totalValidLitres = validIntervalsInPeriod.reduce(
    (sum, fa) => sum + (fa.intervalLitres ?? 0),
    0
  );
  const totalValidDistance = validIntervalsInPeriod.reduce(
    (sum, fa) => sum + (fa.intervalDistance ?? 0),
    0
  );

  const weightedAverageConsumption =
    totalValidDistance > 0
      ? (totalValidLitres / totalValidDistance) * 100
      : undefined;

  const averageLabel =
    weightedAverageConsumption !== undefined
      ? fmtConsumption(weightedAverageConsumption)
      : "Aucune consommation calculable pour cette période";

  // List of all fuel entries in period for display
  const periodAnalyses = allFuelAnalyses
    .filter((fa) => isDateInPeriod(fa.entry.date, range.start, range.end))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.entry.createdAt.localeCompare(a.entry.createdAt));

  // Max consumption for visual chart
  const maxCons = Math.max(
    ...validIntervalsInPeriod.map((v) => v.consumption ?? 0),
    12
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
          <p className="eyebrow">CONSOMMATION & PLEINS</p>
          <h1>Consommation et carburant</h1>
          <p>
            {vehicle?.name ?? "Véhicule"} · Analyse rigoureuse entre pleins complets
            sans découpage artificiel.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => add("fuel")}>
            <Plus size={17} />
            Ajouter un plein
          </button>
        </div>
      </div>

      <PeriodSelector range={range} onChange={setRange} className="mb-4" />

      {/* KPI Cards */}
      <div className="stats-grid mb-4">
        <div className="stat">
          <span>
            Consommation moyenne pondérée
            <TrendingUp size={19} />
          </span>
          <strong
            style={{
              fontSize: weightedAverageConsumption !== undefined ? "22px" : "15px",
              color: weightedAverageConsumption !== undefined ? "var(--green)" : "#879080",
            }}
          >
            {averageLabel}
          </strong>
          <p>
            {totalValidDistance > 0
              ? `${fmtDecimal(totalValidLitres, 3)} L ÷ ${totalValidDistance.toLocaleString("fr-FR")} km × 100`
              : "Calculée sur les intervalles valides clos dans la période"}
          </p>
        </div>

        <div className="stat">
          <span>
            Carburant acheté (période)
            <Fuel size={19} />
          </span>
          <strong>{fmtLitres(periodLitresBought)}</strong>
          <p>Volume acheté entre {range.start} et {range.end}</p>
        </div>

        <div className="stat">
          <span>
            Montant carburant (période)
            <Wallet size={19} />
          </span>
          <strong>{fmtAmount(periodAmountBought, currency)}</strong>
          <p>{fuelsPurchasedInPeriod.length} plein(s) d'essence/diesel</p>
        </div>

        <div className="stat">
          <span>
            Distance des intervalles analysés
            <Route size={19} />
          </span>
          <strong>
            {totalValidDistance > 0 ? `${totalValidDistance.toLocaleString("fr-FR")}` : "0"}
            <small> km</small>
          </strong>
          <p>{validIntervalsInPeriod.length} intervalle(s) de consommation validé(s)</p>
        </div>
      </div>

      {/* Clarification banner between purchases and consumption intervals */}
      <div className="info mb-4" role="note">
        <Info size={18} />
        <span>
          <strong>Méthode de calcul certifiée :</strong> Les achats de carburant ({fmtLitres(periodLitresBought)} / {fmtAmount(periodAmountBought, currency)})
          sont comptabilisés selon la date exacte de chaque passage à la pompe.
          Les consommations sont calculées sur des cycles réels entre deux pleins complets (pleins partiels intermédiaires inclus).
          Seuls les cycles clôturés dans la période sélectionnée sont retenus dans la moyenne.
        </span>
      </div>

      {/* Visual Chart of valid intervals */}
      {validIntervalsInPeriod.length > 0 && (
        <section className="panel mb-4">
          <div className="section-head">
            <div>
              <p className="eyebrow">GRAPHIQUE DES CYCLES</p>
              <h2>Consommation des intervalles clos ({validIntervalsInPeriod.length})</h2>
            </div>
            <strong style={{ fontSize: "14px", color: "var(--green)" }}>
              Moyenne : {fmtConsumption(weightedAverageConsumption!)}
            </strong>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "14px",
              height: "160px",
              paddingTop: "25px",
              overflowX: "auto",
            }}
          >
            {validIntervalsInPeriod.map((v, i) => {
              const val = v.consumption!;
              const heightPct = Math.min(100, Math.max(10, (val / maxCons) * 100));
              const startsBeforePeriod = v.fromDate && v.fromDate < range.start;

              return (
                <div
                  key={`chart-bar-${v.entry.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    flex: "1 0 75px",
                    maxWidth: "110px",
                  }}
                >
                  <small style={{ fontSize: "11px", fontWeight: 700 }}>
                    {fmtDecimal(val, 2)}
                  </small>
                  <div
                    style={{
                      height: "100px",
                      width: "100%",
                      background: "#f0f4ec",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "flex-end",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        background: startsBeforePeriod ? "#9b8241" : "#194c3f",
                        borderRadius: "6px",
                        transition: "height 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "9px", color: "#728077", textAlign: "center", whiteSpace: "nowrap" }}>
                    {fmtDate(v.entry.date)}
                  </span>
                </div>
              );
            })}
          </div>
          <small style={{ display: "block", marginTop: "12px", color: "#728077" }}>
            Légende : Vert = cycle complet dans la période · Brun doré = cycle démarré avant la période.
          </small>
        </section>
      )}

      {/* Detail Table */}
      <section className="panel journal-panel">
        <div className="section-head" style={{ padding: "18px 24px 0" }}>
          <div>
            <p className="eyebrow">HISTORIQUE DÉTAILLÉ</p>
            <h2>Pleins et consommations ({periodAnalyses.length})</h2>
          </div>
        </div>

        {periodAnalyses.length > 0 ? (
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
                  <th style={{ padding: "12px 14px" }}>Date</th>
                  <th style={{ padding: "12px 14px" }}>Compteur</th>
                  <th style={{ padding: "12px 14px" }}>Distance cycle</th>
                  <th style={{ padding: "12px 14px" }}>Quantité</th>
                  <th style={{ padding: "12px 14px" }}>Prix / L</th>
                  <th style={{ padding: "12px 14px" }}>Montant</th>
                  <th style={{ padding: "12px 14px" }}>Plein</th>
                  <th style={{ padding: "12px 14px" }}>Consommation</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {periodAnalyses.map((fa) => {
                  const e = fa.entry;
                  const startsBefore =
                    fa.consumptionStatus === "valid" &&
                    fa.fromDate &&
                    fa.fromDate < range.start;

                  return (
                    <tr
                      key={e.id}
                      style={{
                        borderBottom: "1px solid #edf0e6",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onClick={() => openEntry(e)}
                    >
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <strong>{fmtDate(e.date)}</strong>
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {e.km !== undefined ? `${e.km.toLocaleString("fr-FR")} km` : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {fa.kmError ? (
                          <span className="danger">Erreur km</span>
                        ) : fa.intervalDistance !== undefined ? (
                          <span>
                            <strong>{fa.intervalDistance.toLocaleString("fr-FR")} km</strong>
                            {startsBefore && (
                              <small style={{ display: "block", color: "#967829" }}>
                                Débuté le {fmtDate(fa.fromDate!)}
                              </small>
                            )}
                          </span>
                        ) : fa.distance !== undefined ? (
                          `${fa.distance.toLocaleString("fr-FR")} km`
                        ) : (
                          "Données insuffisantes"
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {e.quantity !== undefined ? fmtLitres(e.quantity) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {e.unitPrice !== undefined ? fmtUnitPrice(e.unitPrice, currency) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {e.amount !== undefined ? fmtAmount(e.amount, currency) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          className={`tag ${e.full ? "green-tag" : "soon"}`}
                          style={{ fontSize: "10px", padding: "3px 6px" }}
                        >
                          {e.full ? "Complet" : "Partiel"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {fa.consumptionStatus === "valid" ? (
                          <div>
                            <strong style={{ fontSize: "13px", color: "var(--green)" }}>
                              {fa.consumptionLabel}
                            </strong>
                            {startsBefore && (
                              <span
                                className="tag soon"
                                style={{
                                  display: "inline-block",
                                  marginTop: "3px",
                                  fontSize: "9px",
                                  padding: "2px 5px",
                                }}
                              >
                                Débuté hors période ({fmtDate(fa.fromDate!)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#728077" }}>{fa.consumptionLabel}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="text-button"
                          style={{ fontSize: "11px", fontWeight: 600 }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEntry(e);
                          }}
                        >
                          Détail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Fuel size={30} />}
            title="Aucun plein sur cette période"
            text={`Aucun plein de carburant n'a été enregistré pour ${vehicle?.name ?? "ce véhicule"} sur la période "${range.label}".`}
            action={
              <button className="secondary" onClick={() => add("fuel")}>
                <Plus size={16} />
                Ajouter un plein
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

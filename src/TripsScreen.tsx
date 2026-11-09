import { useState } from "react";
import {
  ArrowLeft,
  Route,
  Navigation,
  Plus,
  Calendar,
  AlertCircle,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import type { Vehicle, Entry, Kind } from "./types";
import { fmtDate } from "./Dashboard";
import { tripDistance } from "./calculations";
import { PeriodSelector } from "./PeriodSelector";
import { type PeriodRange, computePeriod, isDateInPeriod, getTunisToday } from "./period";
import { Empty } from "./ui";

interface Props {
  vehicle?: Vehicle;
  entries: Entry[];
  openEntry: (e: Entry) => void;
  onBack: () => void;
  add: (k: Kind) => void;
}

export function TripsScreen({
  vehicle,
  entries,
  openEntry,
  onBack,
  add,
}: Props) {
  const [range, setRange] = useState<PeriodRange>(() =>
    computePeriod("month", getTunisToday())
  );

  const vehicleEntries = vehicle
    ? entries.filter((e) => e.vehicleId === vehicle.id)
    : entries;

  // Filter trip entries
  const allTrips = vehicleEntries.filter((e) => e.kind === "trip");

  // Trips in selected period
  const periodTrips = allTrips.filter((e) =>
    isDateInPeriod(e.date, range.start, range.end)
  );

  // Completed trips (both startKm and endKm valid and endKm >= startKm)
  const completeTrips = periodTrips.filter(
    (e) =>
      e.startKm !== undefined &&
      e.endKm !== undefined &&
      Number.isFinite(e.startKm) &&
      Number.isFinite(e.endKm) &&
      e.endKm >= e.startKm
  );

  const incompleteTrips = periodTrips.filter(
    (e) =>
      e.startKm === undefined ||
      e.endKm === undefined ||
      e.endKm < e.startKm
  );

  // Total distance using existing overlap merge function tripDistance
  const totalMergedDistance = tripDistance(periodTrips);

  // Raw sum of individual distances
  const rawSumDistance = completeTrips.reduce(
    (sum, e) => sum + (e.endKm! - e.startKm!),
    0
  );
  const overlapDiff = rawSumDistance - totalMergedDistance;

  // Display trips sorted descending
  const displayTrips = [...periodTrips].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt)
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
          <p className="eyebrow">DÉPLACEMENTS & TRAJETS</p>
          <h1>Trajets du véhicule</h1>
          <p>
            {vehicle?.name ?? "Véhicule"} · Suivi kilométrique précis avec fusion
            des chevauchements et exclusion des trajets incomplets.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => add("trip")}>
            <Plus size={17} />
            Ajouter un trajet
          </button>
        </div>
      </div>

      <PeriodSelector range={range} onChange={setRange} className="mb-4" />

      {/* KPI Cards */}
      <div className="stats-grid mb-4">
        <div className="stat">
          <span>
            Distance totale des trajets
            <Route size={19} />
          </span>
          <strong>
            {totalMergedDistance.toLocaleString("fr-FR")}
            <small> km</small>
          </strong>
          <p>
            {overlapDiff > 0
              ? `${overlapDiff.toLocaleString("fr-FR")} km de chevauchements déduits`
              : "Trajets complets sans double comptage"}
          </p>
        </div>

        <div className="stat">
          <span>
            Nombre de trajets
            <Navigation size={19} />
          </span>
          <strong>{periodTrips.length}</strong>
          <p>{range.label}</p>
        </div>

        <div className="stat">
          <span>
            Trajets complets
            <CheckCircle2 size={19} />
          </span>
          <strong>{completeTrips.length}</strong>
          <p>Compteurs de départ et d’arrivée renseignés</p>
        </div>

        <div className="stat">
          <span>
            Trajets incomplets
            <AlertCircle size={19} />
          </span>
          <strong style={{ color: incompleteTrips.length > 0 ? "#967829" : "inherit" }}>
            {incompleteTrips.length}
          </strong>
          <p>Exclus du calcul cumulé de distance</p>
        </div>
      </div>

      {incompleteTrips.length > 0 && (
        <div className="warning mb-4" role="note">
          <AlertCircle size={18} />
          <span>
            <strong>Attention :</strong> {incompleteTrips.length} trajet(s) incomplet(s) sur cette période.
            Les trajets sans compteur de départ ou d’arrivée ne permettent pas un calcul fiable et sont exclus du total kilométrique.
          </span>
        </div>
      )}

      {/* Detailed List */}
      <section className="panel journal-panel">
        <div className="section-head" style={{ padding: "18px 24px 0" }}>
          <div>
            <p className="eyebrow">RELEVÉS DE TRAJETS</p>
            <h2>Liste des trajets ({displayTrips.length})</h2>
          </div>
        </div>

        {displayTrips.length > 0 ? (
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
                  <th style={{ padding: "12px 16px" }}>Trajet / Libellé</th>
                  <th style={{ padding: "12px 16px" }}>Itinéraire</th>
                  <th style={{ padding: "12px 16px" }}>Départ (km)</th>
                  <th style={{ padding: "12px 16px" }}>Arrivée (km)</th>
                  <th style={{ padding: "12px 16px" }}>Distance</th>
                  <th style={{ padding: "12px 16px" }}>Conducteur / Motif</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTrips.map((e) => {
                  const isComplete =
                    e.startKm !== undefined &&
                    e.endKm !== undefined &&
                    e.endKm >= e.startKm;
                  const distance = isComplete ? e.endKm! - e.startKm! : undefined;

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
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <strong>{fmtDate(e.date)}</strong>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Route size={16} style={{ color: "var(--green)" }} />
                          <strong>{e.title}</strong>
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {e.origin || e.destination ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={13} style={{ color: "#728077" }} />
                            {e.origin || "?"} → {e.destination || "?"}
                          </span>
                        ) : (
                          <span style={{ color: "#a2aa99" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {e.startKm !== undefined ? `${e.startKm.toLocaleString("fr-FR")} km` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {e.endKm !== undefined ? `${e.endKm.toLocaleString("fr-FR")} km` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {isComplete ? (
                          <span
                            className="tag green-tag"
                            style={{ fontSize: "11px", fontWeight: 700 }}
                          >
                            {distance!.toLocaleString("fr-FR")} km
                          </span>
                        ) : (
                          <span className="tag soon" style={{ fontSize: "10px" }}>
                            Incomplet
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <small>
                          {[e.driver, e.purpose].filter(Boolean).join(" · ") || "—"}
                        </small>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Route size={30} />}
            title="Aucun trajet sur cette période"
            text={`Aucun trajet n'a été enregistré pour ${vehicle?.name ?? "ce véhicule"} sur la période "${range.label}".`}
            action={
              <button className="secondary" onClick={() => add("trip")}>
                <Plus size={16} />
                Ajouter un trajet
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

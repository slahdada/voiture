import { useState } from "react";
import {
  ArrowLeft,
  Gauge,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileText,
  Plus,
} from "lucide-react";
import type { Vehicle, Entry, Kind } from "./types";
import { labels } from "./types";
import { fmtDate, EntryIcon } from "./Dashboard";
import { currentKm } from "./calculations";
import { PeriodSelector } from "./PeriodSelector";
import { type PeriodRange, computePeriod, isDateInPeriod, getTunisToday } from "./period";
import { Empty } from "./ui";

interface Props {
  vehicle?: Vehicle;
  entries: Entry[];
  openEntry: (e: Entry) => void;
  openVehicle: () => void;
  onBack: () => void;
  add: (k: Kind) => void;
}

export interface MileageReading {
  id: string;
  date: string;
  km: number;
  kind: Kind | "initial";
  title: string;
  sourceEntry?: Entry;
  sourceVehicle?: Vehicle;
  createdAt: string;
  isInitial?: boolean;
}

export function MileageScreen({
  vehicle,
  entries,
  openEntry,
  openVehicle,
  onBack,
  add,
}: Props) {
  const [range, setRange] = useState<PeriodRange>(() =>
    computePeriod("month", getTunisToday())
  );

  const vehicleEntries = vehicle
    ? entries.filter((e) => e.vehicleId === vehicle.id)
    : entries;

  // Extract all mileage points
  const allReadings: MileageReading[] = [];

  if (vehicle && vehicle.initialKm !== undefined && vehicle.readingDate) {
    allReadings.push({
      id: `initial-${vehicle.id}`,
      date: vehicle.readingDate,
      km: vehicle.initialKm,
      kind: "initial",
      title: "Relevé initial du véhicule",
      sourceVehicle: vehicle,
      createdAt: vehicle.createdAt,
      isInitial: true,
    });
  }

  for (const e of vehicleEntries) {
    if (e.kind === "trip") {
      if (e.startKm !== undefined && Number.isFinite(e.startKm) && e.startKm >= 0) {
        allReadings.push({
          id: `trip-start-${e.id}`,
          date: e.date,
          km: e.startKm,
          kind: "trip",
          title: `${e.title} (départ)`,
          sourceEntry: e,
          createdAt: e.createdAt,
        });
      }
      if (e.endKm !== undefined && Number.isFinite(e.endKm) && e.endKm >= 0) {
        allReadings.push({
          id: `trip-end-${e.id}`,
          date: e.date,
          km: e.endKm,
          kind: "trip",
          title: `${e.title} (arrivée)`,
          sourceEntry: e,
          createdAt: e.createdAt,
        });
      }
    } else if (e.km !== undefined && Number.isFinite(e.km) && e.km >= 0) {
      allReadings.push({
        id: `entry-${e.id}`,
        date: e.date,
        km: e.km,
        kind: e.kind,
        title: e.title,
        sourceEntry: e,
        createdAt: e.createdAt,
      });
    }
  }

  // Sort chronologically ascending for progression, or descending for latest
  const sortedAll = [...allReadings].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.km - b.km
  );

  // Overall last known mileage
  const lastKnownGlobalKm = vehicle ? currentKm(vehicle, vehicleEntries) : sortedAll.at(-1)?.km;
  const lastGlobalReading = sortedAll.at(-1);

  // Filter by selected period
  const periodReadings = sortedAll.filter((r) =>
    isDateInPeriod(r.date, range.start, range.end)
  );

  // Chronological list sorted descending for display
  const displayReadings = [...periodReadings].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.km - a.km
  );

  const minKmInPeriod = periodReadings.length
    ? Math.min(...periodReadings.map((r) => r.km))
    : undefined;
  const maxKmInPeriod = periodReadings.length
    ? Math.max(...periodReadings.map((r) => r.km))
    : undefined;

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
          <p className="eyebrow">HISTORIQUE KILOMÉTRIQUE</p>
          <h1>Historique du kilométrage</h1>
          <p>
            {vehicle?.name ?? "Véhicule"} · Tous les relevés issus de vos trajets,
            pleins et entretiens.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => add("reading")}>
            <Plus size={17} />
            Noter un relevé
          </button>
        </div>
      </div>

      <PeriodSelector range={range} onChange={setRange} className="mb-4" />

      {/* Summary KPI Cards */}
      <div className="stats-grid mb-4">
        <div className="stat">
          <span>
            Dernier kilométrage connu
            <Gauge size={19} />
          </span>
          <strong>
            {lastKnownGlobalKm !== undefined
              ? `${lastKnownGlobalKm.toLocaleString("fr-FR")}`
              : "—"}
            <small> km</small>
          </strong>
          <p>
            {lastGlobalReading
              ? `Relevé le ${fmtDate(lastGlobalReading.date)} (${lastGlobalReading.title})`
              : "Aucun relevé enregistré"}
          </p>
        </div>

        <div className="stat">
          <span>
            Relevés sur la période
            <Calendar size={19} />
          </span>
          <strong>{periodReadings.length}</strong>
          <p>{range.label}</p>
        </div>

        <div className="stat">
          <span>
            Plus bas relevé période
            <TrendingUp size={19} />
          </span>
          <strong>
            {minKmInPeriod !== undefined
              ? `${minKmInPeriod.toLocaleString("fr-FR")}`
              : "—"}
            <small> km</small>
          </strong>
          <p>Minimum enregistré entre {range.start} et {range.end}</p>
        </div>

        <div className="stat">
          <span>
            Plus haut relevé période
            <TrendingUp size={19} />
          </span>
          <strong>
            {maxKmInPeriod !== undefined
              ? `${maxKmInPeriod.toLocaleString("fr-FR")}`
              : "—"}
            <small> km</small>
          </strong>
          <p>Maximum enregistré entre {range.start} et {range.end}</p>
        </div>
      </div>

      {periodReadings.length > 1 && (
        <div className="info mb-4" role="note">
          <AlertCircle size={18} />
          <span>
            <strong>Information distance :</strong> La différence entre le plus
            haut relevé ({maxKmInPeriod?.toLocaleString("fr-FR")} km) et le plus bas ({minKmInPeriod?.toLocaleString("fr-FR")} km)
            vaut {(maxKmInPeriod! - minKmInPeriod!).toLocaleString("fr-FR")} km.
            Cette valeur n'est une distance exacte de la période que si ces relevés correspondent précisément aux bornes du début et de la fin de la période.
          </span>
        </div>
      )}

      {/* Detail Table */}
      <section className="panel journal-panel">
        <div className="section-head" style={{ padding: "18px 24px 0" }}>
          <div>
            <p className="eyebrow">RELEVÉS CHRONOLOGIQUES</p>
            <h2>{periodReadings.length} relevé(s) sur {range.label.toLowerCase()}</h2>
          </div>
        </div>

        {displayReadings.length > 0 ? (
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
                  <th style={{ padding: "12px 16px" }}>Compteur</th>
                  <th style={{ padding: "12px 16px" }}>Type d’événement</th>
                  <th style={{ padding: "12px 16px" }}>Détail / Libellé</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayReadings.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: "1px solid #edf0e6",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() => {
                      if (r.sourceEntry) openEntry(r.sourceEntry);
                      else if (r.sourceVehicle) openVehicle();
                    }}
                  >
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <strong>{fmtDate(r.date)}</strong>
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span className="tag" style={{ fontSize: "12px", padding: "4px 8px", fontWeight: 700 }}>
                        {r.km.toLocaleString("fr-FR")} km
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {r.kind === "initial" ? (
                          <Gauge size={16} />
                        ) : (
                          <EntryIcon kind={r.kind} />
                        )}
                        <span>{r.kind === "initial" ? "Relevé initial" : labels[r.kind]}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <strong>{r.title}</strong>
                      {r.sourceEntry?.garage && (
                        <small style={{ display: "block" }}>{r.sourceEntry.garage}</small>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: "11px", fontWeight: 600 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (r.sourceEntry) openEntry(r.sourceEntry);
                          else if (r.sourceVehicle) openVehicle();
                        }}
                      >
                        Voir la fiche →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Gauge size={30} />}
            title="Aucun relevé sur cette période"
            text={`Aucun compteur kilométrique n'a été saisi pour ${vehicle?.name ?? "ce véhicule"} sur la période "${range.label}".`}
            action={
              <button className="secondary" onClick={() => add("reading")}>
                <Plus size={16} />
                Ajouter un relevé kilométrique
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

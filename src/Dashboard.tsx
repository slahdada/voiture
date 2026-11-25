import { useMemo, useState } from "react";
import {
  Gauge,
  Wallet,
  Fuel,
  ArrowRight,
  ChevronRight,
  Plus,
  Route,
  Wrench,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
  FileText,
  BarChart3,
} from "lucide-react";
import { generateMaintenanceReport } from "./io";
import { AttachmentImage, Empty } from "./ui";
import {
  currentKm,
  total,
  consumption,
  tripDistance,
  status,
  kmWarnings,
  fuelStats,
  fmtAmount,
  fmtLitres,
  fmtDecimal,
} from "./calculations";
import {
  today,
  labels,
  type State,
  type Vehicle,
  type Entry,
  type Deadline,
  type Kind,
} from "./types";

export const fmtDate = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const money = (n: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    ...(currency === "TND"
      ? { minimumFractionDigits: 3, maximumFractionDigits: 3 }
      : {}),
  }).format(n);

export function derivedDeadlines(
  entries: Entry[],
): (Deadline & { source: string })[] {
  return entries
    .filter((e) => e.nextDate || e.nextKm !== undefined || e.expiry)
    .map((e) => ({
      id: `entry-${e.id}`,
      vehicleId: e.vehicleId,
      title: e.expiry
        ? `${e.title} — expiration`
        : `${e.title} — prochaine échéance`,
      date: e.nextDate ?? e.expiry,
      km: e.nextKm,
      done: false,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      source: e.id,
    }));
}

export function EntryIcon({ kind }: { kind: Kind }) {
  const Icon =
    kind === "trip"
      ? Route
      : kind === "fuel" || kind === "charge"
        ? Fuel
        : kind === "maintenance" || kind === "repair"
          ? Wrench
          : kind === "expense"
            ? Wallet
            : kind === "reading"
              ? Gauge
              : ShieldCheck;
  return (
    <span className={`entry-icon ${kind}`}>
      <Icon size={19} />
    </span>
  );
}

const CATEGORY_COLORS = [
  "#194c3f",
  "#7b9a6d",
  "#b69c55",
  "#5a7d7c",
  "#8c7a6b",
  "#476b5e",
];

export function Dashboard({
  state,
  vehicle,
  entries,
  deadlines,
  add,
  openVehicle,
  openEntry,
  openCarnet,
  openDeadlines,
  openMileage,
  openExpenses,
  openFuel,
  openTrips,
  act,
}: {
  state: State;
  vehicle?: Vehicle;
  entries: Entry[];
  deadlines: Deadline[];
  add: (k: Kind) => void;
  openVehicle: () => void;
  openEntry: (e: Entry) => void;
  openCarnet: () => void;
  openDeadlines: () => void;
  openMileage?: () => void;
  openExpenses?: () => void;
  openFuel?: () => void;
  openTrips?: () => void;
  act: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [chartHorizon, setChartHorizon] = useState<6 | 12>(6);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedConsIndex, setSelectedConsIndex] = useState<number | null>(null);

  const currency = state.settings.currency;
  const km = useMemo(
    () => (vehicle ? currentKm(vehicle, entries) : undefined),
    [vehicle, entries],
  );
  const month = today().slice(0, 7);
  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(month)),
    [entries, month],
  );
  const cons = useMemo(() => consumption(entries), [entries]);
  const last = cons.at(-1);
  const fStats = useMemo(
    () => fuelStats(entries, vehicle?.id),
    [entries, vehicle?.id],
  );
  const currentYear = today().slice(0, 4);
  const yearEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(currentYear)),
    [entries, currentYear],
  );

  const cats = useMemo(() => {
    const names = [
      ...new Set(
        yearEntries
          .filter((e) => e.amount !== undefined)
          .map((e) => e.category || labels[e.kind]),
      ),
    ];
    return names
      .map((c) => {
        const matching = yearEntries.filter(
          (e) => (e.category || labels[e.kind]) === c,
        );
        return {
          name: c,
          count: matching.length,
          value: total(matching, currency),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [yearEntries, currency]);

  const catTotal = useMemo(
    () => cats.reduce((s, c) => s + c.value, 0),
    [cats],
  );

  const months = useMemo(() => {
    return Array.from({ length: chartHorizon }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (chartHorizon - 1) + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mEntries = entries.filter((e) => e.date.startsWith(key));
      const fuelVal = total(
        mEntries.filter((e) => e.kind === "fuel" || e.kind === "charge"),
        currency,
      );
      const totalVal = total(mEntries, currency);
      return {
        key,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        fullLabel: d.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
        value: totalVal,
        fuelValue: fuelVal,
        otherValue: Math.max(0, totalVal - fuelVal),
        count: mEntries.length,
      };
    });
  }, [entries, currency, chartHorizon]);

  const maximum = useMemo(
    () => Math.max(...months.map((m) => m.value), 1),
    [months],
  );
  const avgMonthSpend = useMemo(() => {
    const active = months.filter((m) => m.value > 0);
    if (!active.length) return 0;
    return active.reduce((acc, m) => acc + m.value, 0) / active.length;
  }, [months]);

  const activeMonth = useMemo(
    () =>
      months.find((m) => m.key === selectedMonthKey) ??
      months[months.length - 1],
    [months, selectedMonthKey],
  );

  const recentActivities = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        )
        .slice(0, 5),
    [entries],
  );

  const upcomingDeadlines = useMemo(
    () =>
      deadlines
        .filter((d) => !d.done)
        .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
        .slice(0, 3),
    [deadlines],
  );

  const recentCons = useMemo(() => cons.slice(-8), [cons]);
  const maxCons = useMemo(
    () => Math.max(...recentCons.map((c) => c.value), 1),
    [recentCons],
  );
  const avgConsValue = fStats.averageConsumption ?? (last ? last.value : 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VOTRE CARNET DE BORD</p>
          <h1>La route, l’esprit tranquille.</h1>
          <p>Tout ce qu’il faut savoir sur votre voiture, au même endroit.</p>
        </div>
        <span className="date-pill">
          <CalendarDays size={16} />
          {fmtDate(today())}
        </span>
      </div>

      <div className="hero-row">
        <section className="vehicle-card">
          <div className="vehicle-card-top">
            <span className="tag light">
              {vehicle ? "MON VÉHICULE" : "BIENVENUE"}
            </span>
            <button className="text-light" onClick={openVehicle}>
              {vehicle ? "Voir la fiche" : "Ajouter"}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="vehicle-card-body">
            <div>
              <h2>{vehicle?.name ?? "Votre voiture mérite un carnet."}</h2>
              <p>
                {vehicle
                  ? [vehicle.brand, vehicle.model, vehicle.year]
                      .filter(Boolean)
                      .join(" · ")
                  : "Commencez par ajouter votre véhicule."}
              </p>
              {vehicle ? (
                <span className="plate">
                  {vehicle.plate || "Immatriculation non renseignée"}
                </span>
              ) : (
                <button className="cream" onClick={openVehicle}>
                  <Plus size={17} />
                  Ajouter mon véhicule
                </button>
              )}
              <div className="vehicle-meta">
                {vehicle?.energy && (
                  <span>
                    <Fuel size={15} />
                    {vehicle.energy}
                  </span>
                )}
                <span>
                  <ShieldCheck size={15} />
                  Données sur cet appareil
                </span>
              </div>
              {vehicle && (
                <button
                  className="secondary full vehicle-report-btn"
                  onClick={() =>
                    void act(() =>
                      generateMaintenanceReport(
                        entries,
                        vehicle,
                        state.settings.currency,
                      ),
                    )
                  }
                >
                  <FileText size={16} />
                  Dossier d'Entretien (PDF)
                </button>
              )}
            </div>
            <AttachmentImage
              id={vehicle?.photoId}
              alt={vehicle?.name ?? "Voiture"}
              className="vehicle-art"
            />
          </div>
        </section>

        <section className="quick-card">
          <p className="eyebrow">UN NOUVEL ÉVÉNEMENT ?</p>
          <h3>Ajoutez-le en quelques secondes.</h3>
          <div className="quick-actions">
            <button
              type="button"
              onClick={() => add("trip")}
              aria-label="Un trajet"
            >
              <span className="quick-icon mint">
                <Route size={21} />
              </span>
              <span>
                Un trajet<small>Noter les kilomètres</small>
              </span>
              <Plus size={17} />
            </button>
            <button
              type="button"
              onClick={() => add("fuel")}
              aria-label="Un plein"
            >
              <span className="quick-icon yellow">
                <Fuel size={21} />
              </span>
              <span>
                Un plein<small>Suivre le carburant</small>
              </span>
              <Plus size={17} />
            </button>
            <button
              type="button"
              onClick={() => add("expense")}
              aria-label="Une dépense"
            >
              <span className="quick-icon blue">
                <Wallet size={21} />
              </span>
              <span>
                Une dépense<small>Garder une trace</small>
              </span>
              <Plus size={17} />
            </button>
          </div>
        </section>
      </div>

      <div className="stats-grid">
        <button
          type="button"
          className="stat clickable"
          onClick={openMileage}
          aria-label="Kilométrage connu : ouvrir l’historique"
          title="Consulter l'historique détaillé du kilométrage"
        >
          <span>
            Kilométrage connu
            <span className="stat-icon-group">
              <Gauge size={18} />
              <ChevronRight size={15} className="stat-chevron" />
            </span>
          </span>
          <strong className="tabular-nums">
            {km !== undefined ? km.toLocaleString("fr-FR") : "—"}
            <small> km</small>
          </strong>
          <p>Dernier relevé chronologique · Cliquer pour l’historique</p>
        </button>

        <button
          type="button"
          className="stat clickable"
          onClick={openExpenses}
          aria-label="Dépenses du mois : ouvrir le détail"
          title="Consulter les dépenses et la ventilation par catégorie"
        >
          <span>
            Dépenses du mois
            <span className="stat-icon-group">
              <Wallet size={18} />
              <ChevronRight size={15} className="stat-chevron" />
            </span>
          </span>
          <strong className="tabular-nums">
            {money(
              total(monthEntries, state.settings.currency),
              state.settings.currency,
            )}
          </strong>
          <p>
            {new Date().toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })}{" "}
            · Cliquer pour le détail des dépenses
          </p>
        </button>

        <button
          type="button"
          className="stat clickable"
          onClick={openFuel}
          aria-label="Consommation calculée : ouvrir le détail"
          title="Consulter l'analyse de consommation et l'historique des pleins"
        >
          <span>
            Consommation calculée
            <span className="stat-icon-group">
              <Fuel size={18} />
              <ChevronRight size={15} className="stat-chevron" />
            </span>
          </span>
          <strong className="tabular-nums">
            {last ? fmtDecimal(last.value, 2) : fStats.lastConsumptionLabel}
            {last && <small> L/100 km</small>}
          </strong>
          <p>
            {last
              ? `${fmtDate(last.from)} → ${fmtDate(last.date)} · Cliquer pour le détail`
              : "Cliquer pour voir l'historique et les cycles"}
          </p>
        </button>

        <button
          type="button"
          className="stat clickable"
          onClick={openTrips}
          aria-label="Distance des trajets : ouvrir le détail"
          title="Consulter les trajets et distances parcourues"
        >
          <span>
            Distance des trajets
            <span className="stat-icon-group">
              <Route size={18} />
              <ChevronRight size={15} className="stat-chevron" />
            </span>
          </span>
          <strong className="tabular-nums">
            {tripDistance(entries).toLocaleString("fr-FR")}
            <small> km</small>
          </strong>
          <p>Trajets complets · Cliquer pour le détail</p>
        </button>
      </div>

      <section className="panel panel-spaced">
        <div className="section-head">
          <div>
            <p className="eyebrow">SUIVI DU CARBURANT</p>
            <h2>Totaux et consommations de carburant</h2>
          </div>
          <button className="secondary" onClick={() => add("fuel")}>
            <Plus size={16} />
            Ajouter un plein
          </button>
        </div>
        <div
          className={`stats-grid ${fStats.analyses.length > 0 ? "stats-grid-tight" : "stats-grid-flush"}`}
        >
          <div className="stat">
            <span>
              Montant total des dépenses de carburant
              <Wallet size={18} />
            </span>
            <strong className="tabular-nums">
              {fmtAmount(fStats.totalAmount, currency)}
            </strong>
            <p>{fStats.analyses.length} plein(s) enregistré(s)</p>
          </div>
          <div className="stat">
            <span>
              Quantité totale de carburant achetée
              <Fuel size={18} />
            </span>
            <strong className="tabular-nums">
              {fmtLitres(fStats.totalLitres)}
            </strong>
            <p>Volume total acheté pour ce véhicule</p>
          </div>
          <div className="stat">
            <span>
              Dernière consommation calculée
              <Gauge size={18} />
            </span>
            <strong
              className={`tabular-nums ${fStats.lastConsumption !== undefined ? "stat-value-lg" : "stat-value-sm"}`}
            >
              {fStats.lastConsumptionLabel}
            </strong>
            <p>
              {fStats.lastConsumptionEntry
                ? `${fmtDate(fStats.lastConsumptionEntry.fromDate!)} → ${fmtDate(fStats.lastConsumptionEntry.entry.date)}`
                : "Entre deux pleins complets"}
            </p>
          </div>
          <div className="stat">
            <span>
              Consommation moyenne sur les intervalles valides
              <TrendingUp size={18} />
            </span>
            <strong
              className={`tabular-nums ${fStats.averageConsumption !== undefined ? "stat-value-lg" : "stat-value-sm"}`}
            >
              {fStats.averageConsumptionLabel}
            </strong>
            <p>
              {fStats.totalValidDistance > 0
                ? `${fmtDecimal(fStats.totalValidLitres, 3)} L ÷ ${fStats.totalValidDistance.toLocaleString("fr-FR")} km × 100`
                : "Total litres valides ÷ total km valides × 100"}
            </p>
          </div>
        </div>

        {fStats.analyses.length > 0 && (
          <div className="data-table-scroll">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Véhicule</th>
                  <th>Compteur (km)</th>
                  <th>Distance (km)</th>
                  <th>Montant ({currency})</th>
                  <th>Prix/L</th>
                  <th>Litres</th>
                  <th>Plein complet</th>
                  <th>Consommation (L/100 km)</th>
                </tr>
              </thead>
              <tbody>
                {[...fStats.analyses].reverse().map((fa) => {
                  const e = fa.entry;
                  return (
                    <tr
                      key={`dash-fuel-${e.id}`}
                      onClick={() => openEntry(e)}
                    >
                      <td className="nowrap">{fmtDate(e.date)}</td>
                      <td>{vehicle?.name ?? "—"}</td>
                      <td className="nowrap tabular-nums">
                        {e.km !== undefined
                          ? `${e.km.toLocaleString("fr-FR")} km`
                          : "—"}
                      </td>
                      <td className="nowrap tabular-nums">
                        {fa.kmError ? (
                          <span className="danger">
                            Erreur : kilométrage ≤ précédent
                          </span>
                        ) : fa.distance !== undefined ? (
                          `${fa.distance.toLocaleString("fr-FR")} km`
                        ) : (
                          "Données insuffisantes"
                        )}
                      </td>
                      <td className="nowrap tabular-nums">
                        {e.amount !== undefined
                          ? fmtAmount(e.amount, currency)
                          : "—"}
                      </td>
                      <td className="nowrap tabular-nums">
                        {e.unitPrice !== undefined
                          ? `${fmtDecimal(e.unitPrice, 3)} ${currency}/L`
                          : "—"}
                      </td>
                      <td className="nowrap tabular-nums">
                        {e.quantity !== undefined ? fmtLitres(e.quantity) : "—"}
                      </td>
                      <td>{e.full === true ? "Oui" : "Non"}</td>
                      <td
                        className={`tabular-nums ${fa.consumptionStatus === "valid" ? "cell-bold" : ""}`}
                      >
                        {fa.consumptionLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {vehicle && kmWarnings(vehicle, entries) && (
        <p className="warning">
          Des relevés kilométriques diminuent dans le temps. Vérifiez vos
          saisies ; elles ont été conservées.
        </p>
      )}

      <div className="content-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">AU FIL DES KILOMÈTRES</p>
              <h2>Dernières activités</h2>
            </div>
            <button className="text-button" onClick={openCarnet}>
              Tout le carnet
              <ArrowRight size={16} />
            </button>
          </div>
          {recentActivities.length ? (
            <div className="activity-list">
              {recentActivities.map((e) => (
                <button
                  className="activity-row"
                  key={e.id}
                  onClick={() => openEntry(e)}
                >
                  <EntryIcon kind={e.kind} />
                  <span className="activity-text">
                    <strong>{e.title}</strong>
                    <small>
                      {labels[e.kind]} · {fmtDate(e.date)}
                      {e.km !== undefined
                        ? ` · ${e.km.toLocaleString("fr-FR")} km`
                        : ""}
                    </small>
                  </span>
                  <span className="activity-amount tabular-nums">
                    {e.amount !== undefined
                      ? money(e.amount, state.settings.currency)
                      : e.kind === "trip" &&
                          e.startKm !== undefined &&
                          e.endKm !== undefined
                        ? `${e.endKm - e.startKm} km`
                        : ""}
                    <ArrowRight size={15} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Route size={30} />}
              title="Une histoire à écrire"
              text="Votre premier trajet, plein ou entretien apparaîtra ici."
              action={
                <button className="secondary" onClick={() => add("trip")}>
                  <Plus size={17} />
                  Ajouter ma première entrée
                </button>
              }
            />
          )}
        </section>

        <section className="panel deadline-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">POUR NE RIEN OUBLIER</p>
              <h2>Prochaines échéances</h2>
            </div>
            <CalendarDays size={23} />
          </div>
          {upcomingDeadlines.length ? (
            <div className="deadline-list">
              {upcomingDeadlines.map((d) => {
                const st = status(d, km, state.settings, today());
                return (
                  <button
                    className="deadline-item"
                    key={d.id}
                    onClick={openDeadlines}
                  >
                    <span
                      className={`status-dot ${st === "Dépassée" ? "red" : st === "Bientôt" ? "amber" : "green"}`}
                    />
                    <span>
                      <strong>{d.title}</strong>
                      <small className="tabular-nums">
                        {d.date ? fmtDate(d.date) : "Kilométrage"}
                        {d.km !== undefined
                          ? ` · ${d.km.toLocaleString("fr-FR")} km`
                          : ""}
                      </small>
                    </span>
                    <span className="tag">{st}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              icon={<CalendarDays size={27} />}
              title="Anticipez l’essentiel"
              text="Assurance, contrôle technique, entretien… ajoutez vos dates importantes."
            />
          )}
          <button className="secondary full" onClick={openDeadlines}>
            Gérer les échéances
            <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <div className="content-grid charts">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">VOTRE BUDGET AUTO</p>
              <h2>
                {chartHorizon === 6
                  ? "Les 6 derniers mois"
                  : "Les 12 derniers mois"}
              </h2>
            </div>
            <div className="chart-horizon-toggle" role="group" aria-label="Période du graphique budget">
              <button
                type="button"
                className={chartHorizon === 6 ? "active" : ""}
                onClick={() => setChartHorizon(6)}
              >
                6 mois
              </button>
              <button
                type="button"
                className={chartHorizon === 12 ? "active" : ""}
                onClick={() => setChartHorizon(12)}
              >
                12 mois
              </button>
            </div>
          </div>

          {activeMonth && (
            <div className="chart-inspect-bar">
              <div>
                <span className="chart-inspect-month">{activeMonth.fullLabel}</span>
                <strong className="tabular-nums">
                  {money(activeMonth.value, currency)}
                </strong>
              </div>
              <div className="chart-inspect-breakdown tabular-nums">
                <span>
                  <i className="dot-fuel" />
                  Carburant : {money(activeMonth.fuelValue, currency)}
                </span>
                <span>
                  <i className="dot-other" />
                  Entretien & frais : {money(activeMonth.otherValue, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="bar-chart interactive-bar-chart">
            {months.map((m) => {
              const isSelected = activeMonth?.key === m.key;
              const pct = Math.max((m.value / maximum) * 100, m.value > 0 ? 6 : 0);
              const fuelPct = m.value > 0 ? (m.fuelValue / m.value) * 100 : 0;
              return (
                <div
                  key={m.key}
                  className={`bar-column ${isSelected ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedMonthKey(m.key)}
                  onClick={() => setSelectedMonthKey(m.key)}
                >
                  <small className="tabular-nums">
                    {m.value ? money(m.value, currency) : "—"}
                  </small>
                  <div className="bar-track" title={`${m.fullLabel} : ${money(m.value, currency)} (${m.count} entrée(s))`}>
                    <div
                      className="bar-fill-stack"
                      style={{ height: `${pct}%` }}
                    >
                      <div
                        className="bar-segment-other"
                        style={{ height: `${100 - fuelPct}%` }}
                      />
                      <div
                        className="bar-segment-fuel"
                        style={{ height: `${fuelPct}%` }}
                      />
                    </div>
                  </div>
                  <span>{m.label}</span>
                </div>
              );
            })}
          </div>
          <p className="chart-note">
            Moyenne sur les mois actifs :{" "}
            <strong className="tabular-nums">{money(avgMonthSpend, currency)}</strong> · Survolez ou cliquez sur un mois pour inspecter la répartition.
          </p>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">RÉPARTITION DES DÉPENSES</p>
              <h2>Cette année · {currentYear}</h2>
            </div>
            <strong className="tabular-nums">
              {money(total(yearEntries, currency), currency)}
            </strong>
          </div>
          {cats.length ? (
            <div className="category-chart">
              {cats.map((c, i) => {
                const pct = catTotal ? Math.round((c.value / catTotal) * 100) : 0;
                return (
                  <div key={c.name} className="category-row">
                    <span>
                      <i
                        style={{
                          background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                        }}
                      />
                      {c.name}
                      <small className="category-pct tabular-nums">({pct}%)</small>
                      <b className="tabular-nums">{money(c.value, currency)}</b>
                    </span>
                    <div>
                      <i
                        style={{
                          width: `${catTotal ? (c.value / catTotal) * 100 : 0}%`,
                          background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="chart-empty">
              Ajoutez une dépense pour suivre votre budget par catégorie.
            </p>
          )}
        </section>
      </div>

      {cons.length > 0 && (
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">ANALYSE ÉNERGÉTIQUE</p>
              <h2>Consommation entre pleins complets</h2>
            </div>
            <div className="cons-avg-indicator tabular-nums">
              <BarChart3 size={17} />
              <span>Moyenne : {fmtDecimal(avgConsValue, 2)} L/100 km</span>
            </div>
          </div>

          {recentCons.length > 1 && (
            <div className="cons-visual-bars">
              {recentCons.map((c, idx) => {
                const heightPct = Math.max((c.value / maxCons) * 100, 14);
                const isSelected = selectedConsIndex === idx;
                const isAboveAvg = avgConsValue > 0 && c.value > avgConsValue * 1.05;
                return (
                  <button
                    type="button"
                    key={`${c.from}-${c.date}-${idx}`}
                    className={`cons-bar-item ${isSelected ? "active" : ""} ${isAboveAvg ? "high" : "optimal"}`}
                    onClick={() =>
                      setSelectedConsIndex(isSelected ? null : idx)
                    }
                    title={`${fmtDate(c.from)} → ${fmtDate(c.date)} : ${fmtDecimal(c.value, 2)} L/100 km`}
                  >
                    <small className="tabular-nums">{fmtDecimal(c.value, 2)}</small>
                    <div className="cons-bar-track">
                      <div
                        className="cons-bar-fill"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span>{fmtDate(c.date)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="consumption-list">
            {cons.slice(-6).map((c, i) => (
              <div key={i} className="consumption-card">
                <strong className="tabular-nums">
                  {fmtDecimal(c.value, 2)} L/100 km
                </strong>
                <span>
                  {fmtDate(c.from)} → {fmtDate(c.date)}
                </span>
                <small className="tabular-nums">
                  {fmtDecimal(c.litres, 3)} L ÷ {c.distance} km × 100 · pleins
                  intermédiaires compris
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="footer-note">
        <ShieldCheck size={14} />
        Un carnet personnel, sans compte. Pensez à sauvegarder vos données.
      </p>
    </>
  );
}

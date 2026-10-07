import {
  Car,
  Gauge,
  Wallet,
  Fuel,
  ArrowRight,
  Plus,
  Route,
  Wrench,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { AttachmentImage, Empty } from "./ui";
import {
  currentKm,
  total,
  consumption,
  tripDistance,
  status,
  kmWarnings,
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
  new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
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
}) {
  const km = vehicle ? currentKm(vehicle, entries) : undefined;
  const month = today().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  const cons = consumption(entries);
  const last = cons.at(-1);
  const currentYear = today().slice(0, 4);
  const yearEntries = entries.filter((e) => e.date.startsWith(currentYear));
  const cats = [
    ...new Set(
      yearEntries
        .filter((e) => e.amount !== undefined)
        .map((e) => e.category || labels[e.kind]),
    ),
  ]
    .map((c) => ({
      name: c,
      value: total(
        yearEntries.filter((e) => (e.category || labels[e.kind]) === c),
        state.settings.currency,
      ),
    }))
    .sort((a, b) => b.value - a.value);
  const catTotal = cats.reduce((s, c) => s + c.value, 0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      value: total(
        entries.filter((e) => e.date.startsWith(key)),
        state.settings.currency,
      ),
    };
  });
  const maximum = Math.max(...months.map((m) => m.value), 1);
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
            <button onClick={() => add("trip")}>
              <span className="quick-icon mint">
                <Route size={21} />
              </span>
              <span>
                Un trajet<small>Noter les kilomètres</small>
              </span>
              <Plus size={17} />
            </button>
            <button
              onClick={() =>
                add(vehicle?.energy === "Électrique" ? "charge" : "fuel")
              }
            >
              <span className="quick-icon yellow">
                <Fuel size={21} />
              </span>
              <span>
                {vehicle?.energy === "Électrique" ? "Une recharge" : "Un plein"}
                <small>Suivre l’énergie</small>
              </span>
              <Plus size={17} />
            </button>
            <button onClick={() => add("expense")}>
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
        <div className="stat">
          <span>
            Kilométrage connu
            <Gauge size={19} />
          </span>
          <strong>
            {km !== undefined ? km.toLocaleString("fr-FR") : "—"}
            <small> km</small>
          </strong>
          <p>Dernier relevé chronologique saisi</p>
        </div>
        <div className="stat">
          <span>
            Dépenses du mois
            <Wallet size={19} />
          </span>
          <strong>
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
            · sans double comptage
          </p>
        </div>
        <div className="stat">
          <span>
            Consommation calculée
            <Fuel size={19} />
          </span>
          <strong>
            {last ? last.value.toFixed(1) : "—"}
            {last && <small> L/100 km</small>}
          </strong>
          <p>
            {last
              ? `${fmtDate(last.from)} → ${fmtDate(last.date)}`
              : "Données insuffisantes : deux pleins complets nécessaires"}
          </p>
        </div>
        <div className="stat">
          <span>
            Distance des trajets
            <Route size={19} />
          </span>
          <strong>
            {tripDistance(entries).toLocaleString("fr-FR")}
            <small> km</small>
          </strong>
          <p>Tous les trajets complets · chevauchements fusionnés</p>
        </div>
      </div>
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
          {entries.length ? (
            <div className="activity-list">
              {[...entries]
                .sort(
                  (a, b) =>
                    b.date.localeCompare(a.date) ||
                    b.createdAt.localeCompare(a.createdAt),
                )
                .slice(0, 5)
                .map((e) => (
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
                    <span className="activity-amount">
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
          {deadlines.filter((d) => !d.done).length ? (
            <div className="deadline-list">
              {deadlines
                .filter((d) => !d.done)
                .sort((a, b) =>
                  (a.date ?? "9999").localeCompare(b.date ?? "9999"),
                )
                .slice(0, 3)
                .map((d) => (
                  <button
                    className="deadline-item"
                    key={d.id}
                    onClick={openDeadlines}
                  >
                    <span
                      className={`status-dot ${status(d, km, state.settings, today()) === "Dépassée" ? "red" : status(d, km, state.settings, today()) === "Bientôt" ? "amber" : "green"}`}
                    />
                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        {d.date ? fmtDate(d.date) : "Kilométrage"}
                        {d.km !== undefined
                          ? ` · ${d.km.toLocaleString("fr-FR")} km`
                          : ""}
                      </small>
                    </span>
                    <span className="tag">
                      {status(d, km, state.settings, today())}
                    </span>
                  </button>
                ))}
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
              <h2>Les 6 derniers mois</h2>
            </div>
            <TrendingUp size={23} />
          </div>
          <div className="bar-chart">
            {months.map((m) => (
              <div key={m.label}>
                <small>
                  {m.value ? money(m.value, state.settings.currency) : "—"}
                </small>
                <div className="bar-track">
                  <div style={{ height: `${(m.value / maximum) * 100}%` }} />
                </div>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
          <p className="chart-note">
            Total des montants enregistrés, regroupés par mois.
          </p>
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">RÉPARTITION DES DÉPENSES</p>
              <h2>Cette année · {currentYear}</h2>
            </div>
            <strong>
              {money(
                total(yearEntries, state.settings.currency),
                state.settings.currency,
              )}
            </strong>
          </div>
          {cats.length ? (
            <div className="category-chart">
              {cats.map((c, i) => (
                <div key={c.name}>
                  <span>
                    <i
                      style={{
                        background: [
                          "#24594c",
                          "#b69c55",
                          "#799997",
                          "#9b8775",
                        ][i % 4],
                      }}
                    />
                    {c.name}
                    <b>{money(c.value, state.settings.currency)}</b>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${catTotal ? (c.value / catTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
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
            <h2>Consommation entre pleins complets</h2>
            <Fuel size={22} />
          </div>
          <div className="consumption-list">
            {cons.slice(-6).map((c, i) => (
              <div key={i}>
                <strong>{c.value.toFixed(2)} L/100 km</strong>
                <span>
                  {fmtDate(c.from)} → {fmtDate(c.date)}
                </span>
                <small>
                  {c.litres.toFixed(3)} L ÷ {c.distance} km × 100 · pleins
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

import {
  Plus,
  Search,
  List,
  LayoutGrid,
  Download,
  FileText,
  Printer,
  Share2,
  BookOpen,
} from "lucide-react";
import { Field, Empty } from "./ui";
import {
  labels,
  type State,
  type Vehicle,
  type Entry,
  type Kind,
} from "./types";
import { EntryIcon, fmtDate, money } from "./Dashboard";
import { total } from "./calculations";
import { exportCsv, report } from "./io";
import type { ModalState, Page } from "./appTypes";
interface Props {
  state: State;
  vehicle?: Vehicle;
  page: Page;
  filtered: Entry[];
  entries: Entry[];
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (s: string) => void;
  from: string;
  setFrom: (s: string) => void;
  to: string;
  setTo: (s: string) => void;
  sort: string;
  setSort: (s: string) => void;
  view: string;
  setView: (s: string) => void;
  limit: number;
  setLimit: (n: number) => void;
  add: (k: Kind) => void;
  setModal: (m: ModalState) => void;
  act: (fn: () => Promise<void>) => Promise<void>;
}
export function JournalScreen({
  state,
  vehicle,
  page,
  filtered,
  entries,
  search,
  setSearch,
  filter,
  setFilter,
  from,
  setFrom,
  to,
  setTo,
  sort,
  setSort,
  view,
  setView,
  limit,
  setLimit,
  add,
  setModal,
  act,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {page === "documents"
              ? "VOS PIÈCES, BIEN RANGÉES"
              : "L’HISTOIRE DE VOTRE VOITURE"}
          </p>
          <h1>{page === "documents" ? "Mes documents" : "Mon carnet"}</h1>
          <p>
            {vehicle?.name ?? "Ajoutez un véhicule pour commencer"} ·{" "}
            {filtered.length} entrée(s)
          </p>
        </div>
        <button
          className="primary"
          onClick={() => add(page === "documents" ? "document" : "trip")}
        >
          <Plus size={18} />
          Ajouter {page === "documents" ? "un document" : "une entrée"}
        </button>
      </div>
      <section className="panel journal-panel">
        <div className="journal-toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Rechercher dans le carnet"
              placeholder="Rechercher un libellé, garage, note…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(40);
              }}
            />
          </label>
          <select
            aria-label="Filtrer par catégorie"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Toutes les catégories</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              aria-label="Affichage liste"
              aria-pressed={view === "list"}
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
            >
              <List size={18} />
            </button>
            <button
              aria-label="Affichage grille"
              aria-pressed={view === "grid"}
              className={view === "grid" ? "selected" : ""}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
        <div className="filter-row">
          <Field label="Du">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Au">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Trier">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="desc">Plus récent</option>
              <option value="asc">Plus ancien</option>
              <option value="title">Libellé A → Z</option>
              <option value="amount">Montant décroissant</option>
            </select>
          </Field>
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setFilter("all");
              setFrom("");
              setTo("");
            }}
          >
            Réinitialiser
          </button>
        </div>
        <div className="export-row">
          <span>
            Total filtré :{" "}
            <strong>
              {money(
                total(filtered, state.settings.currency),
                state.settings.currency,
              )}
            </strong>
          </span>
          <div className="actions">
            <button className="secondary" onClick={() => exportCsv(filtered)}>
              <Download size={16} />
              CSV
            </button>
            <button
              className="secondary"
              onClick={() =>
                void act(() =>
                  report(
                    filtered,
                    vehicle?.name ?? "Carnet",
                    state.settings.currency,
                  ),
                )
              }
            >
              <FileText size={16} />
              PDF
            </button>
            <button className="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Imprimer
            </button>
            <button
              className="secondary"
              onClick={() =>
                void act(() =>
                  report(
                    filtered,
                    vehicle?.name ?? "Carnet",
                    state.settings.currency,
                    true,
                  ),
                )
              }
            >
              <Share2 size={16} />
              Partager
            </button>
          </div>
        </div>
        {filtered.length ? (
          <div className={view === "grid" ? "entry-grid" : "entry-table"}>
            {view === "list" && (
              <div className="table-head">
                <span>ACTIVITÉ</span>
                <span>DATE</span>
                <span>KILOMÉTRAGE</span>
                <span>MONTANT</span>
              </div>
            )}
            {filtered.slice(0, limit).map((e) => (
              <button
                key={e.id}
                className="entry-row"
                onClick={() => setModal({ type: "detail", entry: e })}
              >
                <div>
                  <EntryIcon kind={e.kind} />
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {labels[e.kind]}
                      {e.attachmentId ? " · Pièce jointe" : ""}
                    </small>
                  </span>
                </div>
                <span>{fmtDate(e.date)}</span>
                <span>
                  {e.kind === "trip"
                    ? e.startKm !== undefined && e.endKm !== undefined
                      ? `${e.endKm - e.startKm} km`
                      : "Trajet incomplet"
                    : e.km !== undefined
                      ? `${e.km.toLocaleString("fr-FR")} km`
                      : "—"}
                </span>
                <strong>
                  {e.amount !== undefined
                    ? money(e.amount, state.settings.currency)
                    : "—"}
                </strong>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<BookOpen size={30} />}
            title={
              entries.length ? "Aucun résultat" : "Votre carnet commence ici"
            }
            text={
              entries.length
                ? "Essayez une autre recherche ou réinitialisez les filtres."
                : "Ajoutez votre premier événement pour conserver son historique."
            }
            action={
              <button
                className="secondary"
                onClick={() => add(page === "documents" ? "document" : "trip")}
              >
                Ajouter une entrée
              </button>
            }
          />
        )}
        {filtered.length > limit && (
          <button
            className="secondary full"
            onClick={() => setLimit(limit + 40)}
          >
            Afficher 40 entrées supplémentaires
          </button>
        )}
      </section>
    </>
  );
}

import { Plus, CalendarDays, Pencil, Check, Trash2 } from "lucide-react";
import { Empty } from "./ui";
import {
  today,
  type State,
  type Vehicle,
  type Entry,
  type Deadline,
} from "./types";
import { status } from "./calculations";
import { fmtDate } from "./Dashboard";
import type { ModalState } from "./appTypes";
interface Props {
  state: State;
  vehicle?: Vehicle;
  entries: Entry[];
  deadlines: Deadline[];
  km?: number;
  setModal: (m: ModalState) => void;
  act: (fn: () => Promise<void>) => Promise<void>;
  commit: (s: State, message?: string) => Promise<void>;
}
export function DeadlinesScreen({
  state,
  vehicle,
  entries,
  deadlines,
  km,
  setModal,
  act,
  commit,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRENDRE UNE LONGUEUR D’AVANCE</p>
          <h1>Mes échéances</h1>
          <p>
            Les alertes kilométriques dépendent du dernier relevé saisi
            {km !== undefined ? ` : ${km.toLocaleString("fr-FR")} km` : "."}.
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            vehicle
              ? setModal({ type: "deadline" })
              : setModal({ type: "vehicle" })
          }
        >
          <Plus size={18} />
          Ajouter une échéance
        </button>
      </div>
      <p className="info">
        <CalendarDays size={19} />
        Alerte {state.settings.alertDays} jours ou{" "}
        {state.settings.alertKm.toLocaleString("fr-FR")} km avant l’échéance.{" "}
        <button
          className="text-button"
          onClick={() => setModal({ type: "settings" })}
        >
          Régler les seuils
        </button>
      </p>
      {deadlines.length ? (
        <div className="deadline-cards">
          {deadlines
            .sort(
              (a, b) =>
                Number(a.done) - Number(b.done) ||
                (a.date ?? "9999").localeCompare(b.date ?? "9999"),
            )
            .map((d) => (
              <section
                className={`panel deadline-card ${d.done ? "done" : ""}`}
                key={d.id}
              >
                <div className="section-head">
                  <CalendarDays size={23} />
                  <span
                    className={`tag ${d.done ? "" : status(d, km, state.settings, today()) === "Dépassée" ? "danger" : status(d, km, state.settings, today()) === "Bientôt" ? "soon" : "green-tag"}`}
                  >
                    {d.done
                      ? "Terminée"
                      : status(d, km, state.settings, today())}
                  </span>
                </div>
                <h3>{d.title}</h3>
                <p>
                  {d.date ? fmtDate(d.date) : "Sans date"}
                  {d.km !== undefined
                    ? ` · ${d.km.toLocaleString("fr-FR")} km`
                    : ""}
                </p>
                {d.notes && <p>{d.notes}</p>}
                <div className="actions">
                  {"source" in d ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        const e = entries.find(
                          (e) =>
                            e.id ===
                            (d as Deadline & { source: string }).source,
                        );
                        if (e)
                          setModal({
                            type: "entry",
                            entry: e,
                            kind: e.kind,
                          });
                      }}
                    >
                      <Pencil size={16} />
                      Modifier l’entrée liée
                    </button>
                  ) : (
                    <>
                      <button
                        className="secondary"
                        onClick={() =>
                          void act(() =>
                            commit(
                              {
                                ...state,
                                deadlines: state.deadlines.map((x) =>
                                  x.id === d.id
                                    ? {
                                        ...x,
                                        done: !x.done,
                                        updatedAt: new Date().toISOString(),
                                      }
                                    : x,
                                ),
                              },
                              d.done
                                ? "Échéance réouverte."
                                : "Échéance terminée.",
                            ),
                          )
                        }
                      >
                        <Check size={16} />
                        {d.done ? "Réouvrir" : "Terminer"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Modifier ${d.title}`}
                        onClick={() =>
                          setModal({ type: "deadline", deadline: d })
                        }
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Supprimer ${d.title}`}
                        onClick={() => {
                          if (confirm("Supprimer cette échéance ?"))
                            void act(() =>
                              commit({
                                ...state,
                                deadlines: state.deadlines.filter(
                                  (x) => x.id !== d.id,
                                ),
                              }),
                            );
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={<CalendarDays size={35} />}
            title="Plus de dates oubliées"
            text="Ajoutez votre assurance, contrôle technique ou entretien. Aucun intervalle n’est imposé."
            action={
              <button
                className="primary"
                onClick={() =>
                  vehicle
                    ? setModal({ type: "deadline" })
                    : setModal({ type: "vehicle" })
                }
              >
                Ajouter ma première échéance
              </button>
            }
          />
        </section>
      )}
    </>
  );
}

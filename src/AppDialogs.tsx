import { lazy, Suspense } from "react";
import {
  Plus,
  Download,
  Trash2,
  Pencil,
  Check,
  Save,
  FolderOpen,
  ShieldCheck,
  Maximize,
  Share2,
  Mail,
} from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import { AuthModal } from "./AuthModal";
import { Capacitor } from "@capacitor/core";
import { Modal, Field, AttachmentImage, AttachmentView } from "./ui";
import { VehicleForm, EntryForm, DeadlineForm } from "./forms";
import { EntryIcon, derivedDeadlines, fmtDate, money } from "./Dashboard";
import { analyzeFuelEntries, fmtUnitPrice, fmtLitres } from "./calculations";
import { backup, report } from "./io";
import { scheduleNotifications } from "./native";
import {
  labels,
  type State,
  type Vehicle,
  type Entry,
  type Deadline,
} from "./types";
import type { ModalState, Page, InstallEvent } from "./appTypes";
const Transfers = lazy(() =>
  import("./Transfers").then((m) => ({ default: m.Transfers })),
);
interface Props {
  state: State;
  vehicle?: Vehicle;
  modal: ModalState;
  setModal: (m: ModalState) => void;
  saveVehicle: (v: Vehicle) => Promise<void>;
  saveEntry: (e: Entry) => Promise<void>;
  saveDeadline: (d: Deadline) => Promise<void>;
  showError: (e: unknown) => void;
  act: (fn: () => Promise<void>) => Promise<void>;
  deleteVehicle: (v: Vehicle) => Promise<void>;
  deleteEntry: (e: Entry) => Promise<void>;
  commit: (s: State, message?: string) => Promise<void>;
  setPage: (p: Page) => void;
  setState: (s: State) => void;
  setNotice: (s: string) => void;
  install?: InstallEvent;
  setInstall: (s: InstallEvent | undefined) => void;
  currentUser?: FirebaseUser | null;
}
export function AppDialogs({
  state,
  vehicle,
  modal,
  setModal,
  saveVehicle,
  saveEntry,
  saveDeadline,
  showError,
  act,
  deleteVehicle,
  deleteEntry,
  commit,
  setPage,
  setState,
  setNotice,
  install,
  setInstall,
  currentUser,
}: Props) {
  return (
    <>
      {" "}
      {modal?.type === "vehicle" && (
        <Modal
          title={modal.vehicle ? "Fiche véhicule" : "Ajouter mon véhicule"}
          onClose={() => setModal(null)}
          wide
        >
          <VehicleForm
            vehicle={modal.vehicle}
            vehicles={state.vehicles}
            onSave={saveVehicle}
            onError={showError}
          />
          {modal.vehicle && (
            <div className="danger-zone">
              <p>
                La suppression efface le véhicule et son carnet. Conservez une
                sauvegarde avant de continuer.
              </p>
              <button
                className="secondary"
                onClick={() => void act(() => backup(state))}
              >
                <Download size={16} />
                Sauvegarder avant suppression
              </button>
              <button
                className="danger-button"
                onClick={() => void act(() => deleteVehicle(modal.vehicle!))}
              >
                <Trash2 size={16} />
                Supprimer ce véhicule
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal?.type === "vehicles" && (
        <Modal title="Mes véhicules" onClose={() => setModal(null)}>
          {state.vehicles.length ? (
            state.vehicles.map((v) => (
              <div className="vehicle-option" key={v.id}>
                <button
                  onClick={() =>
                    void act(async () => {
                      await commit(
                        {
                          ...state,
                          settings: {
                            ...state.settings,
                            selectedVehicle: v.id,
                          },
                        },
                        "Véhicule sélectionné.",
                      );
                      setModal(null);
                    })
                  }
                >
                  <AttachmentImage id={v.photoId} alt={v.name} />
                  <span>
                    <strong>{v.name}</strong>
                    <small>{v.plate || v.energy}</small>
                  </span>
                  {vehicle?.id === v.id && <Check size={20} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Modifier ${v.name}`}
                  onClick={() => setModal({ type: "vehicle", vehicle: v })}
                >
                  <Pencil size={18} />
                </button>
              </div>
            ))
          ) : (
            <p>Aucun véhicule pour le moment.</p>
          )}
          <button
            className="primary full"
            onClick={() => setModal({ type: "vehicle" })}
          >
            <Plus size={17} />
            Ajouter un véhicule
          </button>
        </Modal>
      )}
      {modal?.type === "entry" && vehicle && (
        <Modal
          title={modal.entry ? "Modifier l’entrée" : "Ajouter une entrée"}
          onClose={() => setModal(null)}
          wide
        >
          <EntryForm
            entry={modal.entry}
            kind={modal.kind}
            vehicle={vehicle}
            vehicles={state.vehicles}
            entries={state.entries}
            categories={[
              ...new Set([
                ...state.settings.categories,
                ...state.entries
                  .map((e) => e.category)
                  .filter((x): x is string => !!x),
              ]),
            ]}
            currency={state.settings.currency}
            onSave={saveEntry}
            onError={showError}
          />
        </Modal>
      )}
      {modal?.type === "deadline" && vehicle && (
        <Modal
          title={
            modal.deadline ? "Modifier l’échéance" : "Ajouter une échéance"
          }
          onClose={() => setModal(null)}
        >
          <DeadlineForm
            deadline={modal.deadline}
            vehicleId={vehicle.id}
            onSave={saveDeadline}
            onError={showError}
          />
        </Modal>
      )}
      {modal?.type === "detail" && (() => {
        const fuelAnalysis =
          modal.entry.kind === "fuel"
            ? analyzeFuelEntries(state.entries, modal.entry.vehicleId).get(
                modal.entry.id,
              )
            : undefined;
        const entryVehicle =
          state.vehicles.find((v) => v.id === modal.entry.vehicleId) ?? vehicle;
        return (
          <Modal title={modal.entry.title} onClose={() => setModal(null)} wide>
            <div className="detail-heading">
              <EntryIcon kind={modal.entry.kind} />
              <span>
                {labels[modal.entry.kind]} · {fmtDate(modal.entry.date)}
                {entryVehicle ? ` · ${entryVehicle.name}` : ""}
              </span>
            </div>
            <dl className="detail-grid">
              {modal.entry.kind === "fuel" && entryVehicle && (
                <div>
                  <dt>Véhicule</dt>
                  <dd>{entryVehicle.name}</dd>
                </div>
              )}
              {Object.entries(modal.entry)
                .filter(
                  ([k, v]) =>
                    ![
                      "id",
                      "vehicleId",
                      "createdAt",
                      "updatedAt",
                      "kind",
                      "title",
                      "date",
                      "attachmentId",
                    ].includes(k) &&
                    v !== undefined &&
                    v !== "",
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      {(
                        {
                          km: "Kilométrage (km)",
                          startKm: "Compteur départ (km)",
                          endKm: "Compteur arrivée (km)",
                          quantity:
                            modal.entry.kind === "charge"
                              ? "Énergie achetée (kWh)"
                              : "Carburant acheté (L)",
                          unitPrice: "Prix par litre",
                          amount: "Montant",
                          full: "Plein complet",
                          purpose: "Motif",
                          origin: "Origine",
                          destination: "Destination",
                          driver: "Conducteur",
                          category: "Catégorie",
                          garage: "Garage / station",
                          reference: "Référence",
                          notes: "Notes",
                          expiry: "Expiration",
                          nextDate: "Prochaine date",
                          nextKm: "Prochain kilométrage",
                        } as Record<string, string>
                      )[k] ?? k}
                    </dt>
                    <dd>
                      {typeof v === "boolean"
                        ? v
                          ? "Oui"
                          : "Non"
                        : k === "amount"
                          ? money(Number(v), state.settings.currency)
                          : k === "unitPrice" && modal.entry.kind === "fuel"
                            ? fmtUnitPrice(Number(v), state.settings.currency)
                            : k === "quantity" && modal.entry.kind === "fuel"
                              ? fmtLitres(Number(v))
                              : String(v)}
                    </dd>
                  </div>
                ))}
              {fuelAnalysis && (
                <>
                  <div>
                    <dt>Distance parcourue (km)</dt>
                    <dd>
                      {fuelAnalysis.kmError
                        ? fuelAnalysis.kmErrorMessage
                        : fuelAnalysis.distance !== undefined
                          ? `${fuelAnalysis.distance.toLocaleString("fr-FR")} km`
                          : "Données insuffisantes"}
                    </dd>
                  </div>
                  <div>
                    <dt>Consommation (L/100 km)</dt>
                    <dd>{fuelAnalysis.consumptionLabel}</dd>
                  </div>
                </>
              )}
            </dl>
            {modal.entry.attachmentId && (
              <AttachmentView
                id={modal.entry.attachmentId}
                onError={showError}
              />
            )}
            <div className="actions detail-actions">
              <button
                className="primary"
                onClick={() =>
                  setModal({
                    type: "entry",
                    entry: modal.entry,
                    kind: modal.entry.kind,
                  })
                }
              >
                <Pencil size={17} />
                Modifier
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void act(() =>
                    report(
                      [modal.entry],
                      vehicle?.name ?? "",
                      state.settings.currency,
                      true,
                    ),
                  )
                }
              >
                <Share2 size={17} />
                Partager le rapport
              </button>
              <button
                className="danger-button"
                onClick={() => void act(() => deleteEntry(modal.entry))}
              >
                <Trash2 size={17} />
                Supprimer
              </button>
            </div>
          </Modal>
        );
      })()}
      {modal?.type === "settings" && (
        <Modal title="Paramètres" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(async () => {
                const currency = String(f.get("currency"));
                if (
                  currency !== state.settings.currency &&
                  state.entries.some((e) => e.amount !== undefined) &&
                  !confirm(
                    "Changer la devise ne convertit pas les montants existants. Confirmer ?",
                  )
                )
                  return;
                await commit(
                  {
                    ...state,
                    settings: {
                      ...state.settings,
                      currency,
                      alertDays: Number(f.get("alertDays")),
                      alertKm: Number(f.get("alertKm")),
                    },
                  },
                  "Paramètres enregistrés.",
                );
                setModal(null);
              });
            }}
          >
            <div className="form-grid">
              <Field label="Devise">
                <select name="currency" defaultValue={state.settings.currency}>
                  {[
                    "TND",
                    "EUR",
                    "USD",
                    "MAD",
                    "DZD",
                    "GBP",
                    "CAD",
                    "CHF",
                    "SAR",
                    "AED",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Alerte avant échéance (jours)">
                <input
                  name="alertDays"
                  type="number"
                  required
                  min="0"
                  defaultValue={state.settings.alertDays}
                />
              </Field>
              <Field label="Alerte avant échéance (km)">
                <input
                  name="alertKm"
                  type="number"
                  required
                  min="0"
                  defaultValue={state.settings.alertKm}
                />
              </Field>
            </div>
            <button className="primary form-submit">
              <Save size={17} />
              Enregistrer
            </button>
          </form>
          <section className="settings-section">
            <h3>Compte & Connexion e-mail</h3>
            {currentUser ? (
              <div>
                <p>
                  Connecté en tant que <strong>{currentUser.email}</strong>.
                </p>
                <button
                  className="secondary full"
                  onClick={() => setModal({ type: "auth" })}
                >
                  <Mail size={17} />
                  Gérer mon compte & Cloud
                </button>
              </div>
            ) : (
              <div>
                <p>
                  Connectez-vous avec votre e-mail pour sauvegarder et synchroniser votre carnet dans le Cloud.
                </p>
                <button
                  className="primary full"
                  onClick={() => setModal({ type: "auth" })}
                >
                  <Mail size={17} />
                  Se connecter avec e-mail
                </button>
              </div>
            )}
          </section>
          <section className="settings-section">
            <h3>Vos données</h3>
            <p>
              Stockage local sur cet appareil, sans synchronisation entre
              appareils.
            </p>
            <button
              className="secondary full"
              onClick={() => setModal({ type: "transfer" })}
            >
              <Download size={17} />
              Sauvegarder, restaurer ou importer
            </button>
            <button
              className="secondary full"
              onClick={() => {
                setPage("documents");
                setModal(null);
              }}
            >
              <FolderOpen size={17} />
              Mes documents
            </button>
            <button
              className="secondary full"
              onClick={() =>
                void act(async () => {
                  const saved = await navigator.storage?.persist?.();
                  setNotice(
                    saved
                      ? "Conservation du stockage autorisée."
                      : "Le navigateur gère la conservation. Gardez une sauvegarde.",
                  );
                  setModal(null);
                })
              }
            >
              <ShieldCheck size={17} />
              Demander la conservation du stockage
            </button>
          </section>
          <section className="settings-section">
            <h3>Installer l’application</h3>
            {install ? (
              <button
                className="primary"
                onClick={() =>
                  void act(async () => {
                    await install.prompt();
                    await install.userChoice;
                    setInstall(undefined);
                  })
                }
              >
                <Download size={17} />
                Installer Carnet Auto
              </button>
            ) : (
              <p>
                Android / PC : menu du navigateur → Installer l’application (si
                proposé). iPhone / iPad : ouvrir dans Safari → Partager → Sur
                l’écran d’accueil. L’installation exige une connexion sécurisée.
              </p>
            )}
            <p>
              Ouvrez une première fois en ligne. Le carnet et vos documents
              seront ensuite utilisables hors connexion.
            </p>
            {document.fullscreenEnabled && (
              <button
                className="secondary"
                onClick={() =>
                  void act(() => document.documentElement.requestFullscreen())
                }
              >
                <Maximize size={17} />
                Plein écran
              </button>
            )}
          </section>
          <section className="settings-section">
            <h3>Rappels</h3>
            <p>
              {Capacitor.isNativePlatform()
                ? "Planifiez les échéances datées sur cet appareil. Réactualisez les rappels après chaque modification."
                : "Dans la version Web, les échéances sont visibles dans l’application. Aucun rappel en arrière-plan n’est garanti."}
            </p>
            {Capacitor.isNativePlatform() && (
              <button
                className="secondary"
                onClick={() =>
                  void act(async () => {
                    const count = await scheduleNotifications(
                      [...state.deadlines, ...derivedDeadlines(state.entries)],
                      state.settings.alertDays,
                    );
                    setNotice(`${count} rappel(s) planifié(s).`);
                    setModal(null);
                  })
                }
              >
                Actualiser les notifications locales
              </button>
            )}
          </section>
        </Modal>
      )}
      {modal?.type === "transfer" && (
        <Suspense
          fallback={
            <Modal title="Chargement…" onClose={() => setModal(null)}>
              <p>Ouverture des outils de sauvegarde…</p>
            </Modal>
          }
        >
          <Transfers
            state={state}
            onChange={(s) => void commit(s, "Données importées et synchronisées.")}
            onClose={() => setModal(null)}
            onError={showError}
          />
        </Suspense>
      )}
      {modal?.type === "auth" && (
        <AuthModal
          onClose={() => setModal(null)}
          state={state}
          currentUser={currentUser ?? null}
          onRestoreState={(restored) => {
            void commit(restored, "Données restaurées depuis le Cloud.");
          }}
          onNotice={(msg) => setNotice(msg)}
        />
      )}
    </>
  );
}

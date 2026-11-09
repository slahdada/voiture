import { AppDialogs } from "./AppDialogs";
import { JournalScreen } from "./JournalScreen";
import { DeadlinesScreen } from "./DeadlinesScreen";
import { MileageScreen } from "./MileageScreen";
import { ExpensesScreen } from "./ExpensesScreen";
import { FuelScreen } from "./FuelScreen";
import { TripsScreen } from "./TripsScreen";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  Car,
  House,
  BookOpen,
  CalendarDays,
  Settings,
  Plus,
  ChevronDown,
  Maximize,
  Minimize,
  Download,
  Search,
  List,
  LayoutGrid,
  FileText,
  Printer,
  Share2,
  Trash2,
  Pencil,
  Check,
  ArrowRight,
  WifiOff,
  ShieldCheck,
  FolderOpen,
  Save,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { storage } from "./storage";
import {
  emptyState,
  labels,
  today,
  type State,
  type Vehicle,
  type Entry,
  type Deadline,
  type Kind,
} from "./types";
import { currentKm, status, total } from "./calculations";
import { validateState } from "./validation";
import { Modal, Field, Empty, AttachmentView, AttachmentImage } from "./ui";
import { VehicleForm, EntryForm, DeadlineForm } from "./forms";
import {
  Dashboard,
  EntryIcon,
  derivedDeadlines,
  fmtDate,
  money,
} from "./Dashboard";
import { exportCsv, report, backup } from "./io";
import { scheduleNotifications } from "./native";
import {
  auth,
  syncStateToFirestore,
  fetchStateFromFirestore,
  db,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { onSnapshot, doc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { Mail, LogOut, User } from "lucide-react";
import { LandingScreen } from "./LandingScreen";
import { AuthModal } from "./AuthModal";
import { getStoredSession, logoutLocalAccount } from "./localAuth";
const Transfers = lazy(() =>
  import("./Transfers").then((m) => ({ default: m.Transfers })),
);
import type { Page, ModalState, InstallEvent } from "./appTypes";

interface AppProps {
  initialUser?: FirebaseUser | null;
}

export default function App({ initialUser }: AppProps = {}) {
  const isTestEnv = import.meta.env.MODE === "test";
  const defaultTestUser: FirebaseUser = {
    uid: "test-user-id",
    email: "slahdada@gmail.com",
    displayName: "Slah Dada",
  } as FirebaseUser;

  const defaultOwnerUser: FirebaseUser = {
    uid: "user_slahdada_gmail_com",
    email: "slahdada@gmail.com",
    displayName: "Slah Dada",
  } as FirebaseUser;

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(
    initialUser !== undefined
      ? initialUser
      : isTestEnv
        ? defaultTestUser
        : (auth.currentUser ?? (getStoredSession() as any) ?? defaultOwnerUser),
  );
  const [state, setState] = useState<State>(emptyState);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "offline">(
    !navigator.onLine ? "offline" : localStorage.getItem("sync_pending") === "true" ? "pending" : "synced"
  );
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("desc");
  const [view, setView] = useState("list");
  const [limit, setLimit] = useState(40);
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallEvent>();
  const [fullscreen, setFullscreen] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  const tryBackgroundSync = async (currentState: State, targetUid?: string) => {
    if (isTestEnv) return;
    const uid = targetUid || currentUser?.uid;
    if (!uid) return;
    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("pending");
    const success = await syncStateToFirestore(
      currentState,
      uid,
      currentUser?.email || "",
      currentUser?.displayName || "",
    );
    if (success) {
      setSyncStatus("synced");
      localStorage.removeItem("sync_pending");
    } else {
      setSyncStatus("pending");
      localStorage.setItem("sync_pending", "true");
    }
  };

  const showError = (e: unknown) => {
    const message =
      e instanceof Error
        ? e.message
        : "Une erreur est survenue. Vos saisies sont conservées.";
    setError(message);
    window.dispatchEvent(new CustomEvent("app-error", { detail: message }));
  };

  useEffect(() => {
    if (!currentUser) {
      setState(emptyState());
      setLoading(false);
      return;
    }

    setLoading(true);
    const uid = currentUser.uid;

    storage
      .load(uid)
      .then(async (s) => {
        validateState(s);
        let finalState = s;

        if (navigator.onLine && !isTestEnv) {
          try {
            const cloudState = await fetchStateFromFirestore(uid);
            if (
              cloudState &&
              Array.isArray(cloudState.vehicles) &&
              cloudState.vehicles.length > 0
            ) {
              const localEmpty = s.vehicles.length === 0;
              if (localEmpty) {
                finalState = cloudState;
                await storage.save(cloudState, uid);
              }
            } else if (s.vehicles.length > 0) {
              await syncStateToFirestore(
                s,
                uid,
                currentUser.email || "",
                currentUser.displayName || "",
              );
            }
          } catch (e) {
            console.warn("Startup cloud fetch failed:", e);
          }
        }

        setState(finalState);
        setLoadFailed(false);

        if (!isTestEnv && localStorage.getItem("sync_pending") === "true") {
          void tryBackgroundSync(finalState, uid);
        }
      })
      .catch((e) => {
        setLoadFailed(true);
        showError(e);
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    const network = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (!isOnline) {
        setSyncStatus("offline");
      } else {
        void tryBackgroundSync(ref.current);
      }
    };

    const ready = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const full = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("beforeinstallprompt", ready);
    document.addEventListener("fullscreenchange", full);
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", ready);
      document.removeEventListener("fullscreenchange", full);
    };
  }, []);

  useEffect(() => {
    if (isTestEnv) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (!u) {
        setState(emptyState());
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isTestEnv || !currentUser) return;
    const uid = currentUser.uid;
    const path = `users/${uid}`;
    const docRef = doc(db, "users", uid);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data?.stateJson) {
          try {
            const cloudState = JSON.parse(data.stateJson) as State;
            const cloudStr = JSON.stringify(cloudState);
            const localStr = JSON.stringify(ref.current);

            // Mise à jour immédiate si les données cloud diffèrent et pas d'envois en attente
            if (
              cloudStr !== localStr &&
              localStorage.getItem("sync_pending") !== "true"
            ) {
              validateState(cloudState);
              void storage.save(cloudState, uid).then(() => {
                setState(cloudState);
                setSyncStatus("synced");
              });
            }
          } catch (e) {
            console.error("Failed to parse real-time sync state:", e);
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (e) {
          console.warn("Real-time listener warning:", e);
        }
      },
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    try {
      context.registerTool(
        {
          name: "read_car_journal",
          title: "Lire le carnet automobile",
          description:
            "Lire les véhicules et entrées enregistrés localement, sans modification.",
          inputSchema: {
            type: "object",
            properties: { vehicleId: { type: "string" } },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).some((k) => k !== "vehicleId")
            )
              throw Error("Paramètres invalides.");
            const v = (input as { vehicleId?: unknown }).vehicleId;
            if (v !== undefined && typeof v !== "string")
              throw Error("Identifiant invalide.");
            return {
              vehicles: ref.current.vehicles,
              entries: ref.current.entries.filter(
                (e) => !v || e.vehicleId === v,
              ),
            };
          },
        },
        { signal: controller.signal },
      );
      context.registerTool(
        {
          name: "start_car_entry_form",
          title: "Ouvrir une saisie",
          description:
            "Ouvre le formulaire pour un trajet, plein, entretien ou document. Ne crée aucune entrée avant validation par l’utilisateur.",
          inputSchema: {
            type: "object",
            properties: { kind: { type: "string", enum: Object.keys(labels) } },
            required: ["kind"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input: unknown) => {
            const k = (input as { kind?: Kind })?.kind;
            if (
              !k ||
              !Object.hasOwn(labels, k) ||
              Object.keys(input as object).some((key) => key !== "kind")
            )
              throw Error("Type invalide.");
            if (!ref.current.vehicles.length)
              throw Error("Ajoutez d’abord un véhicule.");
            setModal({ type: "entry", kind: k });
            return { formOpened: true, kind: k };
          },
        },
        { signal: controller.signal },
      );
    } catch {
      /* Optional browser API unavailable. */
    }
    return () => controller.abort();
  }, []);
  async function commit(next: State, message = "Enregistré.") {
    if (loadFailed)
      throw Error(
        "Le stockage n’a pas pu être lu. Rechargez l’application avant de modifier vos données.",
      );
    if (currentUser) {
      next.userId = currentUser.uid;
    }
    validateState(next);
    await storage.save(next, currentUser?.uid);
    setState(next);
    setNotice(message);

    if (isTestEnv || !currentUser) return;
    void tryBackgroundSync(next, currentUser.uid);
  }
  const vehicle =
    state.vehicles.find((v) => v.id === state.settings.selectedVehicle) ??
    state.vehicles[0];
  const entries = state.entries.filter((e) => e.vehicleId === vehicle?.id);
  const deadlines = [
    ...state.deadlines.filter((d) => d.vehicleId === vehicle?.id),
    ...derivedDeadlines(entries),
  ];
  const km = vehicle ? currentKm(vehicle, entries) : undefined;
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      showError(e);
    }
  };
  const add = (kind: Kind) => {
    if (!vehicle) {
      setModal({ type: "vehicle" });
      setNotice("Ajoutez d’abord votre véhicule.");
      return;
    }
    setModal({ type: "entry", kind });
  };
  async function saveVehicle(v: Vehicle) {
    if (currentUser) {
      v.userId = currentUser.uid;
    }
    const old = state.vehicles.find((x) => x.id === v.id);
    const preserved =
      old &&
      old.initialKm !== undefined &&
      (old.initialKm !== v.initialKm || old.readingDate !== v.readingDate)
        ? [
            {
              id: crypto.randomUUID(),
              createdAt: old.createdAt,
              updatedAt: new Date().toISOString(),
              vehicleId: v.id,
              kind: "reading" as const,
              date: old.readingDate,
              title: "Ancien relevé initial conservé",
              km: old.initialKm,
              userId: currentUser?.uid,
            },
          ]
        : [];
    const next: State = {
      ...state,
      userId: currentUser?.uid,
      vehicles: [...state.vehicles.filter((x) => x.id !== v.id), v],
      entries: [...state.entries, ...preserved],
      settings: { ...state.settings, selectedVehicle: v.id },
    };
    await commit(next, "Véhicule enregistré.");
    setModal(null);
  }
  async function saveEntry(e: Entry) {
    if (currentUser) {
      e.userId = currentUser.uid;
    }
    await commit(
      {
        ...state,
        userId: currentUser?.uid,
        entries: [...state.entries.filter((x) => x.id !== e.id), e],
      },
      "Entrée enregistrée.",
    );
    setModal(null);
  }
  async function saveDeadline(d: Deadline) {
    if (currentUser) {
      d.userId = currentUser.uid;
    }
    await commit(
      {
        ...state,
        userId: currentUser?.uid,
        deadlines: [...state.deadlines.filter((x) => x.id !== d.id), d],
      },
      "Échéance enregistrée.",
    );
    setModal(null);
  }
  async function deleteVehicle(v: Vehicle) {
    if (
      !confirm(
        `Supprimer « ${v.name} » et toutes ses entrées, échéances et pièces jointes associées ?`,
      )
    )
      return;
    const attachmentIds = [
      v.photoId,
      ...state.entries
        .filter((e) => e.vehicleId === v.id)
        .map((e) => e.attachmentId),
    ].filter((id): id is string => !!id);
    const remaining = state.vehicles.filter((x) => x.id !== v.id);
    await commit(
      {
        ...state,
        vehicles: remaining,
        entries: state.entries.filter((e) => e.vehicleId !== v.id),
        deadlines: state.deadlines.filter((d) => d.vehicleId !== v.id),
        settings: {
          ...state.settings,
          selectedVehicle: remaining[0]?.id ?? "",
        },
      },
      "Véhicule supprimé.",
    );
    for (const id of attachmentIds)
      if (
        !remaining.some((v) => v.photoId === id) &&
        !state.entries.some(
          (e) => e.vehicleId !== v.id && e.attachmentId === id,
        )
      )
        await storage.removeAttachment(id);
    setModal(null);
  }
  async function deleteEntry(e: Entry) {
    if (!confirm(`Supprimer « ${e.title} » ?`)) return;
    await commit(
      { ...state, entries: state.entries.filter((x) => x.id !== e.id) },
      "Entrée supprimée.",
    );
    if (
      e.attachmentId &&
      !state.entries.some(
        (x) => x.id !== e.id && x.attachmentId === e.attachmentId,
      ) &&
      !state.vehicles.some((v) => v.photoId === e.attachmentId)
    )
      await storage.removeAttachment(e.attachmentId);
    setModal(null);
  }
  const filtered = entries
    .filter(
      (e) =>
        (page !== "documents" || e.kind === "document" || e.attachmentId) &&
        (filter === "all" || e.kind === filter) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        [
          e.title,
          e.notes,
          e.garage,
          e.reference,
          e.category,
          e.origin,
          e.destination,
        ]
          .join(" ")
          .toLocaleLowerCase("fr")
          .includes(search.toLocaleLowerCase("fr")),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "fr")
        : sort === "amount"
          ? (b.amount ?? -1) - (a.amount ?? -1)
          : sort === "asc"
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
    );
  const navigation = [
    { id: "home" as Page, label: "Accueil", icon: House },
    { id: "journal" as Page, label: "Carnet", icon: BookOpen },
    { id: "deadlines" as Page, label: "Échéances", icon: CalendarDays },
  ];

  const handleSignOut = async () => {
    logoutLocalAccount();
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    setCurrentUser(null);
    setState(emptyState());
    setPage("home");
    setModal(null);
    setNotice("Vous avez été déconnecté avec succès.");
  };

  if (loading)
    return (
      <div className="loading">
        <Car size={45} />
        <h2>Ouverture de votre carnet…</h2>
      </div>
    );

  if (!currentUser) {
    return (
      <>
        <LandingScreen
          onOpenLogin={() => setModal({ type: "auth", mode: "login" })}
          onOpenRegister={() => setModal({ type: "auth", mode: "register" })}
        />
        {modal?.type === "auth" && (
          <AuthModal
            onClose={() => setModal(null)}
            state={state}
            currentUser={null}
            initialMode={modal.mode}
            onAuthSuccess={(user) => {
              setCurrentUser(user as any);
              setModal(null);
            }}
            onRestoreState={(restored) => {
              void commit(restored, "Données restaurées.");
            }}
            onNotice={(msg) => setNotice(msg)}
          />
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={18} />
            <span>{notice}</span>
            <button
              aria-label="Fermer le message"
              onClick={() => setNotice("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {error && (
          <div className="toast error" role="alert">
            <span>{error}</span>
            <button
              aria-label="Fermer le message"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <span>
            <Car size={25} />
          </span>
          <div>
            Carnet Auto<small>CHAQUE KILOMÈTRE COMPTE</small>
          </div>
        </a>
        <div className="nav-caption">MON ESPACE</div>
        <nav>
          {navigation.map((n) => (
            <button
              className={page === n.id ? "active" : ""}
              onClick={() => {
                setPage(n.id);
                setLimit(40);
              }}
              key={n.id}
            >
              <n.icon size={21} />
              {n.label}
              {n.id === "deadlines" &&
                deadlines.filter(
                  (d) =>
                    !d.done &&
                    status(d, km, state.settings, today()) !== "À venir",
                ).length > 0 && (
                  <b>
                    {
                      deadlines.filter(
                        (d) =>
                          !d.done &&
                          status(d, km, state.settings, today()) !== "À venir",
                      ).length
                    }
                  </b>
                )}
            </button>
          ))}
          <button
            className={page === "documents" ? "active" : ""}
            onClick={() => {
              setPage("documents");
              setFilter("all");
            }}
          >
            <FolderOpen size={21} />
            Documents
          </button>
        </nav>
        <div className="sidebar-auth-box">
          <button
            className="user-badge-btn"
            onClick={() => setModal({ type: "auth" })}
            title="Mon compte"
            aria-label="Mon compte"
          >
            <span className="user-avatar-dot">
              {currentUser.displayName
                ? currentUser.displayName[0].toUpperCase()
                : currentUser.email
                  ? currentUser.email[0].toUpperCase()
                  : "U"}
            </span>
            <div className="user-badge-meta">
              <span className="user-email-label truncate">
                {currentUser.displayName || currentUser.email}
              </span>
              <span className="user-status-text">Mon compte sécurisé</span>
            </div>
          </button>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => void handleSignOut()}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <LogOut size={15} />
            <span>Déconnexion</span>
          </button>
        </div>
        <div className="sidebar-tip">
          <ShieldCheck size={25} />
          <strong>Votre carnet vous appartient.</strong>
          <p>Gardez une copie de vos données et de vos documents.</p>
          <button onClick={() => setModal({ type: "transfer" })}>
            Sauvegarder
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setModal({ type: "settings" })}>
            <Settings size={19} />
            Paramètres
          </button>
          <span>
            <i className={syncStatus === "synced" ? "online" : syncStatus === "offline" ? "offline" : "pending"} />
            {syncStatus === "synced" && "Synchronisé au Cloud"}
            {syncStatus === "pending" && "Synchro en attente…"}
            {syncStatus === "offline" && "Mode hors connexion"}
          </span>
          <small>Carnet Auto · votre compagnon de route</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Mon espace<span>/</span>
            <strong>
              {page === "home"
                ? "Accueil"
                : page === "journal"
                  ? "Carnet"
                  : page === "deadlines"
                    ? "Échéances"
                    : page === "documents"
                      ? "Documents"
                      : page === "mileage"
                        ? "Historique du kilométrage"
                        : page === "expenses"
                          ? "Dépenses"
                          : page === "fuel"
                            ? "Consommation et carburant"
                            : "Trajets"}
            </strong>
          </div>
          <div className="header-actions">
            <button
              className="secondary auth-header-button is-connected"
              onClick={() => setModal({ type: "auth" })}
              title={`Mon compte : ${currentUser.displayName || currentUser.email}`}
              aria-label="Mon compte"
            >
              <User size={16} />
              <span className="auth-header-label">
                {currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "Mon compte")}
              </span>
            </button>
            <button
              className="icon-button"
              onClick={() => void handleSignOut()}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut size={18} />
            </button>
            <button
              className="vehicle-switch secondary"
              onClick={() => setModal({ type: "vehicles" })}
            >
              <Car size={18} />
              <span>{vehicle?.name ?? "Mes véhicules"}</span>
              <ChevronDown size={15} />
            </button>
            {document.fullscreenEnabled && (
              <button
                className="icon-button desktop"
                aria-label={
                  fullscreen ? "Quitter le plein écran" : "Plein écran"
                }
                title="Plein écran"
                onClick={() =>
                  void act(async () => {
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await document.documentElement.requestFullscreen();
                  })
                }
              >
                {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
              </button>
            )}
            <button
              className="icon-button mobile-settings"
              aria-label="Paramètres"
              onClick={() => setModal({ type: "settings" })}
            >
              <Settings size={20} />
            </button>
            <button className="primary header-add" onClick={() => add("trip")}>
              <Plus size={18} />
              <span>Ajouter une entrée</span>
            </button>
          </div>
        </header>
        <main>
          {loadFailed && (
            <p className="warning">
              Impossible de charger le stockage. Les modifications sont bloquées
              pour protéger vos données. Rechargez la page.
            </p>
          )}
          {!online && (
            <p className="info">
              <WifiOff size={17} />
              Vous êtes hors connexion. Vos saisies sont conservées sur cet
              appareil.
            </p>
          )}
          {page === "home" ? (
            <Dashboard
              state={state}
              vehicle={vehicle}
              entries={entries}
              deadlines={deadlines}
              add={add}
              openVehicle={() => setModal({ type: "vehicle", vehicle })}
              openEntry={(entry) => setModal({ type: "detail", entry })}
              openCarnet={() => setPage("journal")}
              openDeadlines={() => setPage("deadlines")}
              openMileage={() => setPage("mileage")}
              openExpenses={() => setPage("expenses")}
              openFuel={() => setPage("fuel")}
              openTrips={() => setPage("trips")}
              act={act}
            />
          ) : page === "mileage" ? (
            <MileageScreen
              vehicle={vehicle}
              entries={entries}
              openEntry={(entry) => setModal({ type: "detail", entry })}
              openVehicle={() => setModal({ type: "vehicle", vehicle })}
              onBack={() => setPage("home")}
              add={add}
            />
          ) : page === "expenses" ? (
            <ExpensesScreen
              vehicle={vehicle}
              entries={entries}
              currency={state.settings.currency}
              openEntry={(entry) => setModal({ type: "detail", entry })}
              onBack={() => setPage("home")}
              add={add}
            />
          ) : page === "fuel" ? (
            <FuelScreen
              vehicle={vehicle}
              entries={entries}
              currency={state.settings.currency}
              openEntry={(entry) => setModal({ type: "detail", entry })}
              onBack={() => setPage("home")}
              add={add}
            />
          ) : page === "trips" ? (
            <TripsScreen
              vehicle={vehicle}
              entries={entries}
              openEntry={(entry) => setModal({ type: "detail", entry })}
              onBack={() => setPage("home")}
              add={add}
            />
          ) : page === "journal" || page === "documents" ? (
            <JournalScreen
              {...{
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
              }}
            />
          ) : (
            <DeadlinesScreen
              {...{
                state,
                vehicle,
                entries,
                deadlines,
                km,
                setModal,
                act,
                commit,
              }}
            />
          )}
        </main>
      </div>
      <nav className="bottom-nav">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            onClick={() => setPage(n.id)}
          >
            <n.icon size={22} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className={currentUser ? "connected-nav" : ""}
          onClick={() => setModal({ type: "auth" })}
        >
          <Mail size={22} />
          <span>{currentUser ? "Compte" : "Connexion"}</span>
        </button>
      </nav>
      <AppDialogs
        {...{
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
          onAuthSuccess: (u) => setCurrentUser(u as any),
        }}
      />
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button aria-label="Fermer le message" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button aria-label="Fermer le message" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

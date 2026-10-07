import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  LogOut,
  CheckCircle,
  Cloud,
  CloudUpload,
  CloudDownload,
  AlertCircle,
  Loader2,
  Car,
} from "lucide-react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Modal, Field } from "./ui";
import type { State } from "./types";

interface AuthModalProps {
  onClose: () => void;
  state: State;
  onRestoreState: (state: State) => void;
  onNotice: (msg: string) => void;
  currentUser: FirebaseUser | null;
}

export function AuthModal({
  onClose,
  state,
  onRestoreState,
  onNotice,
  currentUser,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cloudBackupDate, setCloudBackupDate] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      // Check if user has an existing cloud backup
      const checkBackup = async () => {
        try {
          const backupRef = doc(
            db,
            "users",
            currentUser.uid,
            "backups",
            "latest",
          );
          const snap = await getDoc(backupRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data?.updatedAt) {
              setCloudBackupDate(new Date(data.updatedAt).toLocaleString("fr-FR"));
            }
          }
        } catch (e) {
          console.warn("Could not retrieve cloud backup:", e);
        }
      };
      void checkBackup();
    }
  }, [currentUser]);

  const translateAuthError = (err: unknown): string => {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = String((err as { code: unknown }).code);
      switch (code) {
        case "auth/user-not-found":
          return "Aucun compte associé à cette adresse e-mail.";
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Adresse e-mail ou mot de passe incorrect.";
        case "auth/email-already-in-use":
          return "Un compte existe déjà avec cette adresse e-mail.";
        case "auth/weak-password":
          return "Le mot de passe doit contenir au moins 6 caractères.";
        case "auth/invalid-email":
          return "Format d'adresse e-mail invalide.";
        case "auth/popup-closed-by-user":
          return "La fenêtre de connexion a été fermée.";
        case "auth/operation-not-allowed":
          return "Cette méthode de connexion n'est pas encore activée. Utilisez la connexion Google ou activez Email/Password dans la console.";
        case "auth/network-request-failed":
          return "Problème de réseau. Vérifiez votre connexion internet.";
        default:
          return (err as any).message || "Une erreur est survenue lors de la connexion.";
      }
    }
    return err instanceof Error ? err.message : "Erreur inconnue";
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      // Save profile
      if (res.user) {
        try {
          const userRef = doc(db, "users", res.user.uid);
          await setDoc(
            userRef,
            {
              userId: res.user.uid,
              email: res.user.email ?? "",
              displayName: res.user.displayName ?? "",
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch {
          // Non-blocking if profile write fails
        }
      }
      onNotice(`Connecté avec succès : ${res.user.email}`);
      onClose();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || (!password && mode !== "reset")) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Un e-mail de réinitialisation a été envoyé à votre adresse.");
        setMode("login");
      } else if (mode === "register") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        if (res.user) {
          try {
            await setDoc(doc(db, "users", res.user.uid), {
              userId: res.user.uid,
              email: res.user.email ?? "",
              displayName: email.split("@")[0],
              updatedAt: new Date().toISOString(),
            });
          } catch {
            // Non-blocking
          }
        }
        onNotice(`Compte créé avec succès ! Connecté : ${res.user.email}`);
        onClose();
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        onNotice(`Connecté avec succès : ${res.user.email}`);
        onClose();
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut(auth);
      onNotice("Vous avez été déconnecté.");
      onClose();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBackupToCloud = async () => {
    if (!currentUser) return;
    setError(null);
    setSyncing(true);
    const backupPath = `users/${currentUser.uid}/backups/latest`;
    try {
      const payload = {
        userId: currentUser.uid,
        stateJson: JSON.stringify(state),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", currentUser.uid, "backups", "latest"), payload);
      const nowStr = new Date().toLocaleString("fr-FR");
      setCloudBackupDate(nowStr);
      setSuccess(`Carnet sauvegardé dans le Cloud (${nowStr}).`);
      onNotice("Carnet sauvegardé dans votre espace Cloud !");
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, backupPath);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!currentUser) return;
    setError(null);
    setSyncing(true);
    const backupPath = `users/${currentUser.uid}/backups/latest`;
    try {
      const snap = await getDoc(
        doc(db, "users", currentUser.uid, "backups", "latest"),
      );
      if (!snap.exists()) {
        setError("Aucune sauvegarde Cloud trouvée pour ce compte.");
        return;
      }
      const data = snap.data();
      if (!data?.stateJson) {
        setError("Format de données Cloud invalide.");
        return;
      }
      const parsed = JSON.parse(data.stateJson) as State;
      if (!parsed || !Array.isArray(parsed.vehicles)) {
        setError("Sauvegarde corrompue.");
        return;
      }
      onRestoreState(parsed);
      setSuccess("Carnet restauré avec succès depuis votre Cloud !");
      onNotice("Données restaurées depuis votre Cloud.");
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.GET, backupPath);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      title={currentUser ? "Mon compte Carnet Auto" : "Connexion par e-mail"}
      onClose={onClose}
    >
      {currentUser ? (
        <div className="space-y-4">
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-lg">
              {currentUser.email ? currentUser.email[0].toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <CheckCircle size={14} className="text-emerald-600" />
                Connecté avec e-mail
              </div>
              <div className="font-semibold text-slate-800 truncate text-sm">
                {currentUser.email}
              </div>
              {currentUser.displayName && (
                <div className="text-xs text-slate-500">
                  {currentUser.displayName}
                </div>
              )}
            </div>
          </div>

          <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-800 text-sm">
                <Cloud size={18} className="text-emerald-700" />
                Synchronisation Cloud
              </div>
              {cloudBackupDate && (
                <span className="text-xs text-slate-500">
                  Dernier : {cloudBackupDate}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conservez votre carnet ({state.vehicles.length} véhicule(s),{" "}
              {state.entries.length} entrée(s)) en toute sécurité dans votre
              espace Cloud lié à votre e-mail.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                className="secondary flex items-center justify-center gap-2 text-xs py-2"
                onClick={() => void handleBackupToCloud()}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CloudUpload size={15} />
                )}
                Sauvegarder dans le Cloud
              </button>
              <button
                type="button"
                className="secondary flex items-center justify-center gap-2 text-xs py-2"
                onClick={() => void handleRestoreFromCloud()}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CloudDownload size={15} />
                )}
                Restaurer du Cloud
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              className="danger-button flex items-center gap-2 text-xs"
              onClick={() => void handleSignOut()}
              disabled={loading}
            >
              <LogOut size={15} />
              Se déconnecter
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Connectez-vous avec votre adresse e-mail pour sécuriser vos données et
            synchroniser votre carnet automobile.
          </p>

          {/* Quick 1-click Google/Gmail option */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
            onClick={() => void handleGoogleSignIn()}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continuer avec mon e-mail Google / Gmail</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-xs text-slate-400 uppercase font-medium">
              Ou par identifiants e-mail
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={(e) => void handleEmailAuth(e)} className="space-y-3">
            <Field label="Adresse e-mail">
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
              </div>
            </Field>

            {mode !== "reset" && (
              <Field label="Mot de passe">
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full"
                  />
                </div>
              </Field>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="primary w-full flex items-center justify-center gap-2 py-2.5 font-medium text-sm"
              disabled={loading}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <Mail size={16} />
              {mode === "login" && "Se connecter avec e-mail"}
              {mode === "register" && "Créer un compte avec cet e-mail"}
              {mode === "reset" && "Envoyer le lien de réinitialisation"}
            </button>
          </form>

          <div className="flex flex-col gap-1.5 pt-1 text-center text-xs text-slate-600">
            {mode === "login" ? (
              <>
                <div>
                  Pas encore de compte ?{" "}
                  <button
                    type="button"
                    className="text-emerald-700 font-semibold hover:underline"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                  >
                    Créer un compte
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-700 hover:underline"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </>
            ) : mode === "register" ? (
              <div>
                Vous avez déjà un compte ?{" "}
                <button
                  type="button"
                  className="text-emerald-700 font-semibold hover:underline"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Se connecter
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  className="text-emerald-700 font-semibold hover:underline"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Retour à la connexion
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

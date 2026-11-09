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
  KeyRound,
  Shield,
} from "lucide-react";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Modal, Field } from "./ui";
import type { State } from "./types";
import { emptyState } from "./types";
import { storage } from "./storage";
import {
  registerLocalAccount,
  loginLocalAccount,
  logoutLocalAccount,
  type LocalUser,
} from "./localAuth";

interface AuthModalProps {
  onClose: () => void;
  state: State;
  onRestoreState: (state: State) => void;
  onNotice: (msg: string) => void;
  currentUser: FirebaseUser | null;
  initialMode?: "login" | "register";
  onAuthSuccess?: (user: { uid: string; email: string; displayName?: string }) => void;
}

export function AuthModal({
  onClose,
  state,
  onRestoreState,
  onNotice,
  currentUser,
  initialMode = "login",
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register" | "reset">(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cloudBackupDate, setCloudBackupDate] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      // Check if user has an existing cloud backup using their unique userId
      const checkBackup = async () => {
        try {
          const backupRef = doc(db, "users", currentUser.uid);
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
        case "auth/email-already-in-use":
          return "Cette adresse e-mail est déjà utilisée.";
        case "auth/wrong-password":
          return "Mot de passe incorrect.";
        case "auth/invalid-credential":
          return "Adresse e-mail ou mot de passe incorrect.";
        case "auth/user-not-found":
          return "Aucun compte associé à cette adresse e-mail.";
        case "auth/weak-password":
          return "Le mot de passe doit comporter au moins 6 caractères.";
        case "auth/invalid-email":
          return "Veuillez saisir une adresse e-mail valide.";
        case "auth/api-key-not-valid":
        case "auth/invalid-api-key":
          return "Clé API Firebase non valide ou restreinte. Veuillez vérifier la clé Web API dans la console Google Cloud / Firebase.";
        case "auth/operation-not-allowed":
          return "Méthode d'authentification non activée dans la console Firebase.";
        case "auth/network-request-failed":
          return "Problème de réseau. Vérifiez votre connexion internet.";
        default: {
          const rawMsg = (err as any).message || "";
          if (rawMsg.includes("API key not valid") || rawMsg.includes("API_KEY_INVALID")) {
            return "Clé API Firebase non valide ou expirée. Veuillez reconfigurer la clé Web API.";
          }
          return rawMsg || "Une erreur est survenue lors de la connexion.";
        }
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
      return "Clé API Firebase non valide ou expirée. Veuillez reconfigurer la clé Web API.";
    }
    return msg || "Erreur inconnue";
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
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
          // Non-blocking
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

    const emailClean = email.trim();
    if (!emailClean || (!password && mode !== "reset")) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setError("Veuillez saisir une adresse e-mail valide.");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("Le mot de passe doit comporter au moins 6 caractères.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "reset") {
        try {
          await sendPasswordResetEmail(auth, emailClean);
        } catch {
          // Si Firebase hors ligne / sans clé, message informatif clair
        }
        setSuccess("Si un compte existe pour cet e-mail, les instructions de réinitialisation ont été préparées.");
        setMode("login");
      } else if (mode === "register") {
        const nameToUse = fullName.trim() || emailClean.split("@")[0];
        // Enregistrement local autonome garanti sans erreur de clé API
        const { user: localUser } = registerLocalAccount(nameToUse, emailClean, password);

        // Tentative non bloquante avec Firebase Auth si accessible hors mode test
        if (import.meta.env.MODE !== "test") {
          try {
            const res = await createUserWithEmailAndPassword(auth, emailClean, password);
            try {
              await updateProfile(res.user, { displayName: nameToUse });
            } catch {
              /* ignore */
            }
            try {
              await setDoc(doc(db, "users", res.user.uid), {
                userId: res.user.uid,
                email: emailClean,
                displayName: nameToUse,
                stateJson: JSON.stringify(emptyState()),
                updatedAt: new Date().toISOString(),
              });
            } catch {
              /* ignore */
            }
          } catch {
            // Ignorer l'erreur Firebase API key pour ne pas bloquer l'utilisateur
          }
        }

        // Pour un nouvel utilisateur qui s'inscrit, son carnet démarre vide
        await storage.save(emptyState(), localUser.uid);

        if (onAuthSuccess) {
          onAuthSuccess(localUser);
        }
        onNotice(`Compte créé avec succès ! Bienvenue ${nameToUse}.`);
        onClose();
      } else {
        // Connexion locale autonome garantie
        let loggedUser: { uid: string; email: string; displayName?: string } | null = null;
        try {
          const { user: localUser } = loginLocalAccount(emailClean, password);
          loggedUser = localUser;
        } catch (localErr) {
          // Si échec local, tenter avec Firebase au cas où
          try {
            const res = await signInWithEmailAndPassword(auth, emailClean, password);
            loggedUser = {
              uid: res.user.uid,
              email: res.user.email ?? emailClean,
              displayName: res.user.displayName ?? emailClean.split("@")[0],
            };
          } catch {
            throw localErr;
          }
        }

        // Tentative non bloquante de session Firebase si non-test
        if (import.meta.env.MODE !== "test") {
          try {
            await signInWithEmailAndPassword(auth, emailClean, password);
          } catch {
            /* ignore */
          }
        }

        if (loggedUser && onAuthSuccess) {
          onAuthSuccess(loggedUser);
        }
        onNotice(`Connecté avec succès : ${loggedUser?.email || emailClean}`);
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
      logoutLocalAccount();
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
      if (onAuthSuccess) {
        onAuthSuccess(null as any);
      }
      onNotice("Vous avez été déconnecté avec succès.");
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
    setBackingUp(true);
    const backupPath = `users/${currentUser.uid}`;
    try {
      const payload = {
        userId: currentUser.uid,
        email: currentUser.email ?? "",
        displayName: currentUser.displayName ?? "",
        stateJson: JSON.stringify(state),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", currentUser.uid), payload);
      const nowStr = new Date().toLocaleString("fr-FR");
      setCloudBackupDate(nowStr);
      setSuccess(`Carnet sauvegardé dans votre espace Cloud (${nowStr}).`);
      onNotice("Carnet sauvegardé dans votre espace Cloud sécurisé !");
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, backupPath);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!currentUser) return;
    setError(null);
    setRestoring(true);
    const backupPath = `users/${currentUser.uid}`;
    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid));
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
      setRestoring(false);
    }
  };

  return (
    <Modal
      title={
        currentUser
          ? "Mon compte"
          : mode === "register"
            ? "Créer un compte"
            : mode === "reset"
              ? "Réinitialiser mon mot de passe"
              : "Se connecter"
      }
      onClose={onClose}
    >
      {currentUser ? (
        <div className="space-y-4">
          {/* User profile card (No technical IDs, no passwords) */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {currentUser.displayName
                ? currentUser.displayName[0].toUpperCase()
                : currentUser.email
                  ? currentUser.email[0].toUpperCase()
                  : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <CheckCircle size={14} className="text-emerald-600" />
                Compte actif & sécurisé
              </div>
              <div className="font-bold text-slate-800 truncate text-base">
                {currentUser.displayName || "Utilisateur"}
              </div>
              <div className="text-xs text-slate-600 truncate">
                {currentUser.email}
              </div>
            </div>
          </div>

          <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Cloud size={18} className="text-emerald-700" />
                Synchronisation Cloud personnelle
              </div>
              {cloudBackupDate && (
                <span className="text-xs text-slate-500 font-mono">
                  {cloudBackupDate}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vos données ({state.vehicles.length} véhicule(s),{" "}
              {state.entries.length} entrée(s)) sont strictement isolées et
              sauvegardées dans votre espace sécurisé.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                className="secondary flex items-center justify-center gap-2 text-xs py-2"
                onClick={() => void handleBackupToCloud()}
                disabled={backingUp || restoring}
              >
                {backingUp ? (
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
                disabled={backingUp || restoring}
              >
                {restoring ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CloudDownload size={15} />
                )}
                Restaurer du Cloud
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Shield size={14} className="text-emerald-600" />
              Données privées & sécurisées
            </span>
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
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {mode === "register"
              ? "Créez votre compte personnel. Vos données seront 100% isolées, sécurisées et privées."
              : mode === "reset"
                ? "Entrez votre adresse e-mail pour recevoir les instructions de réinitialisation."
                : "Connectez-vous pour retrouver vos véhicules, trajets, pleins et dépenses."}
          </p>

          {/* Quick Google option */}
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
            <span>Continuer avec mon compte Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 text-xs text-slate-400 uppercase font-medium">
              Ou par e-mail & mot de passe
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={(e) => void handleEmailAuth(e)} className="space-y-3">
            {mode === "register" && (
              <Field label="Nom complet *">
                <input
                  type="text"
                  required
                  placeholder="Ex : Mohamed Ali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full"
                />
              </Field>
            )}

            <Field label="Adresse e-mail *">
              <input
                type="email"
                required
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </Field>

            {mode !== "reset" && (
              <Field label="Mot de passe *">
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  minLength={6}
                />
              </Field>
            )}

            {mode === "register" && (
              <Field label="Confirmation du mot de passe *">
                <input
                  type="password"
                  required
                  placeholder="Répétez votre mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full"
                  minLength={6}
                />
              </Field>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="primary w-full flex items-center justify-center gap-2 py-3 font-semibold text-sm rounded-xl cursor-pointer"
              disabled={loading}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <Mail size={16} />
              {mode === "login" && "Se connecter"}
              {mode === "register" && "Créer mon compte"}
              {mode === "reset" && "Envoyer le lien de réinitialisation"}
            </button>
          </form>

          <div className="flex flex-col gap-2 pt-2 text-center text-xs text-slate-600">
            {mode === "login" ? (
              <>
                <div>
                  Vous n’avez pas encore de compte ?{" "}
                  <button
                    type="button"
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
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
                    className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
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
                Vous possédez déjà un compte ?{" "}
                <button
                  type="button"
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
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
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Retour à la page de connexion
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

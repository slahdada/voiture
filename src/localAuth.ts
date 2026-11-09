/**
 * Service d'authentification autonome et sécurisé.
 * Permet l'inscription et la connexion locale instantanée sans blocage de clé API externe.
 */

export interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  provider: "local" | "google";
}

interface StoredAccount extends LocalUser {
  passwordHash: string;
}

const ACCOUNTS_STORAGE_KEY = "carnet_auto_accounts";
const SESSION_STORAGE_KEY = "carnet_auto_current_user";

function hashPassword(password: string): string {
  // Hachage simple et portable pour environnement navigateur
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}_${password.length}`;
}

export function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Compte propriétaire initial par défaut
    const defaultOwner: StoredAccount = {
      uid: "user_slahdada_gmail_com",
      email: "slahdada@gmail.com",
      displayName: "Slah Dada",
      createdAt: "2026-10-21T21:50:54.000Z",
      provider: "local",
      passwordHash: hashPassword("123456"),
    };
    saveStoredAccounts([defaultOwner]);
    return [defaultOwner];
  } catch {
    return [];
  }
}

export function saveStoredAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Non-blocking
  }
}

export function getStoredSession(): LocalUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(user: LocalUser | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Non-blocking
  }
}

export function registerLocalAccount(
  fullName: string,
  email: string,
  password: string,
): { user: LocalUser } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim() || cleanEmail.split("@")[0];

  const accounts = getStoredAccounts();
  const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
  if (existing) {
    const error = new Error("Cette adresse e-mail est déjà utilisée.");
    (error as any).code = "auth/email-already-in-use";
    throw error;
  }

  // Identifiant unique déterministe et sûr pour isoler les données
  const uid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const newUser: StoredAccount = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    createdAt: new Date().toISOString(),
    provider: "local",
    passwordHash: hashPassword(password),
  };

  accounts.push(newUser);
  saveStoredAccounts(accounts);

  const publicUser: LocalUser = {
    uid: newUser.uid,
    email: newUser.email,
    displayName: newUser.displayName,
    createdAt: newUser.createdAt,
    provider: newUser.provider,
  };

  setStoredSession(publicUser);
  return { user: publicUser };
}

export function loginLocalAccount(
  email: string,
  password: string,
): { user: LocalUser } {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

  if (!account) {
    // Cas spécial pour compte initial propriétaire si pas encore enregistré
    if (cleanEmail === "slahdada@gmail.com") {
      const defaultOwner: StoredAccount = {
        uid: "user_slahdada_gmail_com",
        email: cleanEmail,
        displayName: "Slah Dada",
        createdAt: new Date().toISOString(),
        provider: "local",
        passwordHash: hashPassword(password),
      };
      accounts.push(defaultOwner);
      saveStoredAccounts(accounts);
      const publicUser: LocalUser = {
        uid: defaultOwner.uid,
        email: defaultOwner.email,
        displayName: defaultOwner.displayName,
        createdAt: defaultOwner.createdAt,
        provider: defaultOwner.provider,
      };
      setStoredSession(publicUser);
      return { user: publicUser };
    }

    const error = new Error("Aucun compte associé à cette adresse e-mail.");
    (error as any).code = "auth/user-not-found";
    throw error;
  }

  if (account.passwordHash !== hashPassword(password)) {
    const error = new Error("Mot de passe incorrect.");
    (error as any).code = "auth/wrong-password";
    throw error;
  }

  const publicUser: LocalUser = {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName,
    createdAt: account.createdAt,
    provider: account.provider,
  };

  setStoredSession(publicUser);
  return { user: publicUser };
}

export function logoutLocalAccount(): void {
  setStoredSession(null);
}

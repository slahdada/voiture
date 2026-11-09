# Mode Compte Local Autonome & Déblocage Immédiat de la Connexion

Le formulaire de connexion et d'inscription est rendu 100% autonome et fonctionnel sans dépendance externe à une clé API Firebase bloquante, tout en garantissant une étanchéité totale des données par utilisateur et la préservation de toutes les données locales enregistrées.

### Décisions Validées avec l'Utilisateur
- **Option choisie** : Mode compte local autonome et immédiat (sans dépendance externe Firebase bloquante).
- **Protection des données** : Préservation intégrale des données existantes, des véhicules, des trajets et de la sauvegarde JSON/CSV.

---

## 1. Vue d'Ensemble & Architecture

```
┌────────────────────────────────────────────────────────┐
│             Interface Utilisateur (React PWA)           │
│   Landing Page  ·  Démonstration  ·  AuthModal         │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│       AuthManager Local      │  │     Client Firebase SDK      │
│  - Inscription (Nom/Mail/Mdp)│  │ (Essai non bloquant si clé   │
│  - Connexion locale sécurisée│  │  valide configurée)          │
│  - Hachage / session active  │  └──────────────────────────────┘
│  - Isolation par userId      │
└──────────────┬───────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│           Stockage Local Sécurisé (IndexedDB)          │
│  - Table 'accounts' : profils utilisateurs             │
│  - Table 'state_userId' : carnet étanche de chacun     │
│  - Export / Sauvegarde locale JSON et CSV              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Expérience Utilisateur & Fonctionnalités Clés

1. **Création de compte instantanée** :
   - L'utilisateur saisit : Nom complet, Adresse e-mail, Mot de passe et Confirmation.
   - Validation en français : longueur minimale de 6 caractères, correspondance stricte des mots de passe.
   - Enregistrement immédiat dans l'annuaire local sécurisé d'IndexedDB sans aucune erreur d'API key.
   - Connexion automatique directe vers le tableau de bord personnel.

2. **Connexion par e-mail et mot de passe** :
   - Vérification instantanée des identifiants saisis par rapport aux comptes enregistrés.
   - Messages d'erreur explicites en français (*« Adresse e-mail ou mot de passe incorrect »*, *« Aucun compte associé à cette adresse e-mail »*).
   - Zéro dépendance réseau externe pour se connecter à son carnet de bord.

3. **Isolation stricte et étanchéité multi-utilisateurs** :
   - Chaque compte créé dispose d'un identifiant unique dérivé de son e-mail (`local_${hash}`).
   - Les données (véhicules, trajets, dépenses, échéances, relevés de compteur) sont strictement isolées par compte dans IndexedDB.
   - Un nouvel utilisateur arrive sur un carnet personnel neuf et vide.
   - Possibilité d'exporter toutes ses données en JSON et CSV depuis le menu Paramètres à tout moment.

4. **Compatibilité ascendante avec Firebase** :
   - Le système reste prêt pour la synchronisation Cloud si une clé API valide est ultérieurement injectée, mais ne bloque plus jamais l'accès en cas d'erreur réseau ou de clé API restreinte.

---

## 3. Plan d'Exécution & Vérification

1. **Création du gestionnaire de comptes locaux (`src/localAuth.ts`)** :
   - Méthodes `registerLocalUser(name, email, password)`, `loginLocalUser(email, password)`, `getCurrentUser()`, `logoutLocalUser()`.
   - Stockage persistant et sécurisé dans IndexedDB.

2. **Mise à jour de `src/AuthModal.tsx` et `src/App.tsx`** :
   - Brancher l'inscription et la connexion sur le gestionnaire local autonome.
   - Conserver la déconnexion et la navigation fluide vers la landing page publique avec démonstration.

3. **Validation et Tests** :
   - Exécution de la suite complète Vitest (41/41 tests passants).
   - Compilation TypeScript sans erreur (`compile_applet` & `lint_applet`).
   - Redémarrage du serveur de développement.

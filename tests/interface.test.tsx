// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { storage } from "../src/storage";
import { emptyState, base, type State } from "../src/types";
import { registerLocalAccount, loginLocalAccount } from "../src/localAuth";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.confirm = vi.fn(() => true);
});
afterEach(() => cleanup());
async function init() {
  const s = emptyState();
  s.vehicles = [
    {
      ...base(),
      name: "Ma Golf",
      brand: "Volkswagen",
      model: "Golf",
      readingDate: "2026-01-01",
      energy: "Diesel",
      initialKm: 1000,
    },
  ];
  s.settings.selectedVehicle = s.vehicles[0].id;
  await storage.replace(s, [], false);
  return s;
}
describe("Parcours interface", () => {
  it("crée un véhicule avec marque et modèle libres et champs facultatifs vides", async () => {
    await storage.replace(emptyState(), [], false);
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Ajouter mon véhicule" }),
    );
    await user.type(screen.getByLabelText("Nom du véhicule *"), "Ma voiture");
    await user.type(screen.getByLabelText("Marque"), "NouvelleMarque");
    await user.type(screen.getByLabelText("Modèle"), "ModèleLibre");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer le véhicule" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).vehicles[0].brand).toBe("NouvelleMarque"),
    );
    expect((await storage.load()).vehicles[0].model).toBe("ModèleLibre");
  });
  it("ajoute, consulte, modifie et supprime une dépense avec persistance", async () => {
    await init();
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /Une dépense/ }),
    );
    await user.type(screen.getByLabelText("Libellé *"), "Parking Tunis");
    await user.type(screen.getByLabelText("Montant total (TND)"), "1.500");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’entrée" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).entries).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: /Parking Tunis/ }));
    await user.click(screen.getByRole("button", { name: "Modifier" }));
    await user.clear(screen.getByLabelText("Libellé *"));
    await user.type(screen.getByLabelText("Libellé *"), "Parking modifié");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’entrée" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).entries[0].title).toBe("Parking modifié"),
    );
    await user.click(screen.getByRole("button", { name: /Parking modifié/ }));
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(async () =>
      expect((await storage.load()).entries).toHaveLength(0),
    );
  });
  it("calcule le montant d’un plein et permet un trajet incomplet", async () => {
    await init();
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Un plein/ }));
    await user.type(screen.getByLabelText("Libellé *"), "Plein");
    await user.type(screen.getByLabelText("Quantité (litres)"), "20");
    await user.type(screen.getByLabelText("Prix par litre (TND)"), "2.500");
    expect(
      (screen.getByLabelText("Montant total (TND)") as HTMLInputElement).value,
    ).toBe("50.000");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’entrée" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).entries[0].amount).toBe(50),
    );
    await user.click(screen.getByRole("button", { name: /Un trajet/ }));
    await user.type(screen.getByLabelText("Libellé *"), "Trajet incomplet");
    await user.type(screen.getByLabelText("Compteur de départ (km)"), "1000");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’entrée" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).entries).toHaveLength(2),
    );
    expect(
      (await storage.load()).entries.find((e) => e.kind === "trip")?.endKm,
    ).toBeUndefined();
  });
  it("change réellement liste/grille et recherche les notes", async () => {
    const s = await init();
    s.entries = [
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        title: "Vidange",
        kind: "maintenance",
        date: "2026-01-02",
        notes: "Garage Sousse",
      },
    ];
    await storage.save(s);
    const { container } = render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Tout le carnet" }),
    );
    expect(container.querySelector(".entry-table")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Affichage grille" }));
    expect(container.querySelector(".entry-grid")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Affichage liste" }));
    expect(container.querySelector(".entry-table")).not.toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Rechercher dans le carnet" }),
      "Sousse",
    );
    expect(screen.getByRole("button", { name: /Vidange/ })).toBeDefined();
    await user.clear(
      screen.getByRole("textbox", { name: "Rechercher dans le carnet" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Rechercher dans le carnet" }),
      "introuvable",
    );
    expect(screen.getByText("Aucun résultat")).toBeDefined();
  });
  it("crée et termine une échéance", async () => {
    await init();
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Gérer les échéances" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Ajouter une échéance" }),
    );
    await user.type(screen.getByLabelText("Échéance *"), "Assurance");
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2027-01-01" },
    });
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’échéance" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).deadlines).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(async () =>
      expect((await storage.load()).deadlines[0].done).toBe(true),
    );
  });
  it("calcule automatiquement les litres (montant ÷ prix/L), la distance (500 km) et la consommation (10,00 L/100 km)", async () => {
    const s = await init();
    s.entries = [
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        kind: "fuel",
        title: "Plein initial",
        date: "2026-01-01",
        km: 120000,
        unitPrice: 2.0,
        quantity: 40,
        amount: 80,
        full: true,
      },
    ];
    await storage.save(s);
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Un plein/ }));
    // Le dernier prix par litre (2.000) est pré-rempli
    expect(
      (screen.getByLabelText("Prix par litre (TND)") as HTMLInputElement).value,
    ).toBe("2.000");
    await user.type(screen.getByLabelText("Kilométrage (km)"), "120500");
    await user.type(screen.getByLabelText("Montant total (TND)"), "100,000");
    await user.click(screen.getByLabelText(/Plein complet/));
    // Quantité automatiquement calculée : 100 / 2 = 50.000
    expect(
      (screen.getByLabelText("Quantité (litres)") as HTMLInputElement).value,
    ).toBe("50.000");
    expect(screen.getByText("500 km")).toBeDefined();
    expect(screen.getByText("10,00 L/100 km")).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: "Enregistrer l’entrée" }),
    );
    await waitFor(async () =>
      expect((await storage.load()).entries).toHaveLength(2),
    );
    const saved = (await storage.load()).entries.find(
      (e) => e.km === 120500,
    );
    expect(saved?.quantity).toBe(50);
    expect(saved?.amount).toBe(100);
    expect(saved?.unitPrice).toBe(2);
  });

  it("ouvre les pages de détail depuis les cartes du tableau de bord et revient à l’accueil", async () => {
    const s = await init();
    s.entries = [
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        kind: "fuel",
        title: "Plein 1",
        date: "2026-04-01",
        km: 10000,
        unitPrice: 2.0,
        quantity: 50,
        amount: 100,
        full: true,
      },
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        kind: "fuel",
        title: "Plein 2",
        date: "2026-04-10",
        km: 10500,
        unitPrice: 2.0,
        quantity: 45,
        amount: 90,
        full: true,
      },
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        kind: "maintenance",
        title: "Vidange moteur",
        date: "2026-04-15",
        amount: 120,
      },
      {
        ...base(),
        vehicleId: s.vehicles[0].id,
        kind: "trip",
        title: "Tunis - Sousse",
        date: "2026-04-12",
        startKm: 10500,
        endKm: 10640,
        distance: 140,
      },
    ];
    await storage.save(s);
    render(<App />);
    const user = userEvent.setup();

    // 1. Clic sur la carte Kilométrage connu
    const kmCard = await screen.findByRole("button", {
      name: /Kilométrage connu/i,
    });
    await user.click(kmCard);
    expect(
      screen.getByRole("heading", { name: /Historique du kilométrage/i }),
    ).toBeDefined();
    // Revenir au tableau de bord
    await user.click(
      screen.getByRole("button", { name: /Retour au tableau de bord/i }),
    );
    expect(
      screen.getByRole("button", { name: /Kilométrage connu/i }),
    ).toBeDefined();

    // 2. Clic sur la carte Dépenses du mois
    const expensesCard = screen.getByRole("button", {
      name: /Dépenses du mois/i,
    });
    await user.click(expensesCard);
    expect(
      screen.getByRole("heading", { name: /Dépenses du véhicule/i }),
    ).toBeDefined();
    // Vérifier présence du sélecteur de période
    expect(screen.getByRole("tab", { name: "Mois" })).toBeDefined();
    await user.click(screen.getByRole("tab", { name: "Année" }));
    await user.click(
      screen.getByRole("button", { name: /Retour au tableau de bord/i }),
    );

    // 3. Clic sur la carte Consommation calculée
    const fuelCard = screen.getByRole("button", {
      name: /Consommation calculée/i,
    });
    await user.click(fuelCard);
    expect(
      screen.getByRole("heading", { name: /Consommation et carburant/i }),
    ).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: /Retour au tableau de bord/i }),
    );

    // 4. Clic sur la carte Distance des trajets
    const tripsCard = screen.getByRole("button", {
      name: /Distance des trajets/i,
    });
    await user.click(tripsCard);
    expect(
      screen.getByRole("heading", { name: /Trajets du véhicule/i }),
    ).toBeDefined();
    await user.click(
      screen.getByRole("button", { name: /Retour au tableau de bord/i }),
    );
    expect(
      screen.getByRole("button", { name: /Distance des trajets/i }),
    ).toBeDefined();
  });

  it("affiche la page publique et la démonstration en mode non-connecté et protège les actions démo", async () => {
    render(<App initialUser={null} />);
    const user = userEvent.setup();

    // Vérifier les éléments de la page publique
    expect(
      await screen.findByRole("heading", {
        name: /Gérez vos véhicules, trajets & consommations/i,
      }),
    ).toBeDefined();
    expect(screen.getByText(/Section Démonstration/i)).toBeDefined();
    expect(screen.getAllByText(/Données fictives/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Véhicule de démonstration/i).length,
    ).toBeGreaterThan(0);

    // Tester la protection des actions démo (message clair sans enregistrement)
    const demoActionBtn = screen.getByRole("button", {
      name: /\+ Nouveau véhicule/i,
    });
    await user.click(demoActionBtn);
    expect(
      screen.getByText(
        /Ceci est une démonstration avec des données fictives. Créez un compte pour ajouter un véhicule./i,
      ),
    ).toBeDefined();
  });

  it("valide les formulaires d'inscription (mots de passe différents, longueur minimale)", async () => {
    render(<App initialUser={null} />);
    const user = userEvent.setup();

    const createBtn = await screen.findByRole("button", {
      name: "Créer un compte",
    });
    await user.click(createBtn);

    expect(
      screen.getByRole("heading", { name: /Créer un compte/i }),
    ).toBeDefined();

    await user.type(screen.getByLabelText(/Nom complet/i), "Karim Test");
    await user.type(screen.getByLabelText(/Adresse e-mail/i), "karim@test.com");
    await user.type(screen.getByLabelText(/^Mot de passe/i), "123456");
    await user.type(
      screen.getByLabelText(/Confirmation du mot de passe/i),
      "different",
    );

    const form = screen.getByRole("heading", { name: /Créer un compte/i }).closest("dialog")!;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    await user.click(submitBtn);

    expect(
      screen.getByText(/Les mots de passe ne correspondent pas./i),
    ).toBeDefined();
  });

  it("isole totalement les données entre deux comptes utilisateurs (User 1 et User 2)", async () => {
    // User 1 possède une voiture
    const s1 = emptyState();
    s1.userId = "user-1";
    s1.vehicles = [
      {
        ...base(),
        userId: "user-1",
        name: "Voiture Secrète User 1",
        brand: "Mercedes",
        model: "Classe C",
        readingDate: "2026-01-01",
        energy: "Essence",
        initialKm: 50000,
      },
    ];
    s1.settings.selectedVehicle = s1.vehicles[0].id;
    await storage.save(s1, "user-1");

    // User 2 est un nouveau compte sans données
    const s2 = emptyState();
    s2.userId = "user-2";
    await storage.save(s2, "user-2");

    // Rendu en tant que User 2
    render(
      <App
        initialUser={
          {
            uid: "user-2",
            email: "user2@test.com",
            displayName: "Utilisateur Deux",
          } as any
        }
      />,
    );

    // User 2 ne doit JAMAIS voir la voiture de User 1
    expect(
      screen.queryByText(/Voiture Secrète User 1/i),
    ).toBeNull();
    // User 2 voit le message d'espace vierge
    expect(
      await screen.findByText(/Commencez par ajouter votre véhicule./i),
    ).toBeDefined();
  });

  it("affiche les options d'exportation JSON et CSV dans le menu Paramètres", async () => {
    await init();
    render(<App />);
    const user = userEvent.setup();

    // Attendre que l'application soit chargée (bouton Mon compte ou tableau de bord)
    await screen.findByText(/Chaque kilomètre compte/i);

    // Ouvrir les paramètres depuis la barre latérale
    const settingsBtns = screen.getAllByRole("button", { name: /Paramètres/i });
    await user.click(settingsBtns[0]);

    // Vérifier la présence de la section Sauvegarde locale & Export
    expect(await screen.findByText(/Sauvegarde locale & Export/i)).toBeDefined();

    // Vérifier les deux boutons d'exportation
    const jsonBtn = screen.getByRole("button", {
      name: /Exporter en JSON/i,
    });
    const csvBtn = screen.getByRole("button", {
      name: /Exporter en CSV/i,
    });

    expect(jsonBtn).toBeDefined();
    expect(csvBtn).toBeDefined();

    // Espionner l'URL et le téléchargement
    let clickedDownload = "";
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        el.click = vi.fn(() => {
          clickedDownload = (el as HTMLAnchorElement).download;
        });
      }
      return el;
    });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test-export");
    globalThis.URL.revokeObjectURL = vi.fn();

    // Clic sur l'export JSON
    await user.click(jsonBtn);
    expect(clickedDownload).toMatch(/carnet-auto-sauvegarde-.*\.json/);

    // Clic sur l'export CSV
    await user.click(csvBtn);
    expect(clickedDownload).toMatch(/carnet-auto-export-.*\.csv/);

    vi.restoreAllMocks();
  });

  it("permet l'inscription et la connexion autonome locale sans blocage par clé API", async () => {
    // Inscription autonome
    const { user: regUser } = registerLocalAccount(
      "Sami Auto",
      "sami@auto.com",
      "motdepasse123",
    );
    expect(regUser.displayName).toBe("Sami Auto");
    expect(regUser.email).toBe("sami@auto.com");

    // Connexion autonome avec mot de passe
    const { user: loggedUser } = loginLocalAccount(
      "sami@auto.com",
      "motdepasse123",
    );
    expect(loggedUser.uid).toBe(regUser.uid);

    // Initialisation du carnet vide pour ce nouvel utilisateur
    await storage.save(emptyState(), loggedUser.uid);

    // Rendu de l'application connectée avec ce compte autonome
    render(
      <App
        initialUser={
          {
            uid: loggedUser.uid,
            email: loggedUser.email,
            displayName: loggedUser.displayName,
          } as any
        }
      />,
    );

    // L'utilisateur est connecté et voit son espace personnel privé vierge
    expect(
      await screen.findByText(/Commencez par ajouter votre véhicule./i),
    ).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Mon compte/i }).length).toBeGreaterThan(0);
  });
});




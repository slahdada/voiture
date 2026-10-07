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
});

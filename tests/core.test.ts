import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  currentKm,
  consumption,
  total,
  tripDistance,
  status,
  kmWarnings,
} from "../src/calculations";
import { emptyState, base, type Entry, type Vehicle } from "../src/types";
import { validateEntry, validateState } from "../src/validation";
import { storage } from "../src/storage";
import { mapCsv, mergeStates, readBackup } from "../src/io";
import JSZip from "jszip";
const vehicle: Vehicle = {
  ...base(),
  name: "Test",
  energy: "Diesel",
  initialKm: 1000,
  readingDate: "2026-01-01",
};
const entry = (patch: Partial<Entry>): Entry => ({
  ...base(),
  vehicleId: vehicle.id,
  kind: "expense",
  date: "2026-01-01",
  title: "Test",
  ...patch,
});
describe("Calculs métier", () => {
  it("fusionne les intervalles kilométriques qui se chevauchent", () => {
    expect(
      tripDistance([
        entry({ kind: "trip", startKm: 100, endKm: 200 }),
        entry({ kind: "trip", startKm: 150, endKm: 250 }),
        entry({ kind: "trip", startKm: 300, endKm: 350 }),
      ]),
    ).toBe(200);
  });
  it("ignore les trajets incomplets et distingue zéro de vide", () => {
    expect(
      tripDistance([
        entry({ kind: "trip", startKm: 0, endKm: 20 }),
        entry({ kind: "trip", startKm: 20 }),
      ]),
    ).toBe(20);
  });
  it("refuse un compteur d’arrivée inférieur au départ", () => {
    expect(() =>
      validateEntry(entry({ kind: "trip", startKm: 30, endKm: 20 })),
    ).toThrow("arrivée");
  });
  it("calcule entre deux pleins complets avec pleins partiels et dates désordonnées", () => {
    const e = [
      entry({
        kind: "fuel",
        date: "2026-01-20",
        km: 2000,
        quantity: 40,
        full: true,
      }),
      entry({
        kind: "fuel",
        date: "2026-01-10",
        km: 1500,
        quantity: 20,
        full: false,
      }),
      entry({
        kind: "fuel",
        date: "2026-01-01",
        km: 1000,
        quantity: 45,
        full: true,
      }),
    ];
    expect(consumption(e)[0].value).toBe(6);
    expect(consumption(e)[0].litres).toBe(60);
  });
  it("ne calcule pas avec des volumes manquants ni un seul plein", () => {
    expect(
      consumption([
        entry({ kind: "fuel", km: 1000, full: true, quantity: 50 }),
      ]),
    ).toEqual([]);
    expect(
      consumption([
        entry({ kind: "fuel", date: "2026-01-01", km: 1000, full: true }),
        entry({ kind: "fuel", date: "2026-01-05" }),
        entry({
          kind: "fuel",
          date: "2026-01-10",
          km: 1500,
          quantity: 30,
          full: true,
        }),
      ]),
    ).toEqual([]);
  });
  it("additionne les millièmes TND sans double comptage des catégories", () => {
    expect(
      total(
        [
          entry({ kind: "fuel", amount: 0.1 }),
          entry({ kind: "maintenance", amount: 0.2 }),
          entry({ amount: 0.001 }),
        ],
        "TND",
      ),
    ).toBe(0.301);
  });
  it("retient le dernier relevé par date, pas le plus grand", () => {
    const e = [
      entry({ date: "2026-02-01", km: 1500 }),
      entry({ date: "2026-01-20", km: 2000 }),
    ];
    expect(currentKm(vehicle, e)).toBe(1500);
    expect(kmWarnings(vehicle, e)).toBe(true);
  });
  it("recalcule après suppression et modification", () => {
    const e = entry({ date: "2026-02-01", km: 2500, amount: 35 });
    expect(currentKm(vehicle, [e])).toBe(2500);
    expect(currentKm(vehicle, [])).toBe(1000);
    expect(total([{ ...e, amount: 12 }], "TND")).toBe(12);
  });
  it("évalue les seuils de date et de kilométrage", () => {
    const s = emptyState().settings;
    expect(status({ date: "2026-01-01" }, 1000, s, "2026-01-02")).toBe(
      "Dépassée",
    );
    expect(status({ km: 1800 }, 1000, s, "2026-01-02")).toBe("Bientôt");
    expect(status({ km: 1800 }, undefined, s, "2026-01-02")).toBe("À venir");
  });
});
describe("Persistance et restauration", () => {
  beforeEach(async () => {
    await storage.replace(emptyState(), [], false);
  });
  it("persiste, modifie et supprime après une nouvelle lecture", async () => {
    const s = emptyState();
    s.vehicles = [vehicle];
    const e = entry({ amount: 0 });
    s.entries = [e];
    await storage.save(s);
    expect((await storage.load()).entries[0].amount).toBe(0);
    s.entries[0].title = "Modifié";
    await storage.save(s);
    expect((await storage.load()).entries[0].title).toBe("Modifié");
    s.entries = [];
    await storage.save(s);
    expect((await storage.load()).entries).toEqual([]);
  });
  it("restaure atomiquement les pièces jointes et les données", async () => {
    const s = emptyState();
    s.vehicles = [vehicle];
    const a = {
      ...base(),
      name: "facture.pdf",
      type: "application/pdf",
      blob: new Blob(["%PDF-test"], { type: "application/pdf" }),
    };
    s.entries = [entry({ attachmentId: a.id })];
    await storage.replace(s, [a], false);
    expect((await storage.attachment(a.id))?.blob.size).toBe(9);
    expect((await storage.load()).entries[0].attachmentId).toBe(a.id);
    await storage.removeAttachment(a.id);
    expect(await storage.attachment(a.id)).toBeUndefined();
  });
  it("vérifie une archive ZIP avec pièce jointe et refuse un fichier manquant", async () => {
    const s = emptyState();
    s.vehicles = [vehicle];
    const a = { ...base(), name: "facture.pdf", type: "application/pdf" };
    s.entries = [entry({ attachmentId: a.id })];
    const zip = new JSZip();
    zip.file("carnet-auto.json", JSON.stringify(s));
    zip.file("pieces-jointes.json", JSON.stringify([a]));
    zip.file(`pieces/${a.id}`, "%PDF-test");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = bytes as unknown as File;
    Object.defineProperty(file, "size", { value: bytes.length });
    const restored = await readBackup(file);
    expect(restored.state.entries).toHaveLength(1);
    expect(restored.attachments[0].blob.size).toBe(9);
    zip.remove(`pieces/${a.id}`);
    const broken = await zip.generateAsync({ type: "uint8array" });
    Object.defineProperty(broken, "size", { value: broken.length });
    await expect(readBackup(broken as unknown as File)).rejects.toThrow(
      "manque",
    );
  });
  it("préserve la version la plus récente lors de la fusion", () => {
    const s = emptyState();
    s.vehicles = [vehicle];
    const a = entry({ updatedAt: "2026-02-01T00:00:00Z", title: "Récent" });
    s.entries = [a];
    const incoming = {
      ...s,
      entries: [{ ...a, title: "Ancien", updatedAt: "2026-01-01T00:00:00Z" }],
    };
    expect(mergeStates(s, incoming).entries[0].title).toBe("Récent");
  });
  it("refuse une sauvegarde invalide et les références orphelines", () => {
    expect(() => validateState({ version: 99 })).toThrow();
    const s = emptyState();
    s.entries = [entry({})];
    expect(() => validateState(s)).toThrow("sans véhicule");
  });
});
describe("CSV", () => {
  const mapping = {
    type: "type",
    date: "date",
    libelle: "libelle",
    montant: "montant",
  };
  it("valide les lignes et bloque les erreurs de date et de montant", () => {
    const r = mapCsv(
      {
        headers: [],
        errors: [],
        rows: [
          {
            type: "expense",
            date: "2026-01-10",
            libelle: "Parking",
            montant: "1,500",
          },
          {
            type: "expense",
            date: "2026-02-30",
            libelle: "Erreur",
            montant: "5",
          },
          {
            type: "expense",
            date: "2026-01-10",
            libelle: "Erreur",
            montant: "x",
          },
        ],
      },
      mapping,
      vehicle.id,
      [],
    );
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].amount).toBe(1.5);
    expect(r.errors).toHaveLength(2);
  });
  it("ignore les doublons du fichier et du carnet", () => {
    const rows = Array(2).fill({
      type: "expense",
      date: "2026-01-10",
      libelle: "Parking",
      montant: "5",
    });
    const first = mapCsv(
      { headers: [], errors: [], rows },
      mapping,
      vehicle.id,
      [],
    );
    expect(first.entries).toHaveLength(1);
    expect(first.duplicates).toBe(1);
    expect(
      mapCsv(
        { headers: [], errors: [], rows },
        mapping,
        vehicle.id,
        first.entries,
      ).duplicates,
    ).toBe(2);
  });
});

describe("Types d’entrées et validation des archives", () => {
  it.each([
    "trip",
    "fuel",
    "charge",
    "maintenance",
    "repair",
    "expense",
    "document",
    "reading",
  ] as const)("persiste, modifie et supprime %s", async (kind) => {
    const s = emptyState();
    s.vehicles = [vehicle];
    const e = entry({ kind });
    validateEntry(e);
    s.entries = [e];
    await storage.save(s);
    expect((await storage.load()).entries[0].kind).toBe(kind);
    s.entries = [{ ...e, title: "Modifié" }];
    await storage.save(s);
    expect((await storage.load()).entries[0].title).toBe("Modifié");
    s.entries = [];
    await storage.save(s);
    expect((await storage.load()).entries).toHaveLength(0);
  });
  it("refuse les contenus non textuels dans une sauvegarde", () => {
    const s = emptyState();
    s.vehicles = [vehicle];
    s.entries = [entry({ notes: { danger: true } as unknown as string })];
    expect(() => validateState(s)).toThrow("Champ texte invalide");
  });
});

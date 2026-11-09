import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  currentKm,
  consumption,
  total,
  tripDistance,
  status,
  kmWarnings,
  analyzeFuelEntries,
  fuelStats,
  lastFuelUnitPrice,
  parseDecimal,
  fmtDecimal,
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
  it("vérifie l'exemple de test de la section 6 (120 000 -> 120 500 km, 100 TND à 2 TND/L = 50 L, 500 km, 10,00 L/100 km)", () => {
    const p1 = entry({
      id: "plein-1",
      kind: "fuel",
      date: "2026-01-01",
      km: 120000,
      amount: 80,
      unitPrice: 2.0,
      quantity: 40,
      full: true,
    });
    const p2 = entry({
      id: "plein-2",
      kind: "fuel",
      date: "2026-01-10",
      km: 120500,
      amount: 100.0,
      unitPrice: 2.0,
      quantity: 100.0 / 2.0,
      full: true,
    });
    const stats = fuelStats([p1, p2], vehicle.id);
    const a1 = stats.byId.get("plein-1")!;
    const a2 = stats.byId.get("plein-2")!;
    expect(a1.consumptionStatus).toBe("insufficient_data");
    expect(a1.consumptionLabel).toBe("Données insuffisantes");
    expect(a2.entry.quantity).toBe(50);
    expect(fmtDecimal(a2.entry.quantity!, 3)).toBe("50,000");
    expect(a2.distance).toBe(500);
    expect(a2.consumption).toBe(10);
    expect(a2.consumptionLabel).toBe("10,00 L/100 km");
    expect(stats.lastConsumptionLabel).toBe("10,00 L/100 km");
    expect(stats.averageConsumptionLabel).toBe("10,00 L/100 km");
  });
  it("gère les pleins partiels (« En attente d’un plein complet »), sépare les véhicules et recalcule après ajout rétroactif ou suppression", () => {
    const v2Id = "vehicule-2";
    const f1 = entry({
      id: "f1",
      kind: "fuel",
      date: "2026-01-01",
      km: 10000,
      quantity: 40,
      amount: 80,
      unitPrice: 2,
      full: true,
    });
    const f2Partial = entry({
      id: "f2",
      kind: "fuel",
      date: "2026-01-05",
      km: 10300,
      quantity: 15,
      amount: 30,
      unitPrice: 2,
      full: false,
    });
    const otherVehicleEntry = entry({
      id: "other-v",
      vehicleId: v2Id,
      kind: "fuel",
      date: "2026-01-06",
      km: 99999,
      quantity: 60,
      amount: 120,
      unitPrice: 2,
      full: true,
    });

    const mapWaiting = analyzeFuelEntries(
      [f1, f2Partial, otherVehicleEntry],
      vehicle.id,
    );
    expect(mapWaiting.get("f2")?.distance).toBe(300);
    expect(mapWaiting.get("f2")?.consumptionStatus).toBe("waiting_full");
    expect(mapWaiting.get("f2")?.consumptionLabel).toBe(
      "En attente d’un plein complet",
    );

    const f3Full = entry({
      id: "f3",
      kind: "fuel",
      date: "2026-01-12",
      km: 10800,
      quantity: 25,
      amount: 50,
      unitPrice: 2.1,
      full: true,
    });
    const stats = fuelStats(
      [f1, f2Partial, f3Full, otherVehicleEntry],
      vehicle.id,
    );
    const a3 = stats.byId.get("f3")!;
    expect(a3.distance).toBe(500); // 10800 - 10300
    expect(a3.intervalDistance).toBe(800); // 10800 - 10000
    expect(a3.intervalLitres).toBe(40); // 15 + 25 (f1's 40L excluded)
    expect(a3.consumption).toBe(5); // (40 / 800) * 100 = 5.00 L/100km
    expect(lastFuelUnitPrice([f1, f2Partial, f3Full], vehicle.id)).toBe(2.1);

    // Ajout d'un second intervalle valide pour vérifier la moyenne pondérée
    const f4Full = entry({
      id: "f4",
      kind: "fuel",
      date: "2026-01-20",
      km: 11000, // +200 km
      quantity: 20, // 10.00 L/100km sur cet intervalle
      amount: 42,
      unitPrice: 2.1,
      full: true,
    });
    const stats2 = fuelStats([f1, f2Partial, f3Full, f4Full], vehicle.id);
    // Total litres valides = 40 + 20 = 60 L ; Total km valides = 800 + 200 = 1000 km -> Moyenne = 6,00 L/100 km (et non (5+10)/2 = 7,5)
    expect(stats2.averageConsumption).toBe(6);
    expect(stats2.averageConsumptionLabel).toBe("6,00 L/100 km");
  });
  it("signale une erreur si le kilométrage est inférieur ou égal au plein précédent et accepte virgule/point", () => {
    expect(parseDecimal("2,000")).toBe(2);
    expect(parseDecimal("100.500")).toBe(100.5);
    const f1 = entry({
      id: "f1",
      kind: "fuel",
      date: "2026-01-01",
      km: 5000,
      quantity: 40,
      full: true,
    });
    const f2Equal = entry({
      id: "f2",
      kind: "fuel",
      date: "2026-01-05",
      km: 5000,
      quantity: 30,
      full: true,
    });
    const map = analyzeFuelEntries([f1, f2Equal], vehicle.id);
    expect(map.get("f2")?.kmError).toBe(true);
    expect(map.get("f2")?.consumption).toBeUndefined();
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

describe("Sélecteur de période et calculs temporels (Africa/Tunis)", () => {
  it("calcule correctement les bornes du jour, mois, année et semaine du lundi au dimanche", async () => {
    const { computePeriod, isDateInPeriod, shiftPeriod } = await import("../src/period");

    // Jour
    const day = computePeriod("day", "2026-11-08");
    expect(day.start).toBe("2026-11-08");
    expect(day.end).toBe("2026-11-08");
    expect(isDateInPeriod("2026-11-08", day.start, day.end)).toBe(true);
    expect(isDateInPeriod("2026-11-09", day.start, day.end)).toBe(false);

    // Semaine (2026-11-08 est un dimanche -> début lundi 2026-11-02, fin dimanche 2026-11-08)
    const week = computePeriod("week", "2026-11-08");
    expect(week.start).toBe("2026-11-02");
    expect(week.end).toBe("2026-11-08");
    expect(isDateInPeriod("2026-11-08", week.start, week.end)).toBe(true); // dernier jour inclus !
    expect(isDateInPeriod("2026-11-02", week.start, week.end)).toBe(true);
    expect(isDateInPeriod("2026-11-01", week.start, week.end)).toBe(false);

    // Semaine chevauchant un changement d'année (2026-12-31 est un jeudi -> lundi 2026-12-28 au dimanche 2027-01-03)
    const newYearWeek = computePeriod("week", "2026-12-31");
    expect(newYearWeek.start).toBe("2026-12-28");
    expect(newYearWeek.end).toBe("2027-01-03");
    expect(isDateInPeriod("2026-12-31", newYearWeek.start, newYearWeek.end)).toBe(true);
    expect(isDateInPeriod("2027-01-03", newYearWeek.start, newYearWeek.end)).toBe(true);
    expect(isDateInPeriod("2027-01-04", newYearWeek.start, newYearWeek.end)).toBe(false);

    // Mois
    const month = computePeriod("month", "2026-02-15");
    expect(month.start).toBe("2026-02-01");
    expect(month.end).toBe("2026-02-28");

    // Année bissextile (2028)
    const leapMonth = computePeriod("month", "2028-02-10");
    expect(leapMonth.end).toBe("2028-02-29");

    // Déplacement de période (shiftPeriod)
    const nextMonth = shiftPeriod(month, 1);
    expect(nextMonth.start).toBe("2026-03-01");
    expect(nextMonth.end).toBe("2026-03-31");

    const prevMonth = shiftPeriod(month, -1);
    expect(prevMonth.start).toBe("2026-01-01");
    expect(prevMonth.end).toBe("2026-01-31");
  });

  it("gère les périodes personnalisées et empêche les inversions dateFin < dateDebut", async () => {
    const { computePeriod, isDateInPeriod } = await import("../src/period");
    const custom = computePeriod("custom", "2026-05-10", "2026-05-01"); // fin avant début
    expect(custom.start).toBe("2026-05-10");
    expect(custom.end).toBe("2026-05-10"); // ajusté à start

    const validCustom = computePeriod("custom", "2026-05-01", "2026-05-15");
    expect(isDateInPeriod("2026-05-15", validCustom.start, validCustom.end)).toBe(true);
    expect(isDateInPeriod("2026-05-16", validCustom.start, validCustom.end)).toBe(false);
  });
});



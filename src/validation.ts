import { labels, type State, type Entry } from "./types";
function optionalStrings(value: object, keys: string[]) {
  const obj = value as Record<string, unknown>;
  for (const key of keys)
    if (obj[key] !== undefined && typeof obj[key] !== "string")
      throw Error(`Champ texte invalide : ${key}`);
}
function timestamps(value: { createdAt: string; updatedAt: string }) {
  if (
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw Error("Dates de création ou de modification invalides.");
}
export function validateEntry(e: Entry) {
  if (!e || typeof e !== "object") throw Error("Entrée invalide.");
  optionalStrings(e, [
    "vehicleId",
    "title",
    "purpose",
    "origin",
    "destination",
    "driver",
    "category",
    "garage",
    "reference",
    "notes",
    "attachmentId",
    "expiry",
    "nextDate",
  ]);
  if (e.full !== undefined && typeof e.full !== "boolean")
    throw Error("Indicateur de plein invalide.");
  if (!e.vehicleId) throw Error("Choisissez un véhicule.");
  if (typeof e.title !== "string" || !e.title.trim())
    throw Error("Indiquez un libellé.");
  if (!validDate(e.date)) throw Error("Indiquez une date valide.");
  if (!Object.hasOwn(labels, e.kind)) throw Error("Type inconnu.");
  for (const key of [
    "km",
    "startKm",
    "endKm",
    "quantity",
    "unitPrice",
    "amount",
    "nextKm",
  ] as const) {
    const value = e[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      throw Error("Les valeurs doivent être positives ou égales à zéro.");
  }
  if (e.startKm !== undefined && e.endKm !== undefined && e.endKm < e.startKm)
    throw Error("Le compteur d’arrivée doit être supérieur ou égal au départ.");
  if (
    (e.nextDate && !validDate(e.nextDate)) ||
    (e.expiry && !validDate(e.expiry))
  )
    throw Error("Échéance invalide.");
}
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function validateState(input: unknown): asserts input is State {
  if (!input || typeof input !== "object") throw Error("Sauvegarde invalide.");
  const s = input as State;
  if (
    s.version !== 1 ||
    !Array.isArray(s.vehicles) ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.deadlines) ||
    !s.settings
  )
    throw Error("Format ou version de sauvegarde non pris en charge.");
  const ids = new Set<string>();
  const vehicles = new Set<string>();
  for (const v of s.vehicles) {
    if (!v || typeof v !== "object") throw Error("Véhicule invalide.");
    optionalStrings(v, [
      "brand",
      "model",
      "plate",
      "purchaseDate",
      "notes",
      "photoId",
    ]);
    timestamps(v);
    if (
      (v.purchaseDate && !validDate(v.purchaseDate)) ||
      (v.year !== undefined && (!Number.isInteger(v.year) || v.year < 1886))
    )
      throw Error("Date d’achat ou année invalide.");
    if (
      typeof v.id !== "string" ||
      ids.has(v.id) ||
      typeof v.name !== "string" ||
      !v.name.trim() ||
      !validDate(v.readingDate) ||
      typeof v.energy !== "string"
    )
      throw Error("Véhicule invalide ou identifiant en double.");
    if (
      v.initialKm !== undefined &&
      (!Number.isFinite(v.initialKm) || v.initialKm < 0)
    )
      throw Error("Kilométrage invalide.");
    ids.add(v.id);
    vehicles.add(v.id);
  }
  for (const e of s.entries) {
    validateEntry(e);
    timestamps(e);
    if (typeof e.id !== "string" || ids.has(e.id) || !vehicles.has(e.vehicleId))
      throw Error("Entrée invalide, en double ou sans véhicule.");
    ids.add(e.id);
  }
  for (const d of s.deadlines) {
    if (!d || typeof d !== "object") throw Error("Échéance invalide.");
    optionalStrings(d, ["notes", "date"]);
    timestamps(d);
    if (
      typeof d.id !== "string" ||
      ids.has(d.id) ||
      !vehicles.has(d.vehicleId) ||
      typeof d.title !== "string" ||
      !d.title.trim() ||
      typeof d.done !== "boolean" ||
      (!d.date && d.km === undefined) ||
      (d.date && !validDate(d.date)) ||
      (d.km !== undefined && (!Number.isFinite(d.km) || d.km < 0))
    )
      throw Error("Échéance invalide.");
    ids.add(d.id);
  }
  if (
    typeof s.settings.selectedVehicle !== "string" ||
    typeof s.settings.currency !== "string"
  )
    throw Error("Paramètres invalides.");
  try {
    new Intl.NumberFormat("fr", {
      style: "currency",
      currency: s.settings.currency,
    }).format(0);
  } catch {
    throw Error("Devise invalide.");
  }
  if (
    !Number.isFinite(s.settings.alertDays) ||
    s.settings.alertDays < 0 ||
    !Number.isFinite(s.settings.alertKm) ||
    s.settings.alertKm < 0 ||
    !Array.isArray(s.settings.categories) ||
    !s.settings.categories.every((c) => typeof c === "string")
  )
    throw Error("Paramètres invalides.");
}

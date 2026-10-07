import JSZip from "jszip";
import Papa from "papaparse";
import { decimals } from "./calculations";
import { storage } from "./storage";
import { validateState, validateEntry, validDate } from "./validation";
import {
  base,
  labels,
  type State,
  type Attachment,
  type Entry,
  type Kind,
} from "./types";
import { shareFile } from "./native";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function backup(state: State) {
  const zip = new JSZip();
  zip.file("carnet-auto.json", JSON.stringify(state, null, 2));
  const attachments = await storage.attachments();
  zip.file(
    "pieces-jointes.json",
    JSON.stringify(attachments.map(({ blob, ...a }) => a)),
  );
  for (const a of attachments) zip.file(`pieces/${a.id}`, a.blob);
  download(
    await zip.generateAsync({ type: "blob" }),
    `carnet-auto-${new Date().toISOString().slice(0, 10)}.zip`,
  );
}
export async function readBackup(file: File) {
  if (file.size > 150 * 1024 * 1024)
    throw Error("Archive trop volumineuse (150 Mo maximum).");
  const zip = await JSZip.loadAsync(file);
  const state: unknown = JSON.parse(
    (await zip.file("carnet-auto.json")?.async("string")) ?? "null",
  );
  validateState(state);
  const meta = JSON.parse(
    (await zip.file("pieces-jointes.json")?.async("string")) ?? "[]",
  );
  if (!Array.isArray(meta) || meta.length > 10000)
    throw Error("Liste des pièces jointes invalide.");
  const attachments: Attachment[] = [];
  const ids = new Set<string>();
  let size = 0;
  for (const a of meta) {
    if (
      !a ||
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      typeof a.type !== "string" ||
      !/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(a.type)
    )
      throw Error("Pièce jointe invalide.");
    const member = zip.file(`pieces/${a.id}`);
    if (!member) throw Error("Une pièce jointe manque dans la sauvegarde.");
    const bytes = await member.async("uint8array");
    size += bytes.byteLength;
    if (bytes.byteLength > 25 * 1024 * 1024 || size > 200 * 1024 * 1024)
      throw Error("Pièces jointes trop volumineuses.");
    attachments.push({
      ...a,
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: a.type }),
    });
    ids.add(a.id);
  }
  for (const id of [
    ...state.entries.map((e) => e.attachmentId),
    ...state.vehicles.map((v) => v.photoId),
  ])
    if (id && !ids.has(id))
      throw Error("Une référence de document est introuvable.");
  return { state, attachments };
}
export function mergeStates(current: State, incoming: State): State {
  const combine = <T extends { id: string; updatedAt: string }>(
    a: T[],
    b: T[],
  ) =>
    [...new Map([...a, ...b].map((e) => [e.id, e])).values()].map((e) => {
      const old = a.find((x) => x.id === e.id);
      return old && old.updatedAt > e.updatedAt ? old : e;
    });
  const s: State = {
    ...current,
    vehicles: combine(current.vehicles, incoming.vehicles),
    entries: combine(current.entries, incoming.entries),
    deadlines: combine(current.deadlines, incoming.deadlines),
  };
  validateState(s);
  return s;
}
export function exportCsv(entries: Entry[]) {
  const rows = entries.map((e) => ({
    id: e.id,
    type: e.kind,
    date: e.date,
    libelle: e.title,
    kilometrage: e.km ?? "",
    depart: e.startKm ?? "",
    arrivee: e.endKm ?? "",
    quantite: e.quantity ?? "",
    prix_unitaire: e.unitPrice ?? "",
    montant: e.amount ?? "",
    plein_complet: e.full ? "oui" : "non",
    categorie: e.category ?? "",
    garage: e.garage ?? "",
    notes: e.notes ?? "",
    origine: e.origin ?? "",
    destination: e.destination ?? "",
    conducteur: e.driver ?? "",
    motif: e.purpose ?? "",
    reference: e.reference ?? "",
    expiration: e.expiry ?? "",
    prochaine_date: e.nextDate ?? "",
    prochain_km: e.nextKm ?? "",
  }));
  download(
    new Blob(
      ["\uFEFF" + Papa.unparse(rows, { escapeFormulae: true, delimiter: ";" })],
      { type: "text/csv;charset=utf-8" },
    ),
    "carnet-auto.csv",
  );
}
export interface CsvPreview {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}
export async function parseCsv(file: File): Promise<CsvPreview> {
  if (file.size > 10 * 1024 * 1024)
    throw Error("CSV trop volumineux (10 Mo maximum).");
  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return {
    headers: parsed.meta.fields ?? [],
    rows: parsed.data,
    errors: parsed.errors.map(
      (e) => `Ligne ${(e.row ?? 0) + 2} : ${e.message}`,
    ),
  };
}
export const csvFields = [
  "type",
  "date",
  "libelle",
  "kilometrage",
  "depart",
  "arrivee",
  "quantite",
  "prix_unitaire",
  "montant",
  "plein_complet",
  "categorie",
  "garage",
  "notes",
  "origine",
  "destination",
  "conducteur",
  "motif",
  "reference",
  "expiration",
  "prochaine_date",
  "prochain_km",
  "id",
] as const;
export function mapCsv(
  preview: CsvPreview,
  mapping: Record<string, string>,
  vehicleId: string,
  existing: Entry[],
) {
  const entries: Entry[] = [];
  const errors = [...preview.errors];
  let duplicates = 0;
  const seen = new Set(
    existing.map((e) =>
      JSON.stringify([
        e.vehicleId,
        e.kind,
        e.date,
        e.title,
        e.km,
        e.startKm,
        e.endKm,
        e.amount,
        e.quantity,
      ]),
    ),
  );
  const ids = new Set(existing.map((e) => e.id));
  preview.rows.forEach((row, index) => {
    try {
      const get = (key: string) => row[mapping[key]]?.trim() ?? "";
      const num = (key: string) => {
        const value = get(key);
        if (!value) return undefined;
        const result = Number(value.replace(",", "."));
        if (!Number.isFinite(result)) throw Error(`Nombre invalide : ${key}`);
        return result;
      };
      const kind = get("type") as Kind;
      if (!Object.hasOwn(labels, kind))
        throw Error(
          "Type attendu : trip, fuel, charge, maintenance, repair, expense, document ou reading.",
        );
      if (!validDate(get("date"))) throw Error("Date attendue : AAAA-MM-JJ.");
      const e: Entry = {
        ...base(),
        vehicleId,
        kind,
        date: get("date"),
        title: get("libelle"),
        km: num("kilometrage"),
        startKm: num("depart"),
        endKm: num("arrivee"),
        quantity: num("quantite"),
        unitPrice: num("prix_unitaire"),
        amount: num("montant"),
        full: ["oui", "true", "1"].includes(get("plein_complet").toLowerCase()),
        category: get("categorie"),
        garage: get("garage"),
        notes: get("notes"),
        origin: get("origine"),
        destination: get("destination"),
        driver: get("conducteur"),
        purpose: get("motif"),
        reference: get("reference"),
        expiry: get("expiration") || undefined,
        nextDate: get("prochaine_date") || undefined,
        nextKm: num("prochain_km"),
      };
      validateEntry(e);
      const signature = JSON.stringify([
        e.vehicleId,
        e.kind,
        e.date,
        e.title,
        e.km,
        e.startKm,
        e.endKm,
        e.amount,
        e.quantity,
      ]);
      if (seen.has(signature) || (get("id") && ids.has(get("id")))) {
        duplicates++;
        return;
      }
      seen.add(signature);
      entries.push(e);
    } catch (error) {
      errors.push(`Ligne ${index + 2} : ${(error as Error).message}`);
    }
  });
  return { entries, errors, duplicates };
}
export async function report(
  entries: Entry[],
  vehicle: string,
  currency: string,
  share = false,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = 20;
  pdf.setFontSize(20);
  pdf.text("Carnet Auto", 15, y);
  y += 10;
  pdf.setFontSize(12);
  pdf.text(vehicle, 15, y);
  y += 8;
  pdf.setFontSize(9);
  pdf.text(
    `Export du ${new Date().toLocaleDateString("fr-FR")} | Devise : ${currency}`,
    15,
    y,
  );
  y += 12;
  for (const e of entries) {
    if (y > 265) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(`${e.date} - ${labels[e.kind]} - ${e.title}`.slice(0, 110), 15, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    const details = [
      e.km !== undefined ? `${e.km} km` : "",
      e.startKm !== undefined ? `Depart ${e.startKm} km` : "",
      e.endKm !== undefined ? `Arrivee ${e.endKm} km` : "",
      e.quantity !== undefined
        ? `${e.quantity} ${e.kind === "charge" ? "kWh" : "L"}`
        : "",
      e.amount !== undefined
        ? `${e.amount.toFixed(decimals(currency))} ${currency}`
        : "",
      e.garage ?? "",
      e.notes ?? "",
    ]
      .filter(Boolean)
      .join(" | ");
    const lines = pdf.splitTextToSize(details, 180);
    for (const line of lines) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 15, y);
      y += 5;
    }
    y += 6;
  }
  const blob = pdf.output("blob");
  if (share) await shareFile(blob, "carnet-auto.pdf");
  else download(blob, "carnet-auto.pdf");
}

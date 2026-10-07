import { useState, type FormEvent } from "react";
import { Camera, Paperclip, Save } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  base,
  today,
  labels,
  type Vehicle,
  type Entry,
  type Kind,
  type Deadline,
} from "./types";
import { Field } from "./ui";
import { storage } from "./storage";
import { cameraFile } from "./native";
import { validateEntry } from "./validation";
import { decimals } from "./calculations";
import { n, str, FilePicker } from "./FormFields";
export function EntryForm({
  entry,
  kind,
  vehicle,
  categories,
  currency,
  onSave,
  onError,
}: {
  entry?: Entry;
  kind: Kind;
  vehicle: Vehicle;
  categories: string[];
  currency: string;
  onSave: (e: Entry) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [k, setK] = useState<Kind>(entry?.kind ?? kind);
  const [file, setFile] = useState<File>();
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(entry?.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(entry?.unitPrice?.toString() ?? "");
  const [amount, setAmount] = useState(entry?.amount?.toString() ?? "");
  const [start, setStart] = useState(entry?.startKm?.toString() ?? "");
  const [end, setEnd] = useState(entry?.endKm?.toString() ?? "");
  const energy = k === "fuel" || k === "charge";
  const service = k === "maintenance" || k === "repair";
  const money = energy || service || k === "expense";
  function energyChange(field: string, value: string) {
    if (field === "quantity") {
      setQuantity(value);
      if (value && unit)
        setAmount((Number(value) * Number(unit)).toFixed(decimals(currency)));
    }
    if (field === "unit") {
      setUnit(value);
      if (value && quantity)
        setAmount(
          (Number(value) * Number(quantity)).toFixed(decimals(currency)),
        );
    }
    if (field === "amount") {
      setAmount(value);
      if (value && quantity && Number(quantity) > 0)
        setUnit((Number(value) / Number(quantity)).toFixed(3));
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(event.currentTarget);
      const e: Entry = {
        ...(entry ?? base()),
        updatedAt: new Date().toISOString(),
        vehicleId: vehicle.id,
        kind: k,
        title: str(f, "title"),
        date: str(f, "date"),
        km: n(f.get("km")),
        startKm: k === "trip" ? n(f.get("startKm")) : undefined,
        endKm: k === "trip" ? n(f.get("endKm")) : undefined,
        purpose: str(f, "purpose"),
        origin: str(f, "origin"),
        destination: str(f, "destination"),
        driver: str(f, "driver"),
        quantity: energy ? n(f.get("quantity")) : undefined,
        unitPrice: energy ? n(f.get("unitPrice")) : undefined,
        amount: money ? n(f.get("amount")) : undefined,
        full: k === "fuel" && f.get("full") === "on",
        category: str(f, "category"),
        garage: str(f, "garage"),
        reference: str(f, "reference"),
        notes: str(f, "notes"),
        attachmentId: removeFile ? undefined : entry?.attachmentId,
        expiry: str(f, "expiry") || undefined,
        nextDate: service ? str(f, "nextDate") || undefined : undefined,
        nextKm: service ? n(f.get("nextKm")) : undefined,
      };
      validateEntry(e);
      if (file) e.attachmentId = await storage.addAttachment(file);
      await onSave(e);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-intro">
        Pour {vehicle.name}. Les champs marqués * sont obligatoires.
      </p>
      <div className="form-grid">
        <Field label="Type d’entrée">
          <select value={k} onChange={(e) => setK(e.target.value as Kind)}>
            {Object.entries(labels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date *">
          <input
            type="date"
            name="date"
            required
            defaultValue={entry?.date ?? today()}
          />
        </Field>
        <Field label="Libellé *">
          <input
            name="title"
            required
            defaultValue={entry?.title}
            placeholder={
              k === "trip"
                ? "Ex. Tunis → Sousse"
                : k === "fuel"
                  ? "Ex. Plein de diesel"
                  : "Ex. Vidange moteur"
            }
            maxLength={200}
          />
        </Field>
        {k !== "trip" && (
          <Field label="Kilométrage (km)">
            <input type="number" min="0" name="km" defaultValue={entry?.km} />
          </Field>
        )}
        {k === "trip" && (
          <>
            <Field label="Compteur de départ (km)">
              <input
                name="startKm"
                type="number"
                min="0"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Compteur d’arrivée (km)">
              <input
                name="endKm"
                type="number"
                min="0"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
            <div
              className={`form-result ${start && end && Number(end) < Number(start) ? "warning" : ""}`}
            >
              {start !== "" && end !== ""
                ? Number(end) >= Number(start)
                  ? `Distance : ${Number(end) - Number(start)} km`
                  : "Le compteur d’arrivée est inférieur au départ."
                : "Trajet incomplet autorisé : distance non calculée."}
            </div>
            <Field label="Motif">
              <select
                name="purpose"
                defaultValue={entry?.purpose ?? "Personnel"}
              >
                <option>Personnel</option>
                <option>Professionnel</option>
              </select>
            </Field>
            <Field label="Origine">
              <input name="origin" defaultValue={entry?.origin} />
            </Field>
            <Field label="Destination">
              <input name="destination" defaultValue={entry?.destination} />
            </Field>
            <Field label="Conducteur">
              <input name="driver" defaultValue={entry?.driver} />
            </Field>
          </>
        )}
        {energy && (
          <>
            <Field label={`Quantité (${k === "charge" ? "kWh" : "litres"})`}>
              <input
                type="number"
                min="0"
                step="0.001"
                name="quantity"
                value={quantity}
                onChange={(e) => energyChange("quantity", e.target.value)}
              />
            </Field>
            <Field
              label={`Prix par ${k === "charge" ? "kWh" : "litre"} (${currency})`}
            >
              <input
                type="number"
                min="0"
                step="0.001"
                name="unitPrice"
                value={unit}
                onChange={(e) => energyChange("unit", e.target.value)}
              />
            </Field>
            {k === "fuel" && (
              <label className="check">
                <input
                  type="checkbox"
                  name="full"
                  defaultChecked={entry?.full}
                />
                Plein complet (réservoir rempli)
              </label>
            )}
            <Field label={k === "charge" ? "Lieu de recharge" : "Station"}>
              <input name="garage" defaultValue={entry?.garage} />
            </Field>
          </>
        )}
        {money && (
          <Field
            label={`Montant total (${currency})`}
            hint={
              energy
                ? "Calculé avec la quantité et le prix, ou saisissable directement."
                : undefined
            }
          >
            <input
              type="number"
              min="0"
              step={currency === "TND" ? "0.001" : "0.01"}
              name="amount"
              value={amount}
              onChange={(e) => energyChange("amount", e.target.value)}
            />
          </Field>
        )}
        {(service || k === "expense") && (
          <Field
            label="Catégorie"
            hint="Choisissez ou ajoutez une catégorie en la saisissant."
          >
            <input
              name="category"
              list="categories"
              defaultValue={entry?.category}
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
        )}
        {service && (
          <>
            <Field label="Garage">
              <input name="garage" defaultValue={entry?.garage} />
            </Field>
            <Field label="Prochaine échéance (date)">
              <input
                type="date"
                name="nextDate"
                defaultValue={entry?.nextDate}
              />
            </Field>
            <Field label="Prochaine échéance (km)">
              <input
                type="number"
                min="0"
                name="nextKm"
                defaultValue={entry?.nextKm}
              />
            </Field>
          </>
        )}
        {k === "document" && (
          <Field label="Date d’expiration">
            <input type="date" name="expiry" defaultValue={entry?.expiry} />
          </Field>
        )}
        <Field label="Référence du document">
          <input name="reference" defaultValue={entry?.reference} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={entry?.notes} />
        </Field>
      </div>
      <FilePicker setFile={setFile} existing={!!entry?.attachmentId} />
      {entry?.attachmentId && (
        <label className="check">
          <input
            type="checkbox"
            checked={removeFile}
            onChange={(e) => setRemoveFile(e.target.checked)}
          />
          Retirer la pièce jointe
        </label>
      )}
      <button className="primary form-submit" disabled={busy}>
        <Save size={18} />
        {busy ? "Enregistrement…" : "Enregistrer l’entrée"}
      </button>
    </form>
  );
}

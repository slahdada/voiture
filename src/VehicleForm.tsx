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
const brands = [
  "Audi",
  "BMW",
  "Citroën",
  "Dacia",
  "Fiat",
  "Ford",
  "Hyundai",
  "Kia",
  "Mercedes-Benz",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "Seat",
  "Škoda",
  "Suzuki",
  "Toyota",
  "Volkswagen",
  "Volvo",
];
const models: Record<string, string[]> = {
  Volkswagen: ["Golf", "Polo", "Passat", "Tiguan", "T-Roc"],
  Peugeot: ["208", "308", "2008", "3008", "Partner"],
  Renault: ["Clio", "Mégane", "Captur", "Kangoo"],
  Toyota: ["Yaris", "Corolla", "RAV4"],
  Hyundai: ["i10", "i20", "Tucson"],
  Kia: ["Picanto", "Rio", "Sportage"],
  Dacia: ["Sandero", "Duster", "Logan"],
  Citroën: ["C3", "C4", "Berlingo"],
  BMW: ["Série 1", "Série 3", "X1", "X3"],
  Audi: ["A1", "A3", "A4", "Q3"],
  Fiat: ["500", "Panda", "Tipo"],
};
export function VehicleForm({
  vehicle,
  vehicles,
  onSave,
  onError,
}: {
  vehicle?: Vehicle;
  vehicles: Vehicle[];
  onSave: (v: Vehicle) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const v: Vehicle = {
        ...(vehicle ?? base()),
        updatedAt: new Date().toISOString(),
        name: str(f, "name"),
        brand,
        model: str(f, "model"),
        plate: str(f, "plate"),
        year: n(f.get("year")),
        energy: str(f, "energy"),
        initialKm: n(f.get("initialKm")),
        readingDate: str(f, "readingDate"),
        purchaseDate: str(f, "purchaseDate"),
        notes: str(f, "notes"),
        photoId: vehicle?.photoId,
      };
      if (file) v.photoId = await storage.addAttachment(file);
      await onSave(v);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-intro">
        Seul le nom est obligatoire. Complétez le reste à votre rythme.
      </p>
      <div className="form-grid">
        <Field label="Nom du véhicule *">
          <input
            name="name"
            defaultValue={vehicle?.name}
            placeholder="Ex. Ma Golf"
            required
            maxLength={120}
          />
        </Field>
        <Field label="Immatriculation">
          <input
            name="plate"
            defaultValue={vehicle?.plate}
            placeholder="Ex. 123 TU 4567"
          />
        </Field>
        <Field
          label="Marque"
          hint="Choisissez ou saisissez une nouvelle marque."
        >
          <input
            list="brands"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Choisir ou écrire"
          />
          <datalist id="brands">
            {[
              ...new Set([
                ...brands,
                ...vehicles.map((v) => v.brand).filter(Boolean),
              ]),
            ].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Modèle"
          hint="Un modèle absent peut être saisi librement."
        >
          <input
            name="model"
            list="models"
            defaultValue={vehicle?.model}
            placeholder="Choisir ou écrire"
          />
          <datalist id="models">
            {[
              ...new Set([
                ...(models[brand] ?? []),
                ...vehicles
                  .filter((v) => v.brand === brand)
                  .map((v) => v.model)
                  .filter(Boolean),
              ]),
            ].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Énergie">
          <select name="energy" defaultValue={vehicle?.energy ?? "Diesel"}>
            {["Diesel", "Essence", "Hybride", "Électrique", "GPL", "Autre"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Année">
          <input
            name="year"
            type="number"
            min="1886"
            max={new Date().getFullYear() + 1}
            defaultValue={vehicle?.year}
          />
        </Field>
        <Field label="Kilométrage initial (km)">
          <input
            name="initialKm"
            type="number"
            min="0"
            step="1"
            defaultValue={vehicle?.initialKm}
          />
        </Field>
        <Field label="Date du relevé initial">
          <input
            name="readingDate"
            type="date"
            defaultValue={vehicle?.readingDate ?? today()}
            required
          />
        </Field>
        <Field label="Date d’achat">
          <input
            name="purchaseDate"
            type="date"
            defaultValue={vehicle?.purchaseDate}
          />
        </Field>
        <Field label="Notes">
          <textarea name="notes" defaultValue={vehicle?.notes} rows={2} />
        </Field>
      </div>
      <FilePicker
        label="Photo du véhicule"
        setFile={setFile}
        existing={!!vehicle?.photoId}
      />
      <button className="primary form-submit" disabled={busy}>
        <Save size={18} />
        {busy ? "Enregistrement…" : "Enregistrer le véhicule"}
      </button>
    </form>
  );
}

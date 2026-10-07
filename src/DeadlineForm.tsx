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
import { n, str } from "./FormFields";
export function DeadlineForm({
  deadline,
  onSave,
  onError,
  vehicleId,
}: {
  deadline?: Deadline;
  onSave: (d: Deadline) => Promise<void>;
  onError: (e: unknown) => void;
  vehicleId: string;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const date = str(f, "date") || undefined;
      const km = n(f.get("km"));
      if (!date && km === undefined)
        throw Error("Indiquez une date ou un kilométrage.");
      await onSave({
        ...(deadline ?? base()),
        vehicleId,
        updatedAt: new Date().toISOString(),
        title: str(f, "title"),
        date,
        km,
        done: deadline?.done ?? false,
        notes: str(f, "notes"),
      });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-intro">
        Choisissez une date, un kilométrage ou les deux.
      </p>
      <div className="form-grid">
        <Field label="Échéance *">
          <input
            name="title"
            required
            defaultValue={deadline?.title}
            placeholder="Ex. Renouveler l’assurance"
          />
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={deadline?.date} />
        </Field>
        <Field label="Kilométrage (km)">
          <input name="km" type="number" min="0" defaultValue={deadline?.km} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" defaultValue={deadline?.notes} />
        </Field>
      </div>
      <button className="primary form-submit" disabled={busy}>
        <Save size={18} />
        Enregistrer l’échéance
      </button>
    </form>
  );
}

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
import { decimals, parseDecimal } from "./calculations";
export const n = (s: FormDataEntryValue | null) =>
  s === null ? undefined : parseDecimal(s);
export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export function FilePicker({
  setFile,
  label = "Pièce jointe",
  existing = false,
}: {
  setFile: (f: File | undefined) => void;
  label?: string;
  existing?: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div className="file-picker">
      <Field
        label={label}
        hint="Image ou PDF, 25 Mo maximum. Les photos sont optimisées."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setName(e.target.files?.[0]?.name ?? "");
          }}
        />
      </Field>
      <label className="button secondary camera">
        <Camera size={17} />
        Prendre une photo
        {Capacitor.isNativePlatform() ? (
          <button
            type="button"
            className="camera-native"
            onClick={() =>
              void cameraFile()
                .then((f) => {
                  setFile(f);
                  setName(f?.name ?? "");
                })
                .catch((e) => alert(e.message))
            }
            aria-label="Ouvrir la caméra"
          />
        ) : (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              setFile(e.target.files?.[0]);
              setName(e.target.files?.[0]?.name ?? "");
            }}
          />
        )}
      </label>
      {name && <small>{name}</small>}
      {existing && (
        <small>
          Le document actuel est conservé si vous ne choisissez aucun fichier.
        </small>
      )}
    </div>
  );
}

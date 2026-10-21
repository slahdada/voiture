import { useState, useRef, type FormEvent } from "react";
import { Save } from "lucide-react";
import {
  base,
  today,
  labels,
  type Vehicle,
  type Entry,
  type Kind,
} from "./types";
import { Field } from "./ui";
import { storage } from "./storage";
import { validateEntry } from "./validation";
import {
  decimals,
  parseDecimal,
  fmtDecimal,
  fmtLitres,
  fmtAmount,
  fmtUnitPrice,
  analyzeFuelEntries,
  lastFuelUnitPrice,
} from "./calculations";
import { n, str, FilePicker } from "./FormFields";

export function EntryForm({
  entry,
  kind,
  vehicle,
  vehicles,
  entries = [],
  categories,
  currency,
  onSave,
  onError,
}: {
  entry?: Entry;
  kind: Kind;
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  entries?: Entry[];
  categories: string[];
  currency: string;
  onSave: (e: Entry) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const vehicleList = vehicles && vehicles.length > 0 ? vehicles : [vehicle];
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    entry?.vehicleId ?? vehicle.id,
  );
  const [k, setK] = useState<Kind>(entry?.kind ?? kind);
  const [date, setDate] = useState<string>(entry?.date ?? today());
  const [title, setTitle] = useState<string>(entry?.title ?? "");
  const [kmStr, setKmStr] = useState<string>(
    entry?.km !== undefined ? entry.km.toString() : "",
  );
  const [full, setFull] = useState<boolean>(entry?.full === true);
  const [file, setFile] = useState<File>();
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);

  const initialUnitPrice =
    entry?.unitPrice !== undefined
      ? entry.unitPrice.toFixed(3)
      : (entry?.kind ?? kind) === "fuel"
        ? (lastFuelUnitPrice(entries, entry?.vehicleId ?? vehicle.id)?.toFixed(
            3,
          ) ?? "")
        : "";

  const [quantity, setQuantity] = useState(
    entry?.quantity !== undefined
      ? (entry?.kind ?? kind) === "fuel"
        ? entry.quantity.toFixed(3)
        : entry.quantity.toString()
      : "",
  );
  const [unit, setUnit] = useState(initialUnitPrice);
  const [amount, setAmount] = useState(
    entry?.amount !== undefined
      ? entry.amount.toFixed(decimals(currency))
      : "",
  );
  const [start, setStart] = useState(entry?.startKm?.toString() ?? "");
  const [end, setEnd] = useState(entry?.endKm?.toString() ?? "");

  const lastEditedRef = useRef<"amount" | "quantity" | null>(null);
  const unitTouchedRef = useRef<boolean>(entry?.unitPrice !== undefined);
  const rawPrecisionRef = useRef<{
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>({
    quantity: entry?.quantity,
    unitPrice:
      entry?.unitPrice ??
      ((entry?.kind ?? kind) === "fuel"
        ? lastFuelUnitPrice(entries, entry?.vehicleId ?? vehicle.id)
        : undefined),
    amount: entry?.amount,
  });

  const energy = k === "fuel" || k === "charge";
  const service = k === "maintenance" || k === "repair";
  const money = energy || service || k === "expense";
  const priceDecimals = currency === "TND" || k === "fuel" ? 3 : decimals(currency);

  function handleKindChange(nextKind: Kind) {
    setK(nextKind);
    if (nextKind === "fuel" && !entry && !unitTouchedRef.current && !unit) {
      const lastPrice = lastFuelUnitPrice(entries, selectedVehicleId);
      if (lastPrice !== undefined) {
        setUnit(lastPrice.toFixed(3));
        rawPrecisionRef.current.unitPrice = lastPrice;
      }
    }
  }

  function handleVehicleChange(nextVehicleId: string) {
    setSelectedVehicleId(nextVehicleId);
    if (k === "fuel" && !entry && !unitTouchedRef.current) {
      const lastPrice = lastFuelUnitPrice(entries, nextVehicleId);
      if (lastPrice !== undefined) {
        setUnit(lastPrice.toFixed(3));
        rawPrecisionRef.current.unitPrice = lastPrice;
        const u = lastPrice;
        if (lastEditedRef.current === "amount") {
          const a = rawPrecisionRef.current.amount ?? parseDecimal(amount);
          if (a !== undefined && Number.isFinite(a) && a >= 0 && u > 0) {
            const rawQty = a / u;
            rawPrecisionRef.current.quantity = rawQty;
            setQuantity(rawQty.toFixed(3));
          }
        } else if (lastEditedRef.current === "quantity") {
          const q = rawPrecisionRef.current.quantity ?? parseDecimal(quantity);
          if (q !== undefined && Number.isFinite(q) && q >= 0 && u > 0) {
            const rawAmt = q * u;
            rawPrecisionRef.current.amount = rawAmt;
            setAmount(rawAmt.toFixed(priceDecimals));
          }
        }
      }
    }
  }

  function energyChange(field: "quantity" | "unit" | "amount", value: string) {
    if (field === "quantity") {
      setQuantity(value);
      lastEditedRef.current = "quantity";
      const q = parseDecimal(value);
      rawPrecisionRef.current.quantity = q;
      const u = rawPrecisionRef.current.unitPrice ?? parseDecimal(unit);
      if (
        q !== undefined &&
        Number.isFinite(q) &&
        q >= 0 &&
        u !== undefined &&
        Number.isFinite(u) &&
        u > 0
      ) {
        const rawAmt = q * u;
        rawPrecisionRef.current.amount = rawAmt;
        setAmount(rawAmt.toFixed(priceDecimals));
      } else if (value.trim() === "") {
        rawPrecisionRef.current.quantity = undefined;
      }
      return;
    }

    if (field === "amount") {
      setAmount(value);
      lastEditedRef.current = "amount";
      const a = parseDecimal(value);
      rawPrecisionRef.current.amount = a;
      const u = rawPrecisionRef.current.unitPrice ?? parseDecimal(unit);
      if (
        a !== undefined &&
        Number.isFinite(a) &&
        a >= 0 &&
        u !== undefined &&
        Number.isFinite(u) &&
        u > 0
      ) {
        const rawQty = a / u;
        rawPrecisionRef.current.quantity = rawQty;
        setQuantity(rawQty.toFixed(3));
      } else if (value.trim() === "") {
        rawPrecisionRef.current.amount = undefined;
      }
      return;
    }

    if (field === "unit") {
      setUnit(value);
      unitTouchedRef.current = true;
      const u = parseDecimal(value);
      rawPrecisionRef.current.unitPrice = u;
      if (u !== undefined && Number.isFinite(u) && u > 0) {
        const target =
          lastEditedRef.current ??
          (amount.trim() !== "" && quantity.trim() === ""
            ? "amount"
            : quantity.trim() !== ""
              ? "quantity"
              : null);

        if (target === "amount") {
          const a = rawPrecisionRef.current.amount ?? parseDecimal(amount);
          if (a !== undefined && Number.isFinite(a) && a >= 0) {
            const rawQty = a / u;
            rawPrecisionRef.current.quantity = rawQty;
            setQuantity(rawQty.toFixed(3));
          }
        } else if (target === "quantity") {
          const q = rawPrecisionRef.current.quantity ?? parseDecimal(quantity);
          if (q !== undefined && Number.isFinite(q) && q >= 0) {
            const rawAmt = q * u;
            rawPrecisionRef.current.amount = rawAmt;
            setAmount(rawAmt.toFixed(priceDecimals));
          }
        }
      } else if (value.trim() === "") {
        rawPrecisionRef.current.unitPrice = undefined;
      }
    }
  }

  // Live fuel preview calculations
  const parsedKm = parseDecimal(kmStr);
  const parsedQty =
    quantity.trim() === ""
      ? undefined
      : (rawPrecisionRef.current.quantity ?? parseDecimal(quantity));
  const parsedUnit =
    unit.trim() === ""
      ? undefined
      : (rawPrecisionRef.current.unitPrice ?? parseDecimal(unit));
  const parsedAmt =
    amount.trim() === ""
      ? undefined
      : (rawPrecisionRef.current.amount ?? parseDecimal(amount));

  const hasNegative = [parsedKm, parsedQty, parsedUnit, parsedAmt].some(
    (v) => v !== undefined && Number.isFinite(v) && v < 0,
  );
  const hasInvalidNumber = [parsedKm, parsedQty, parsedUnit, parsedAmt].some(
    (v) => v !== undefined && Number.isNaN(v),
  );
  const hasZeroUnitPrice =
    k === "fuel" &&
    unit.trim() !== "" &&
    parsedUnit !== undefined &&
    parsedUnit === 0;

  const draftId = entry?.id ?? "__draft_fuel_entry__";
  const liveFuelAnalysis = (() => {
    if (k !== "fuel") return undefined;
    const draftEntry: Entry = {
      id: draftId,
      createdAt: entry?.createdAt ?? "9999-12-31T23:59:59.999Z",
      updatedAt: new Date().toISOString(),
      vehicleId: selectedVehicleId,
      kind: "fuel",
      title: title.trim() || "Plein",
      date: date || today(),
      km:
        parsedKm !== undefined && Number.isFinite(parsedKm) && parsedKm >= 0
          ? parsedKm
          : undefined,
      quantity:
        parsedQty !== undefined && Number.isFinite(parsedQty) && parsedQty >= 0
          ? parsedQty
          : undefined,
      unitPrice:
        parsedUnit !== undefined &&
        Number.isFinite(parsedUnit) &&
        parsedUnit >= 0
          ? parsedUnit
          : undefined,
      amount:
        parsedAmt !== undefined && Number.isFinite(parsedAmt) && parsedAmt >= 0
          ? parsedAmt
          : undefined,
      full,
    };
    const otherEntries = entries.filter((x) => x.id !== draftId);
    const map = analyzeFuelEntries(
      [...otherEntries, draftEntry],
      selectedVehicleId,
    );
    return map.get(draftId);
  })();

  const selectedVehicleObj =
    vehicleList.find((v) => v.id === selectedVehicleId) ?? vehicle;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(event.currentTarget);
      if (hasInvalidNumber) {
        throw Error("Veuillez saisir des valeurs numériques valides.");
      }
      if (hasNegative) {
        throw Error("Les valeurs doivent être positives ou égales à zéro.");
      }
      if (hasZeroUnitPrice && (parsedAmt || parsedQty)) {
        throw Error(
          "Le prix par litre doit être supérieur à zéro pour éviter une division par zéro.",
        );
      }
      if (k === "fuel" && liveFuelAnalysis?.kmError) {
        throw Error(
          liveFuelAnalysis.kmErrorMessage ??
            "Le kilométrage actuel doit être supérieur au plein précédent.",
        );
      }

      const rawTitle = str(f, "title");
      const finalTitle =
        rawTitle || (k === "fuel" ? "Plein de carburant" : "");

      const finalQty = energy
        ? (rawPrecisionRef.current.quantity ?? n(f.get("quantity")))
        : undefined;
      const finalUnit = energy
        ? (rawPrecisionRef.current.unitPrice ?? n(f.get("unitPrice")))
        : undefined;
      const finalAmt = money
        ? (rawPrecisionRef.current.amount ?? n(f.get("amount")))
        : undefined;

      const e: Entry = {
        ...(entry ?? base()),
        updatedAt: new Date().toISOString(),
        vehicleId: selectedVehicleId,
        kind: k,
        title: finalTitle,
        date: str(f, "date") || date,
        km: k !== "trip" ? n(f.get("km")) : undefined,
        startKm: k === "trip" ? n(f.get("startKm")) : undefined,
        endKm: k === "trip" ? n(f.get("endKm")) : undefined,
        purpose: str(f, "purpose"),
        origin: str(f, "origin"),
        destination: str(f, "destination"),
        driver: str(f, "driver"),
        quantity: finalQty,
        unitPrice: finalUnit,
        amount: finalAmt,
        full: k === "fuel" && full,
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

  const startNum = parseDecimal(start);
  const endNum = parseDecimal(end);

  return (
    <form onSubmit={submit}>
      <p className="form-intro">
        Pour {selectedVehicleObj.name}. Les champs marqués * sont obligatoires.
      </p>
      <div className="form-grid">
        <Field label="Type d’entrée">
          <select
            value={k}
            onChange={(e) => handleKindChange(e.target.value as Kind)}
          >
            {Object.entries(labels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Véhicule concerné">
          <select
            name="vehicleId"
            value={selectedVehicleId}
            onChange={(e) => handleVehicleChange(e.target.value)}
          >
            {vehicleList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.plate ? ` (${v.plate})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date *">
          <input
            type="date"
            name="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Libellé *">
          <input
            name="title"
            required={k !== "fuel"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              k === "trip"
                ? "Ex. Tunis → Sousse"
                : k === "fuel"
                  ? "Ex. Plein de carburant"
                  : "Ex. Vidange moteur"
            }
            maxLength={200}
          />
        </Field>
        {k !== "trip" && (
          <Field label="Kilométrage (km)">
            <input
              type="text"
              inputMode="decimal"
              name="km"
              value={kmStr}
              onChange={(e) => setKmStr(e.target.value)}
              placeholder="Ex. 120500"
            />
          </Field>
        )}
        {k === "trip" && (
          <>
            <Field label="Compteur de départ (km)">
              <input
                name="startKm"
                type="text"
                inputMode="decimal"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Compteur d’arrivée (km)">
              <input
                name="endKm"
                type="text"
                inputMode="decimal"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
            <div
              className={`form-result ${start && end && endNum !== undefined && startNum !== undefined && endNum < startNum ? "warning" : ""}`}
            >
              {start !== "" &&
              end !== "" &&
              startNum !== undefined &&
              endNum !== undefined
                ? endNum >= startNum
                  ? `Distance : ${endNum - startNum} km`
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
            <Field
              label={`Prix par ${k === "charge" ? "kWh" : "litre"} (${currency})`}
              hint={
                k === "fuel"
                  ? "Dernier prix proposé par défaut (modifiable, 3 décimales)."
                  : undefined
              }
            >
              <input
                type="text"
                inputMode="decimal"
                name="unitPrice"
                value={unit}
                onChange={(e) => energyChange("unit", e.target.value)}
                placeholder="Ex. 2,000"
              />
            </Field>
            <Field
              label={`Quantité (${k === "charge" ? "kWh" : "litres"})`}
              hint={
                k === "fuel"
                  ? "Calculée (montant ÷ prix/L) ou saisissable directement."
                  : undefined
              }
            >
              <input
                type="text"
                inputMode="decimal"
                name="quantity"
                value={quantity}
                onChange={(e) => energyChange("quantity", e.target.value)}
                placeholder="Ex. 50,000"
              />
            </Field>
          </>
        )}
        {money && (
          <Field
            label={`Montant total (${currency})`}
            hint={
              energy
                ? "Calculé (quantité × prix/L) ou saisissable directement."
                : undefined
            }
          >
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              value={amount}
              onChange={(e) => energyChange("amount", e.target.value)}
              placeholder="Ex. 100,000"
            />
          </Field>
        )}
        {k === "fuel" && (
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="check">
              <input
                type="checkbox"
                name="full"
                checked={full}
                onChange={(e) => setFull(e.target.checked)}
              />
              Plein complet (réservoir rempli)
            </label>
          </div>
        )}
        {k === "fuel" && (
          <div
            className={`form-result ${
              hasNegative ||
              hasInvalidNumber ||
              hasZeroUnitPrice ||
              liveFuelAnalysis?.kmError
                ? "warning"
                : ""
            }`}
            style={{
              display: "grid",
              gap: "6px",
            }}
          >
            {hasInvalidNumber && (
              <strong>
                Erreur : veuillez saisir un nombre valide (virgule ou point
                accepté).
              </strong>
            )}
            {hasNegative && (
              <strong>
                Erreur : les valeurs négatives sont refusées.
              </strong>
            )}
            {hasZeroUnitPrice && (
              <strong>
                Erreur : le prix par litre ne peut pas être zéro.
              </strong>
            )}
            {liveFuelAnalysis?.kmError && (
              <strong>{liveFuelAnalysis.kmErrorMessage}</strong>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "8px",
              }}
            >
              <span>
                Plein précédent :{" "}
                <strong>
                  {liveFuelAnalysis?.prevEntry?.km !== undefined
                    ? `${liveFuelAnalysis.prevEntry.km.toLocaleString("fr-FR")} km`
                    : "Aucun"}
                </strong>
              </span>
              <span>
                Distance parcourue :{" "}
                <strong>
                  {liveFuelAnalysis?.kmError
                    ? "Erreur compteur"
                    : liveFuelAnalysis?.distance !== undefined
                      ? `${liveFuelAnalysis.distance.toLocaleString("fr-FR")} km`
                      : "Données insuffisantes"}
                </strong>
              </span>
              <span>
                Quantité :{" "}
                <strong>
                  {parsedQty !== undefined &&
                  Number.isFinite(parsedQty) &&
                  parsedQty >= 0
                    ? fmtLitres(parsedQty)
                    : "—"}
                </strong>
              </span>
              <span>
                Prix/L :{" "}
                <strong>
                  {parsedUnit !== undefined &&
                  Number.isFinite(parsedUnit) &&
                  parsedUnit > 0
                    ? fmtUnitPrice(parsedUnit, currency)
                    : "—"}
                </strong>
              </span>
              <span>
                Montant :{" "}
                <strong>
                  {parsedAmt !== undefined &&
                  Number.isFinite(parsedAmt) &&
                  parsedAmt >= 0
                    ? fmtAmount(parsedAmt, currency)
                    : "—"}
                </strong>
              </span>
              <span>
                Consommation :{" "}
                <strong>
                  {liveFuelAnalysis?.consumptionLabel ??
                    "Données insuffisantes"}
                </strong>
              </span>
            </div>
          </div>
        )}
        {energy && (
          <Field label={k === "charge" ? "Lieu de recharge" : "Station"}>
            <input name="garage" defaultValue={entry?.garage} />
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
      <button
        className="primary form-submit"
        disabled={
          busy ||
          hasInvalidNumber ||
          hasNegative ||
          hasZeroUnitPrice ||
          Boolean(k === "fuel" && liveFuelAnalysis?.kmError)
        }
      >
        <Save size={18} />
        {busy ? "Enregistrement…" : "Enregistrer l’entrée"}
      </button>
    </form>
  );
}

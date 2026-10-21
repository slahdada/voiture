import type { Entry, Vehicle, Deadline, Settings } from "./types";

export const decimals = (currency: string) => {
  if (currency === "TND") return 3;
  return (
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
};

export const minor = (n: number, currency: string) =>
  Math.round(n * 10 ** decimals(currency));

export function parseDecimal(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;
  const cleaned = String(val).trim().replace(/\s+/g, "").replace(",", ".");
  if (cleaned === "") return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function fmtDecimal(value: number, fractionDigits: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function fmtAmount(value: number, currency = "TND"): string {
  const digits = currency === "TND" ? 3 : decimals(currency);
  return `${fmtDecimal(value, digits)} ${currency}`;
}

export function fmtUnitPrice(value: number, currency = "TND"): string {
  const digits = currency === "TND" ? 3 : 3;
  return `${fmtDecimal(value, digits)} ${currency}/L`;
}

export function fmtLitres(value: number): string {
  return `${fmtDecimal(value, 3)} L`;
}

export function fmtConsumption(value: number): string {
  return `${fmtDecimal(value, 2)} L/100 km`;
}

export function total(entries: Entry[], currency: string) {
  return (
    entries.reduce((sum, e) => sum + minor(e.amount ?? 0, currency), 0) /
    10 ** decimals(currency)
  );
}

export function currentKm(vehicle: Vehicle, entries: Entry[]) {
  const readings = [
    {
      date: vehicle.readingDate,
      km: vehicle.initialKm,
      createdAt: vehicle.createdAt,
    },
    ...entries.flatMap((e) =>
      e.kind === "trip"
        ? [{ date: e.date, km: e.endKm ?? e.startKm, createdAt: e.createdAt }]
        : [{ date: e.date, km: e.km, createdAt: e.createdAt }],
    ),
  ]
    .filter((r) => r.km !== undefined && Number.isFinite(r.km) && r.km! >= 0)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  return readings.at(-1)?.km;
}

export function tripDistance(entries: Entry[]) {
  const intervals = entries
    .filter(
      (e) =>
        e.kind === "trip" &&
        e.startKm !== undefined &&
        e.endKm !== undefined &&
        e.endKm >= e.startKm,
    )
    .map((e) => [e.startKm!, e.endKm!] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let sum = 0,
    end = -Infinity;
  for (const [a, b] of intervals) {
    sum += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return sum;
}

export type FuelConsumptionStatus =
  | "valid"
  | "waiting_full"
  | "insufficient_data"
  | "km_error";

export interface FuelEntryAnalysis {
  entry: Entry;
  vehicleId: string;
  prevEntry?: Entry;
  prevKm?: number;
  distance?: number;
  kmError: boolean;
  kmErrorMessage?: string;
  intervalDistance?: number;
  intervalLitres?: number;
  fromDate?: string;
  fromKm?: number;
  consumption?: number;
  consumptionStatus: FuelConsumptionStatus;
  consumptionLabel: string;
}

export interface FuelDashboardStats {
  totalAmount: number;
  totalLitres: number;
  lastConsumption?: number;
  lastConsumptionEntry?: FuelEntryAnalysis;
  lastConsumptionLabel: string;
  averageConsumption?: number;
  averageConsumptionLabel: string;
  validIntervalsCount: number;
  totalValidLitres: number;
  totalValidDistance: number;
  analyses: FuelEntryAnalysis[];
  byId: Map<string, FuelEntryAnalysis>;
}

export function sortFuelChronological(a: Entry, b: Entry): number {
  return (
    a.date.localeCompare(b.date) ||
    a.createdAt.localeCompare(b.createdAt) ||
    (a.km ?? 0) - (b.km ?? 0)
  );
}

export function analyzeFuelEntries(
  entries: Entry[],
  vehicleId?: string,
): Map<string, FuelEntryAnalysis> {
  const fuels = entries.filter(
    (e) => e.kind === "fuel" && (!vehicleId || e.vehicleId === vehicleId),
  );
  const byVehicle = new Map<string, Entry[]>();
  for (const e of fuels) {
    const list = byVehicle.get(e.vehicleId) ?? [];
    list.push(e);
    byVehicle.set(e.vehicleId, list);
  }

  const result = new Map<string, FuelEntryAnalysis>();

  for (const [vId, vehicleFuels] of byVehicle.entries()) {
    const sorted = [...vehicleFuels].sort(sortFuelChronological);
    let anchorFull: Entry | undefined;
    let accumulatedLitres = 0;
    let chainValid = true;

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const prev = i > 0 ? sorted[i - 1] : undefined;
      const isFull = e.full === true;
      const hasValidQty =
        e.quantity !== undefined &&
        Number.isFinite(e.quantity) &&
        e.quantity > 0;
      const hasValidKm =
        e.km !== undefined && Number.isFinite(e.km) && e.km >= 0;
      const prevHasValidKm =
        prev?.km !== undefined && Number.isFinite(prev.km) && prev.km >= 0;

      if (!prev) {
        if (isFull && hasValidKm) {
          anchorFull = e;
          accumulatedLitres = 0;
          chainValid = true;
        }
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: undefined,
          prevKm: undefined,
          distance: undefined,
          kmError: false,
          consumption: undefined,
          consumptionStatus: "insufficient_data",
          consumptionLabel: "Données insuffisantes",
        });
        continue;
      }

      const refPrevKm = prevHasValidKm ? prev.km! : anchorFull?.km;
      if (hasValidKm && refPrevKm !== undefined && e.km! <= refPrevKm) {
        const kmErrorMessage = `Erreur : le kilométrage (${e.km!.toLocaleString("fr-FR")} km) doit être supérieur au plein précédent (${refPrevKm.toLocaleString("fr-FR")} km).`;
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: prev,
          prevKm: refPrevKm,
          distance: undefined,
          kmError: true,
          kmErrorMessage,
          consumption: undefined,
          consumptionStatus: "km_error",
          consumptionLabel: "Erreur : kilométrage ≤ précédent",
        });
        chainValid = false;
        anchorFull = undefined;
        accumulatedLitres = 0;
        continue;
      }

      const distance =
        hasValidKm && prevHasValidKm ? e.km! - prev.km! : undefined;

      if (!anchorFull) {
        if (isFull && hasValidKm) {
          anchorFull = e;
          accumulatedLitres = 0;
          chainValid = true;
        }
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: prev,
          prevKm: prev.km,
          distance,
          kmError: false,
          consumption: undefined,
          consumptionStatus: "insufficient_data",
          consumptionLabel: "Données insuffisantes",
        });
        continue;
      }

      if (hasValidQty && distance !== undefined) {
        accumulatedLitres += e.quantity!;
      } else if (hasValidQty && prev.km === undefined) {
        accumulatedLitres += e.quantity!;
      } else {
        chainValid = false;
      }

      if (!isFull) {
        if (!hasValidQty) {
          result.set(e.id, {
            entry: e,
            vehicleId: vId,
            prevEntry: prev,
            prevKm: prev.km,
            distance,
            kmError: false,
            consumption: undefined,
            consumptionStatus: "insufficient_data",
            consumptionLabel: "Données insuffisantes",
          });
        } else {
          result.set(e.id, {
            entry: e,
            vehicleId: vId,
            prevEntry: prev,
            prevKm: prev.km,
            distance,
            kmError: false,
            consumption: undefined,
            consumptionStatus: "waiting_full",
            consumptionLabel: "En attente d’un plein complet",
          });
        }
        continue;
      }

      // Current fill-up is complete (isFull === true)
      if (!hasValidKm) {
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: prev,
          prevKm: prev.km,
          distance,
          kmError: false,
          consumption: undefined,
          consumptionStatus: "insufficient_data",
          consumptionLabel: "Données insuffisantes",
        });
        anchorFull = undefined;
        accumulatedLitres = 0;
        chainValid = true;
        continue;
      }

      const intervalDistance = e.km! - anchorFull.km!;
      if (intervalDistance <= 0) {
        const kmErrorMessage = `Erreur : le kilométrage (${e.km!.toLocaleString("fr-FR")} km) doit être supérieur au plein complet précédent (${anchorFull.km!.toLocaleString("fr-FR")} km).`;
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: prev,
          prevKm: prev.km,
          distance: undefined,
          kmError: true,
          kmErrorMessage,
          consumption: undefined,
          consumptionStatus: "km_error",
          consumptionLabel: "Erreur : kilométrage ≤ précédent",
        });
        anchorFull = e;
        accumulatedLitres = 0;
        chainValid = true;
        continue;
      }

      if (!chainValid || accumulatedLitres <= 0) {
        result.set(e.id, {
          entry: e,
          vehicleId: vId,
          prevEntry: prev,
          prevKm: prev.km,
          distance,
          kmError: false,
          consumption: undefined,
          consumptionStatus: "insufficient_data",
          consumptionLabel: "Données insuffisantes",
        });
        anchorFull = e;
        accumulatedLitres = 0;
        chainValid = true;
        continue;
      }

      const consValue = (accumulatedLitres / intervalDistance) * 100;
      result.set(e.id, {
        entry: e,
        vehicleId: vId,
        prevEntry: prev,
        prevKm: prev.km,
        distance,
        kmError: false,
        intervalDistance,
        intervalLitres: accumulatedLitres,
        fromDate: anchorFull.date,
        fromKm: anchorFull.km,
        consumption: consValue,
        consumptionStatus: "valid",
        consumptionLabel: fmtConsumption(consValue),
      });
      anchorFull = e;
      accumulatedLitres = 0;
      chainValid = true;
    }
  }

  return result;
}

export function fuelStats(
  entries: Entry[],
  vehicleId?: string,
): FuelDashboardStats {
  const fuels = entries
    .filter((e) => e.kind === "fuel" && (!vehicleId || e.vehicleId === vehicleId))
    .sort(sortFuelChronological);
  const byId = analyzeFuelEntries(entries, vehicleId);
  const analyses = fuels
    .map((e) => byId.get(e.id))
    .filter((a): a is FuelEntryAnalysis => !!a);

  const totalAmount = fuels.reduce(
    (sum, e) =>
      sum +
      (e.amount !== undefined && Number.isFinite(e.amount) && e.amount >= 0
        ? e.amount
        : 0),
    0,
  );
  const totalLitres = fuels.reduce(
    (sum, e) =>
      sum +
      (e.quantity !== undefined &&
      Number.isFinite(e.quantity) &&
      e.quantity >= 0
        ? e.quantity
        : 0),
    0,
  );

  const validAnalyses = analyses.filter(
    (a) => a.consumptionStatus === "valid" && a.consumption !== undefined,
  );
  const lastValid = validAnalyses.at(-1);
  const latestAnalysis = analyses.at(-1);

  const lastConsumption = lastValid?.consumption;
  const lastConsumptionLabel = lastValid
    ? fmtConsumption(lastValid.consumption!)
    : latestAnalysis?.consumptionStatus === "waiting_full"
      ? "En attente d’un plein complet"
      : "Données insuffisantes";

  const totalValidLitres = validAnalyses.reduce(
    (sum, a) => sum + (a.intervalLitres ?? 0),
    0,
  );
  const totalValidDistance = validAnalyses.reduce(
    (sum, a) => sum + (a.intervalDistance ?? 0),
    0,
  );
  const averageConsumption =
    totalValidDistance > 0
      ? (totalValidLitres / totalValidDistance) * 100
      : undefined;
  const averageConsumptionLabel =
    averageConsumption !== undefined
      ? fmtConsumption(averageConsumption)
      : "Données insuffisantes";

  return {
    totalAmount,
    totalLitres,
    lastConsumption,
    lastConsumptionEntry: lastValid,
    lastConsumptionLabel,
    averageConsumption,
    averageConsumptionLabel,
    validIntervalsCount: validAnalyses.length,
    totalValidLitres,
    totalValidDistance,
    analyses,
    byId,
  };
}

export function lastFuelUnitPrice(
  entries: Entry[],
  vehicleId?: string,
): number | undefined {
  const vehicleFuels = entries
    .filter(
      (e) =>
        e.kind === "fuel" &&
        (!vehicleId || e.vehicleId === vehicleId) &&
        e.unitPrice !== undefined &&
        Number.isFinite(e.unitPrice) &&
        e.unitPrice > 0,
    )
    .sort(sortFuelChronological);
  if (vehicleFuels.length > 0) return vehicleFuels.at(-1)!.unitPrice;
  const allFuels = entries
    .filter(
      (e) =>
        e.kind === "fuel" &&
        e.unitPrice !== undefined &&
        Number.isFinite(e.unitPrice) &&
        e.unitPrice > 0,
    )
    .sort(sortFuelChronological);
  return allFuels.at(-1)?.unitPrice;
}

export function consumption(entries: Entry[]) {
  const byId = analyzeFuelEntries(entries);
  const fuels = entries
    .filter((e) => e.kind === "fuel")
    .sort(sortFuelChronological);
  const result: {
    date: string;
    from: string;
    value: number;
    distance: number;
    litres: number;
  }[] = [];
  for (const e of fuels) {
    const a = byId.get(e.id);
    if (
      a &&
      a.consumptionStatus === "valid" &&
      a.consumption !== undefined &&
      a.intervalDistance !== undefined &&
      a.intervalLitres !== undefined &&
      a.fromDate !== undefined
    ) {
      result.push({
        date: e.date,
        from: a.fromDate,
        value: a.consumption,
        distance: a.intervalDistance,
        litres: a.intervalLitres,
      });
    }
  }
  return result;
}

export function status(
  d: Pick<Deadline, "date" | "km">,
  km: number | undefined,
  s: Settings,
  now: string,
) {
  const days = d.date
    ? Math.round(
        (Date.parse(d.date + "T12:00:00") - Date.parse(now + "T12:00:00")) /
          86400000,
      )
    : undefined;
  const remaining =
    d.km !== undefined && km !== undefined ? d.km - km : undefined;
  if (
    (days !== undefined && days < 0) ||
    (remaining !== undefined && remaining < 0)
  )
    return "Dépassée";
  if (
    (days !== undefined && days <= s.alertDays) ||
    (remaining !== undefined && remaining <= s.alertKm)
  )
    return "Bientôt";
  return "À venir";
}

export function kmWarnings(v: Vehicle, entries: Entry[]) {
  const sorted = entries
    .map((e) => ({
      date: e.date,
      km: e.kind === "trip" ? (e.endKm ?? e.startKm) : e.km,
    }))
    .filter((e) => e.km !== undefined)
    .concat(
      v.initialKm !== undefined
        ? [{ date: v.readingDate, km: v.initialKm }]
        : [],
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.km! - b.km!);
  return sorted.some((e, i) => i > 0 && e.km! < sorted[i - 1].km!);
}

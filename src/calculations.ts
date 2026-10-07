import type { Entry, Vehicle, Deadline, Settings } from "./types";
export const decimals = (currency: string) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits ?? 2;
export const minor = (n: number, currency: string) =>
  Math.round(n * 10 ** decimals(currency));
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
export function consumption(entries: Entry[]) {
  const fuels = entries
    .filter((e) => e.kind === "fuel")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.km ?? 0) - (b.km ?? 0));
  const result: {
    date: string;
    from: string;
    value: number;
    distance: number;
    litres: number;
  }[] = [];
  let anchor: Entry | undefined;
  let litres = 0;
  let valid = true;
  for (const e of fuels) {
    if (!anchor) {
      if (e.full && e.km !== undefined) anchor = e;
      continue;
    }
    if (e.quantity === undefined) valid = false;
    else litres += e.quantity;
    if (e.full && e.km !== undefined) {
      const distance = e.km - anchor.km!;
      if (valid && distance > 0)
        result.push({
          date: e.date,
          from: anchor.date,
          value: (litres / distance) * 100,
          distance,
          litres,
        });
      anchor = e;
      litres = 0;
      valid = true;
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

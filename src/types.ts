export type Kind =
  | "trip"
  | "fuel"
  | "charge"
  | "maintenance"
  | "repair"
  | "expense"
  | "document"
  | "reading";
export const labels: Record<Kind, string> = {
  trip: "Trajet",
  fuel: "Carburant",
  charge: "Recharge",
  maintenance: "Entretien",
  repair: "Réparation",
  expense: "Dépense",
  document: "Document",
  reading: "Relevé kilométrique",
};
export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface Vehicle extends Base {
  name: string;
  brand?: string;
  model?: string;
  plate?: string;
  year?: number;
  energy: string;
  initialKm?: number;
  readingDate: string;
  purchaseDate?: string;
  notes?: string;
  photoId?: string;
}
export interface Entry extends Base {
  vehicleId: string;
  kind: Kind;
  date: string;
  title: string;
  km?: number;
  startKm?: number;
  endKm?: number;
  purpose?: string;
  origin?: string;
  destination?: string;
  driver?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  full?: boolean;
  category?: string;
  garage?: string;
  reference?: string;
  notes?: string;
  attachmentId?: string;
  expiry?: string;
  nextDate?: string;
  nextKm?: number;
}
export interface Deadline extends Base {
  vehicleId: string;
  title: string;
  date?: string;
  km?: number;
  done: boolean;
  notes?: string;
}
export interface Attachment extends Base {
  name: string;
  type: string;
  blob: Blob;
}
export interface Settings {
  currency: string;
  alertDays: number;
  alertKm: number;
  selectedVehicle: string;
  categories: string[];
}
export interface State {
  version: 1;
  vehicles: Vehicle[];
  entries: Entry[];
  deadlines: Deadline[];
  settings: Settings;
}
export const emptyState = (): State => ({
  version: 1,
  vehicles: [],
  entries: [],
  deadlines: [],
  settings: {
    currency: "TND",
    alertDays: 30,
    alertKm: 1000,
    selectedVehicle: "",
    categories: [
      "Vidange",
      "Filtres",
      "Pneus",
      "Freins",
      "Batterie",
      "Distribution",
      "Assurance",
      "Parking",
      "Péage",
      "Autres",
    ],
  },
});
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const base = (): Base => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

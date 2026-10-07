import type { Vehicle, Entry, Deadline, Kind } from "./types";
export type Page = "home" | "journal" | "deadlines" | "documents";
export type ModalState =
  | { type: "vehicle"; vehicle?: Vehicle }
  | { type: "entry"; entry?: Entry; kind: Kind }
  | { type: "detail"; entry: Entry }
  | { type: "deadline"; deadline?: Deadline }
  | { type: "settings" }
  | { type: "vehicles" }
  | { type: "transfer" }
  | { type: "auth" }
  | null;
export interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

import { openDB } from "idb";
import { emptyState, base, type State, type Attachment } from "./types";
const db = () =>
  openDB("carnet-auto", 1, {
    upgrade(db) {
      db.createObjectStore("state");
      db.createObjectStore("attachments", { keyPath: "id" });
    },
  });
export const storage = {
  async load(): Promise<State> {
    return (await (await db()).get("state", "main")) ?? emptyState();
  },
  async save(state: State) {
    await (await db()).put("state", state, "main");
  },
  async attachment(id: string): Promise<Attachment | undefined> {
    return (await db()).get("attachments", id);
  },
  async attachments(): Promise<Attachment[]> {
    return (await db()).getAll("attachments");
  },
  async removeAttachment(id: string) {
    await (await db()).delete("attachments", id);
  },
  async addAttachment(file: File): Promise<string> {
    if (file.size > 25 * 1024 * 1024)
      throw Error("Fichier trop volumineux : maximum 25 Mo.");
    if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.type))
      throw Error("Choisissez une image JPG, PNG, WebP, GIF ou un PDF.");
    let blob: Blob = file;
    if (
      file.type.startsWith("image/") &&
      file.type !== "image/gif" &&
      typeof createImageBitmap === "function"
    ) {
      try {
        const image = await createImageBitmap(file);
        const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        const resized = await new Promise<Blob | null>((r) =>
          canvas.toBlob(r, "image/jpeg", 0.85),
        );
        if (resized && resized.size < file.size) blob = resized;
        image.close();
      } catch {
        /* Preserve original when decoding is unavailable. */
      }
    }
    const a: Attachment = { ...base(), name: file.name, type: blob.type, blob };
    await (await db()).put("attachments", a);
    return a.id;
  },
  async replace(state: State, attachments: Attachment[], merge: boolean) {
    const database = await db();
    const tx = database.transaction(["state", "attachments"], "readwrite");
    if (!merge) await tx.objectStore("attachments").clear();
    for (const a of attachments) await tx.objectStore("attachments").put(a);
    await tx.objectStore("state").put(state, "main");
    await tx.done;
  },
};

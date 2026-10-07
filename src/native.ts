import { Capacitor } from "@capacitor/core";
import type { Deadline } from "./types";
export async function cameraFile(): Promise<File | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;
  const { Camera, CameraResultType, CameraSource } =
    await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });
  if (!photo.webPath) return undefined;
  const blob = await (await fetch(photo.webPath)).blob();
  return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
}
export async function shareFile(blob: Blob, name: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(Error("Lecture du fichier impossible."));
      reader.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({
      path: name.replace(/[^\w.\-]/g, "_"),
      data,
      directory: Directory.Cache,
    });
    await Share.share({ title: name, files: [file.uri] });
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ files: [file], title: name });
  else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
export async function scheduleNotifications(
  deadlines: Deadline[],
  days: number,
) {
  if (!Capacitor.isNativePlatform())
    throw Error(
      "Les rappels en arrière-plan sont disponibles dans la version native Android/iOS. Dans le navigateur, consultez les échéances ici.",
    );
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  if ((await LocalNotifications.requestPermissions()).display !== "granted")
    throw Error("Autorisation de notifications refusée.");
  const existing = await LocalNotifications.getPending();
  if (existing.notifications.length)
    await LocalNotifications.cancel({ notifications: existing.notifications });
  const notifications = deadlines
    .filter((d) => !d.done && d.date)
    .map((d) => ({
      id:
        Math.abs(
          [...d.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) | 0, 0),
        ) || 1,
      title: "Carnet Auto",
      body: d.title,
      schedule: {
        at: new Date(Date.parse(d.date + "T09:00:00") - days * 86400000),
      },
    }))
    .filter((n) => n.schedule.at.getTime() > Date.now());
  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
  return notifications.length;
}

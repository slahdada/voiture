import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Car, Download, Share2, FileText } from "lucide-react";
import { storage } from "./storage";
import { download } from "./io";
import { shareFile } from "./native";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    const show = (e: Event) => setLocalError((e as CustomEvent<string>).detail);
    window.addEventListener("app-error", show);
    return () => window.removeEventListener("app-error", show);
  }, []);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Fermer" className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-content">
        {localError && (
          <p role="alert" className="warning">
            {localError}
            <button
              type="button"
              onClick={() => setLocalError("")}
              aria-label="Fermer le message"
            >
              <X size={16} />
            </button>
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Empty({
  icon = <Car size={32} />,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function AttachmentImage({
  id,
  alt,
  className,
}: {
  id?: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    let url = "";
    if (id)
      void storage.attachment(id).then((a) => {
        if (a?.type.startsWith("image/") && alive) {
          url = URL.createObjectURL(a.blob);
          setUrl(url);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return url ? (
    <img className={className} src={url} alt={alt} />
  ) : (
    <Car className={className} size={66} strokeWidth={1.2} />
  );
}
export function AttachmentView({
  id,
  onError,
}: {
  id: string;
  onError: (e: unknown) => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("Document");
  const [type, setType] = useState("");
  useEffect(() => {
    let url = "";
    let active = true;
    void storage
      .attachment(id)
      .then((a) => {
        if (a && active) {
          url = URL.createObjectURL(a.blob);
          setUrl(url);
          setName(a.name);
          setType(a.type);
        }
      })
      .catch(onError);
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [id]);
  const act = async (share: boolean) => {
    try {
      const a = await storage.attachment(id);
      if (!a) throw Error("Document introuvable.");
      if (share) await shareFile(a.blob, a.name);
      else download(a.blob, a.name);
    } catch (e) {
      onError(e);
    }
  };
  return (
    <div className="attachment">
      {type.startsWith("image/") ? (
        <img src={url} alt={name} />
      ) : (
        <FileText size={32} />
      )}
      <strong>{name}</strong>
      <div className="actions">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="button secondary"
        >
          Consulter
        </a>
        <button className="secondary" onClick={() => void act(false)}>
          <Download size={16} />
          Télécharger
        </button>
        <button className="secondary" onClick={() => void act(true)}>
          <Share2 size={16} />
          Partager
        </button>
      </div>
    </div>
  );
}

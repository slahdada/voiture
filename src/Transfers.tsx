import { useState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { Modal, Field } from "./ui";
import {
  backup,
  readBackup,
  mergeStates,
  parseCsv,
  mapCsv,
  csvFields,
  type CsvPreview,
} from "./io";
import { storage } from "./storage";
import type { State, Attachment } from "./types";
export function Transfers({
  state,
  onChange,
  onClose,
  onError,
}: {
  state: State;
  onChange: (s: State) => void;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [archive, setArchive] = useState<{
    state: State;
    attachments: Attachment[];
  }>();
  const [csv, setCsv] = useState<CsvPreview>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [merge, setMerge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [vehicleId, setVehicleId] = useState(
    state.settings.selectedVehicle || state.vehicles[0]?.id || "",
  );
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const preview = csv
    ? mapCsv(csv, mapping, vehicleId, state.entries)
    : undefined;
  return (
    <Modal title="Sauvegarde et import" onClose={onClose} wide>
      <p className="info">
        <ShieldCheck size={20} />
        Vos données restent sur cet appareil. Conservez régulièrement une
        sauvegarde ailleurs.
      </p>
      <section className="settings-section">
        <h3>Sauvegarde complète</h3>
        <p>
          Véhicules, carnet, échéances, paramètres, photos et documents dans une
          archive ZIP.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await backup(state);
              setResult("Sauvegarde téléchargée.");
            })
          }
        >
          <Download size={17} />
          Télécharger ma sauvegarde
        </button>
        <Field label="Restaurer une sauvegarde ZIP">
          <input
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void run(async () => {
                  setArchive(await readBackup(f));
                  setResult("");
                });
            }}
          />
        </Field>
        {archive && (
          <div className="preview-box">
            <strong>Archive vérifiée</strong>
            <p>
              {archive.state.vehicles.length} véhicule(s) ·{" "}
              {archive.state.entries.length} entrée(s) ·{" "}
              {archive.attachments.length} pièce(s) jointe(s)
            </p>
            <Field label="Mode de restauration">
              <select
                value={merge ? "merge" : "replace"}
                onChange={(e) => setMerge(e.target.value === "merge")}
              >
                <option value="merge">Fusionner — conserver mes données</option>
                <option value="replace">Remplacer toutes mes données</option>
              </select>
            </Field>
            <p>
              En fusion, la version la plus récente de chaque entrée est
              conservée. Les documents existants restent conservés.
            </p>
            <button
              disabled={busy}
              className="primary"
              onClick={() => {
                if (
                  confirm(
                    merge
                      ? "Confirmer la fusion de la sauvegarde ?"
                      : "Toutes vos données actuelles seront remplacées. Avez-vous sauvegardé ? Confirmer le remplacement ?",
                  )
                )
                  void run(async () => {
                    const next = merge
                      ? mergeStates(state, archive.state)
                      : archive.state;
                    const attachments = merge
                      ? [
                          ...new Map(
                            [
                              ...(await storage.attachments()),
                              ...archive.attachments,
                            ].map((a) => [a.id, a]),
                          ).values(),
                        ]
                      : archive.attachments;
                    await storage.replace(next, attachments, merge);
                    onChange(next);
                    setArchive(undefined);
                    setResult("Restauration terminée.");
                  });
              }}
            >
              Confirmer la restauration
            </button>
          </div>
        )}
      </section>
      <section className="settings-section">
        <h3>Importer un carnet CSV</h3>
        <p>
          Dates : AAAA-MM-JJ. Types : trip, fuel, charge, maintenance, repair,
          expense, document, reading. Les fichiers joints s’importent avec une
          sauvegarde ZIP.
        </p>
        <Field label="Véhicule destinataire">
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {state.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fichier CSV">
          <input
            type="file"
            accept=".csv"
            disabled={busy || !vehicleId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  const p = await parseCsv(file);
                  setCsv(p);
                  setMapping(
                    Object.fromEntries(
                      csvFields.map((f) => [f, p.headers.includes(f) ? f : ""]),
                    ),
                  );
                  setResult("");
                });
            }}
          />
        </Field>
        {csv && (
          <>
            <h4>Correspondance des colonnes</h4>
            <div className="form-grid">
              {csvFields.map((f) => (
                <Field key={f} label={f}>
                  <select
                    value={mapping[f] ?? ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [f]: e.target.value })
                    }
                  >
                    <option value="">Ignorer</option>
                    {csv.headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            <div className="preview-box">
              <strong>
                {preview?.entries.length} entrée(s) valide(s) ·{" "}
                {preview?.duplicates} doublon(s) ignoré(s)
              </strong>
              {preview?.errors.length ? (
                <div className="warning">
                  {preview.errors.slice(0, 10).map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                  <p>Corrigez le fichier avant importation.</p>
                </div>
              ) : (
                <p>Aucune erreur détectée.</p>
              )}
              {preview?.entries.slice(0, 5).map((e) => (
                <p key={e.id}>
                  {e.date} · {e.title} · {e.amount ?? "—"}
                </p>
              ))}
              <button
                className="primary"
                disabled={
                  busy || !!preview?.errors.length || !preview?.entries.length
                }
                onClick={() =>
                  void run(async () => {
                    if (!preview) return;
                    const next = {
                      ...state,
                      entries: [...state.entries, ...preview.entries],
                    };
                    await storage.save(next);
                    onChange(next);
                    setResult(
                      `${preview.entries.length} entrée(s) importée(s).`,
                    );
                    setCsv(undefined);
                  })
                }
              >
                <Upload size={17} />
                Importer les entrées validées
              </button>
            </div>
          </>
        )}
      </section>
      {result && (
        <p role="status" className="success">
          {result}
        </p>
      )}
    </Modal>
  );
}

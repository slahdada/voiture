import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./style.css";
let update: (reload?: boolean) => Promise<void>;
function Root() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    update = registerSW({
      onNeedRefresh() {
        setReady(true);
      },
      onRegisterError(error) {
        console.warn("Cache hors connexion indisponible", error);
      },
    });
  }, []);
  return (
    <>
      <App />
      {ready && (
        <div className="update-banner">
          <span>
            Une mise à jour est disponible. Enregistrez votre formulaire avant
            de continuer.
          </span>
          <button onClick={() => void update(true)}>Mettre à jour</button>
          <button onClick={() => setReady(false)}>Plus tard</button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

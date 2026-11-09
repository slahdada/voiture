import { useState } from "react";
import {
  Car,
  ShieldCheck,
  Fuel,
  Route,
  Wallet,
  CalendarDays,
  Gauge,
  ArrowRight,
  UserPlus,
  LogIn,
  Info,
  CheckCircle2,
  FileText,
  Lock,
  Sparkles,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { DEMO_VEHICLE, DEMO_ENTRIES, DEMO_DEADLINES, DEMO_STATE } from "./demoData";
import { fmtDecimal, fuelStats, tripDistance } from "./calculations";
import { fmtDate, money } from "./Dashboard";

interface LandingScreenProps {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export function LandingScreen({ onOpenLogin, onOpenRegister }: LandingScreenProps) {
  const [demoTab, setDemoTab] = useState<"dashboard" | "fuel" | "expenses" | "trips">("dashboard");
  const [demoActionNotice, setDemoActionNotice] = useState<string | null>(null);

  const handleDemoAction = (actionName: string) => {
    setDemoActionNotice(
      `Ceci est une démonstration avec des données fictives. Créez un compte pour ${actionName}.`,
    );
  };

  const fStats = fuelStats(DEMO_ENTRIES, DEMO_VEHICLE.id);
  const totalKm = tripDistance(DEMO_ENTRIES);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
              <Car size={22} />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                Carnet Auto
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Sécurisé
                </span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">
                Chaque kilomètre compte · Multi-utilisateurs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border border-slate-700/80"
            >
              <LogIn size={16} />
              <span>Se connecter</span>
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 cursor-pointer active:scale-95"
            >
              <UserPlus size={16} />
              <span>Créer un compte</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-6 shadow-xs">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Espace personnel 100% privé & données strictement isolées</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight sm:leading-tight mb-6">
            Gérez vos véhicules, trajets & consommations en{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
              toute sérénité.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10">
            L’outil complet pour suivre l'historique kilométrique, calculer
            automatiquement la consommation réelle en L/100 km, maîtriser votre
            budget dépenses et ne plus jamais manquer une échéance d'entretien.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={onOpenRegister}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
            >
              <UserPlus size={18} />
              <span>Créer mon compte gratuit</span>
            </button>
            <a
              href="#demo-section"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-medium text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer"
            >
              <span>Voir la démonstration</span>
              <ArrowRight size={17} />
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              Multi-utilisateurs strict
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              Zéro mélange de données
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              Calcul automatique L/100 km
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              Export PDF d'entretien
            </span>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="py-14 bg-slate-950/60 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-2">
              FONCTIONNALITÉS ESSENTIELLES
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Conçu pour chaque détail de votre vie automobile
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Gauge size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Kilométrage & Relevés
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Suivi chronologique rigoureux des compteurs issus de vos trajets,
                pleins et contrôles techniques.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                <Fuel size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Carburant & Conso réelle
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Calcul croisé montant/litres en direct, mémoire du prix au litre
                et consommation moyenne pondérée entre pleins complets.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <Wallet size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Budget & Dépenses
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ventilation par catégorie (entretien, carburant, assurance,
                péage) sans double comptage, avec montants précis en TND.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                <CalendarDays size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Échéances & Rapport PDF
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Rappels de vidange et contrôle technique, génération d'un
                dossier récapitulatif PDF valorisant pour la revente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demonstration Section */}
      <section id="demo-section" className="py-16 bg-slate-900 flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Demo Banner Notice */}
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 text-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Info size={22} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide text-amber-300 uppercase">
                      Section Démonstration
                    </span>
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                      Données fictives
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-200/90 mt-1">
                    Ceci est une prévisualisation basée exclusivement sur des
                    exemples fictifs. Aucune donnée réelle n'est modifiée ou
                    enregistrée. Créez un compte pour commencer votre carnet
                    personnel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-md"
              >
                <UserPlus size={15} />
                <span>Créer mon compte</span>
              </button>
            </div>
          </div>

          {demoActionNotice && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <span>{demoActionNotice}</span>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold text-xs shrink-0 hover:bg-red-400"
              >
                Créer un compte
              </button>
            </div>
          )}

          {/* Interactive Demo Container */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Demo Bar */}
            <div className="bg-slate-900/90 px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-xs font-mono text-slate-400 ml-2">
                  Aperçu Démonstration · {DEMO_VEHICLE.name} ({DEMO_VEHICLE.plate})
                </span>
              </div>

              {/* Demo Tabs */}
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDemoTab("dashboard")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    demoTab === "dashboard"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Tableau de bord
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("fuel")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    demoTab === "fuel"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Carburant
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("expenses")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    demoTab === "expenses"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Dépenses
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("trips")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    demoTab === "trips"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Trajets
                </button>
              </div>
            </div>

            {/* Demo Body */}
            <div className="p-6">
              {demoTab === "dashboard" && (
                <div className="space-y-6">
                  {/* Vehicle summary header */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                        Exemple de véhicule (Fictif)
                      </span>
                      <h4 className="text-xl font-bold text-white mt-2">
                        {DEMO_VEHICLE.name} · {DEMO_VEHICLE.brand} {DEMO_VEHICLE.model}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Immatriculation : {DEMO_VEHICLE.plate} · Énergie : {DEMO_VEHICLE.energy} · Année {DEMO_VEHICLE.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDemoAction("générer le rapport PDF d'entretien")}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer"
                      >
                        <FileText size={15} className="text-emerald-400" />
                        <span>Dossier PDF (Démo)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDemoAction("ajouter un véhicule")}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 cursor-pointer"
                      >
                        + Nouveau véhicule
                      </button>
                    </div>
                  </div>

                  {/* 4 Demo Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => handleDemoAction("consulter l'historique kilométrique")}
                      className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Kilométrage connu</span>
                        <Gauge size={16} className="text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        44 625 <span className="text-xs text-slate-400 font-normal">km</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Données fictives · Dernier relevé
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoAction("consulter le détail des dépenses")}
                      className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Dépenses du mois</span>
                        <Wallet size={16} className="text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        320,000 <span className="text-xs text-slate-400 font-normal">TND</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Exemple de dépense (Assurance)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoAction("analyser la consommation")}
                      className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Consommation calculée</span>
                        <Fuel size={16} className="text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        4,10 <span className="text-xs text-slate-400 font-normal">L/100 km</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Exemple de consommation réelle
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoAction("consulter les trajets")}
                      className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left hover:border-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Distance des trajets</span>
                        <Route size={16} className="text-teal-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {totalKm} <span className="text-xs text-slate-400 font-normal">km</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Trajets complets fusionnés
                      </p>
                    </button>
                  </div>

                  {/* Demo recent entries */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-sm text-white">
                        Événements récents (Exemples fictifs)
                      </h4>
                      <span className="text-xs text-slate-500">
                        {DEMO_ENTRIES.length} entrées de démonstration
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800/80">
                      {DEMO_ENTRIES.slice(-4).reverse().map((e) => (
                        <div
                          key={e.id}
                          className="py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                              {e.date}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-200">
                                {e.title}
                              </div>
                              <div className="text-slate-500 text-[11px]">
                                {e.notes || "Données fictives d'exemple"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {e.amount !== undefined && (
                              <span className="font-mono font-semibold text-emerald-400">
                                {e.amount.toFixed(3)} TND
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDemoAction("modifier cette entrée")}
                              className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 cursor-pointer"
                            >
                              Détails
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {demoTab === "fuel" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Suivi du Carburant & Calculs L/100 km (Démo)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Dernière consommation : 4,10 L/100 km · Moyenne pondérée : {fStats.averageConsumptionLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDemoAction("enregistrer un nouveau plein")}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      + Ajouter un plein (Démo)
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Compteur (km)</th>
                          <th className="p-3">Quantité (L)</th>
                          <th className="p-3">Prix/L (TND)</th>
                          <th className="p-3">Total (TND)</th>
                          <th className="p-3">Plein complet</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {DEMO_ENTRIES.filter((e) => e.kind === "fuel").map((e) => (
                          <tr key={e.id} className="hover:bg-slate-900/50">
                            <td className="p-3 font-mono">{e.date}</td>
                            <td className="p-3 font-semibold">{e.km?.toLocaleString("fr-FR")} km</td>
                            <td className="p-3 font-mono">{e.quantity?.toFixed(3)} L</td>
                            <td className="p-3 font-mono">{e.unitPrice?.toFixed(3)}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">
                              {e.amount?.toFixed(3)} TND
                            </td>
                            <td className="p-3">
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                                Oui
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDemoAction("modifier un plein")}
                                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                              >
                                Modifier
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {demoTab === "expenses" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Budget & Dépenses Démonstration
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ventilation : Entretien (145 TND), Assurance (320 TND), Carburant (284,28 TND)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDemoAction("enregistrer une dépense")}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 text-white font-bold text-xs cursor-pointer"
                    >
                      + Ajouter une dépense (Démo)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Entretien & Garage</div>
                      <div className="text-xl font-bold text-white mt-1">145,000 TND</div>
                      <div className="text-[11px] text-slate-500">Vidange synthétique</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Assurance & Papiers</div>
                      <div className="text-xl font-bold text-white mt-1">320,000 TND</div>
                      <div className="text-[11px] text-slate-500">Police semestrielle</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-xs text-slate-400">Total carburant acheté</div>
                      <div className="text-xl font-bold text-white mt-1">284,280 TND</div>
                      <div className="text-[11px] text-slate-500">3 pleins de démonstration</div>
                    </div>
                  </div>
                </div>
              )}

              {demoTab === "trips" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Trajets récents (Démo)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Distance cumulée : {totalKm} km · Calcul automatique et fusion
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDemoAction("enregistrer un trajet")}
                      className="px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      + Ajouter un trajet (Démo)
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                    {DEMO_ENTRIES.filter((e) => e.kind === "trip").map((t) => (
                      <div key={t.id} className="p-4 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-200">{t.title}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            {t.origin || "Départ"} → {t.destination || "Arrivée"} · Compteur {t.startKm} km à {t.endKm} km
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-400 font-mono">
                            {t.endKm && t.startKm ? t.endKm - t.startKm : t.km || 0} km
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDemoAction("modifier ce trajet")}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            Modifier
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Demo Footer Action */}
            <div className="p-4 bg-slate-900/60 border-t border-slate-800 text-center flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock size={14} className="text-emerald-400" />
                Mode démonstration non synchronisé · Vos données réelles restent totalement privées
              </span>
              <button
                type="button"
                onClick={onOpenRegister}
                className="font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
              >
                <span>Créer mon compte pour enregistrer mes données</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Car size={16} className="text-emerald-500" />
            <span className="font-semibold text-slate-300">Carnet Auto</span>
            <span>— La route, l’esprit tranquille.</span>
          </div>
          <div>
            Application multi-utilisateurs sécurisée · Données privées et isolées par compte
          </div>
        </div>
      </footer>
    </div>
  );
}

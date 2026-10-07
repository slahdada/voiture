# Carnet Auto

Application personnelle de carnet de bord automobile en français. React, TypeScript strict, Vite, Tailwind CSS, IndexedDB et PWA. Interface vert profond et ivoire ; navigation mobile Accueil / Carnet / Échéances. Aucune donnée de démonstration n'est chargée.

## Démarrage

Prérequis : Node.js 22 LTS et npm.

```sh
npm ci
npm run dev
```

Ouvrir l'adresse affichée par Vite. En environnement local ordinaire : http://localhost:4173. Pour ouvrir depuis un téléphone sur le même réseau, utiliser l'adresse réseau affichée par Vite ; l'installation PWA et certaines fonctions du navigateur nécessitent HTTPS (ou localhost sur le même appareil).

```sh
npm test
npm run build
npm run preview
```

`dist/` contient l'application Web compilée. Déployer tout son contenu sur un hébergement HTTPS. Ne pas ouvrir index.html directement par double-clic : il faut un serveur HTTP.

## Première utilisation

1. Cliquer sur « Ajouter mon véhicule ». Seul son nom est obligatoire ; la date du relevé initial est préremplie.
2. Saisir librement une marque ou un modèle absent des suggestions. Ces valeurs sont conservées et réapparaissent dans les suggestions des prochains véhicules.
3. Ajouter un trajet, un plein, une recharge, un entretien, une réparation, une dépense, un document ou un relevé de kilométrage.
4. Dans Carnet, chercher dans les libellés, notes, garages, catégories, origines, destinations et références. Filtrer la période et le type ; trier par date, montant ou libellé. Cliquer sur une entrée pour consulter, modifier, partager ou supprimer.
5. Documents est accessible par le menu latéral sur PC et par Paramètres sur téléphone. Une pièce jointe peut être consultée, téléchargée, partagée, remplacée ou retirée dans la modification de son entrée.
6. Ajouter les échéances connues : aucune périodicité d'entretien n'est inventée. Les prochaines échéances d'un entretien et les expirations de documents apparaissent automatiquement.
7. Paramètres → Sauvegarder, restaurer ou importer. Conserver régulièrement l'archive ZIP sur un autre support.

La navigation mobile comporte trois onglets. Le choix de véhicule et les paramètres se trouvent dans l'en-tête. Le mode Liste reste une liste compacte sur mobile ; le mode Grille affiche des cartes séparées. Le zoom n'est pas bloqué. Le plein écran est proposé lorsque le navigateur le prend en charge.

## Données, documents et sauvegardes

Les données et les fichiers sont enregistrés dans IndexedDB, sur le navigateur et l'appareil utilisés. Il n'y a aucun compte applicatif, serveur de données, suivi GPS ou synchronisation automatique. L'accès à l'hébergement privé peut lui-même nécessiter une connexion à ChatGPT ; cette restriction est distincte du fonctionnement local du carnet. Le code fourni peut être hébergé ailleurs ou embarqué dans Capacitor.

Effacer les données du navigateur, désinstaller l'application ou perdre l'appareil peut effacer ce carnet. Le bouton de conservation du stockage demande `navigator.storage.persist()` ; le navigateur peut refuser. Il faut garder des sauvegardes.

- Pièces jointes : JPG, PNG, WebP, GIF ou PDF, maximum 25 Mo par fichier. Images réduites à 1 800 pixels et compressées si cela réduit leur poids ; conservation de l'original si l'optimisation est indisponible.
- ZIP versionné : `carnet-auto.json`, `pieces-jointes.json`, fichiers `pieces/<id>`.
- Restauration : vérification de la version, des identifiants, valeurs, relations et pièces jointes ; aperçu des quantités ; fusion ou remplacement après confirmation. Écriture des données et documents dans une seule transaction IndexedDB.
- Fusion : identifiants identiques fusionnés, entrée la plus récemment modifiée conservée ; identifiants différents conservés. Les paramètres de l'appareil courant sont conservés en mode fusion.
- Un changement du relevé initial conserve l'ancien relevé dans le carnet. Les modifications/suppressions recalculent les indicateurs.
- Limites de restauration : ZIP de 150 Mo maximum, pièces décompressées de 200 Mo au total. Ne pas importer d'archives d'origine inconnue.
- Le stockage est encapsulé dans `src/storage.ts` pour permettre une adaptation native ultérieure ; Capacitor utilise actuellement IndexedDB dans sa WebView.

## Calculs

- Kilométrage connu : dernier relevé chronologique fourni par la fiche véhicule ou une entrée, et non maximum absolu. Les relevés incohérents sont signalés et conservés.
- Distance : union des intervalles départ/arrivée des trajets complets du véhicule. Les chevauchements ne sont pas comptés deux fois. Une arrivée inférieure au départ est refusée ; un trajet incomplet reste enregistrable.
- Consommation : entre deux pleins complets avec relevés suffisants ; somme des litres achetés après le premier plein jusqu'au second, pleins partiels inclus, divisée par les kilomètres parcourus, multipliée par 100. Le volume du premier plein est exclu. Un volume manquant invalide le calcul de l'intervalle. La période et les volumes sont indiqués.
- Recharge électrique : énergie achetée en kWh et coût ; aucune consommation réelle n'est déduite de relevés insuffisants.
- Dépenses : sommes des montants des entrées, sans créer une dépense supplémentaire pour les pleins ou entretiens. Les totaux utilisent des entiers en unités monétaires minimales ; trois décimales pour TND. Une valeur vide reste absente, zéro reste zéro.
- Changement de devise : ne convertit pas les anciennes sommes ; confirmation lorsque des montants existent.
- Seuils d'échéance : jours et kilomètres configurables. Une échéance est dépassée dès qu'un seuil saisi est dépassé, bientôt lorsque l'un des seuils d'alerte est atteint. Un kilométrage inconnu ne déclenche pas d'alerte kilométrique.
- Les graphiques du budget couvrent les six derniers mois et la répartition de l'année civile. La consommation affiche au plus six intervalles récents ; le kilométrage et les distances portent sur tout l'historique connu.

## Import et export

Export CSV du carnet filtré, séparateur `;`, UTF-8 avec BOM, protection contre les formules de tableur. Import CSV avec détection du séparateur, aperçu de cinq lignes, correspondance des colonnes, numéros de lignes en erreur et suppression des doublons. L'import est bloqué tant qu'une erreur subsiste. Le véhicule destinataire est choisi explicitement ; pièces jointes à importer par ZIP.

Champs CSV : `id`, `type`, `date`, `libelle`, `kilometrage`, `depart`, `arrivee`, `quantite`, `prix_unitaire`, `montant`, `plein_complet`, `categorie`, `garage`, `notes`, `origine`, `destination`, `conducteur`, `motif`, `reference`, `expiration`, `prochaine_date`, `prochain_km`.

Types : `trip`, `fuel`, `charge`, `maintenance`, `repair`, `expense`, `document`, `reading`. Dates au format AAAA-MM-JJ. `plein_complet` : oui/non. Décimales avec point ou virgule. Une ligne doit au minimum contenir type, date et libellé. Détection des doublons sur identifiant existant ou signature véhicule/type/date/libellé/compteurs/montant/quantité ; des lignes réellement identiques peuvent donc être regroupées.

L'export PDF fournit un rapport textuel des entrées filtrées. Les pièces jointes restent des fichiers séparés dans la sauvegarde. Les polices PDF intégrées conviennent au texte latin français ; pour des alphabets non latins, privilégier l'impression du navigateur. « Partager » utilise le partage de fichiers du navigateur s'il existe, sinon télécharge le rapport. L'impression utilise la boîte de dialogue du navigateur.

## Installation PWA et hors connexion

Android/PC : ouvrir le site HTTPS, puis Paramètres → Installer Carnet Auto lorsque le navigateur propose l'installation, ou son menu → Installer l'application.

iPhone/iPad : ouvrir dans Safari, Partager → Sur l'écran d'accueil. Le bouton d'installation automatique peut être absent, ce qui est normal.

Après le premier chargement réussi et le cache complet, les écrans et exports sont mis en cache et les données/documents restent accessibles via IndexedDB hors connexion. Vérifier une fois cette disponibilité sur chaque appareil avant de dépendre du mode hors connexion. Une mise à jour est proposée sans rechargement forcé ; enregistrer le formulaire avant de l'appliquer. La version Web n'annonce pas de notifications fiables en arrière-plan.

## Android avec Capacitor

La configuration native et les adaptateurs caméra, partage de fichiers, sauvegarde temporaire et notifications locales sont inclus. Les projets Android/iOS sont générés sur votre machine avec les commandes ci-dessous. Aucun APK ni IPA n'est livré dans cette archive.

Prérequis Android : Node.js 22, Android Studio, SDK Android correspondant à Capacitor 7, JDK 21, appareil Android ou émulateur. L'installation du SDK/JDK n'a pas été effectuée dans cet environnement.

```sh
npm ci
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Dans Android Studio, attendre la synchronisation Gradle, puis utiliser Build → Build APK(s) pour une version de test ou Generate Signed App Bundle / APK pour une version signée. Le chemin standard de l'APK de test est `android/app/build/outputs/apk/debug/app-debug.apk`.

Pour l'icône native, `resources/icon.png` contient le dessin automobile et `resources/splash.png` son fond. Installer le générateur officiel Capacitor Assets sur la machine de build si souhaité :

```sh
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --android
npx cap sync android
```

Caméra : demandée au moment de la capture par le plugin. Sélection de fichiers : sélecteur système de la WebView. Partage : plugin Share, avec fichier temporaire via Filesystem. Notifications : dans Paramètres, « Actualiser les notifications locales » demande l'autorisation puis reprogramme les rappels datés. Réactualiser après modification d'une échéance. Les échéances kilométriques restent des alertes dans l'application. Une date d'alerte déjà passée n'est pas reprogrammée. Les rappels ne sont pas des alarmes exactes.

Tester capture, sélection, export, partage, stockage après redémarrage et autorisations sur la version compilée. Préserver l'identifiant `tn.carnetauto.app` pour les mises à jour natives.

## iOS avec Capacitor

Prérequis : Mac, Xcode compatible avec Capacitor 7, outils iOS, compte Apple pour distribution et signature.

```sh
npm ci
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Renseigner dans Info.plist les descriptions d'utilisation caméra et photothèque (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) et vérifier la configuration de partage/permissions. Dans Xcode, sélectionner l'équipe de signature et l'appareil cible. Ajouter les icônes aux Assets ou générer avec `npx capacitor-assets generate --ios`. Tester les flux natifs sur iPhone/iPad ; ils n'ont pas été exécutés ici.

## Architecture

- `src/types.ts`, `src/validation.ts` : modèle, identifiants, valeurs absentes et validation.
- `src/calculations.ts` : calculs métier centralisés.
- `src/storage.ts` : accès IndexedDB et restauration transactionnelle.
- `src/io.ts` : archives, PDF et CSV.
- `src/native.ts` : adaptateurs Capacitor et partage Web.
- `src/App.tsx` : orchestration et état.
- `src/Dashboard.tsx`, `JournalScreen.tsx`, `DeadlinesScreen.tsx` : vues principales.
- `src/AppDialogs.tsx`, formulaires séparés, `ui.tsx`, `Transfers.tsx` : saisies et écrans secondaires.
- `src/main.tsx`, `vite.config.ts`, `public/` : PWA, icônes et ressources.
- `tests/` : tests de calculs, persistance, archive, CSV et parcours DOM.

Deux outils WebMCP optionnels sont détectés si le navigateur les expose : lecture du carnet et ouverture d'un formulaire. Ils ne créent pas de données sans validation utilisateur. Leur validation dans un navigateur WebMCP réel n'a pas été possible ici.

## Vérifications et limites

Voir `TESTS.md` pour les résultats réellement exécutés. Les tests DOM ne remplacent pas un test sur appareils physiques. La visualisation dans un vrai navigateur de cet environnement n'était pas disponible ; les tailles d'écran, l'installation PWA, l'hors connexion effectif, la caméra et les permissions restent à vérifier sur Android, iPhone, iPad, Surface Pro et PC.

Fonctions avancées hors périmètre de cette version : compte, synchronisation multi-appareil, partage collaboratif d'un véhicule et OCR. Le partage proposé est celui d'un fichier ou rapport.

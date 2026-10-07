# Résultats de vérification — Carnet Auto

## Vérifications exécutées

- 30 tests automatisés réussis, avec Vitest.
- TypeScript strict : compilation de production réussie.
- Vite : application compilée et fichiers PWA générés (manifest, icônes, service worker et précache des ressources applicatives).

### Calculs et validation

Distance de trajets avec chevauchements ; trajet incomplet ; arrivée inférieure au départ ; zéro distinct de valeur absente ; consommation entre pleins complets avec pleins partiels et dates saisies dans le désordre ; refus du calcul lorsque les volumes sont manquants ; total des dépenses précis au millième TND ; dernier relevé chronologique et signalement des incohérences ; recalcul après modification/suppression ; seuils d'échéance par date et kilométrage.

### Stockage et import

Lecture IndexedDB après sauvegarde, modification et suppression ; pièces jointes conservées ; restauration transactionnelle ; vérification réelle d'une archive ZIP contenant un PDF de test ; refus d'un fichier manquant ; fusion avec conservation de la version la plus récente ; rejet de version incorrecte, de référence orpheline et de contenu non textuel ; import CSV avec dates et nombres invalides, décimales françaises et doublons.

Ajout, modification et suppression persistants des huit types d'entrées : trajet, carburant, recharge, entretien, réparation, dépense, document, relevé.

### Parcours DOM simulés

Création de véhicule avec marque et modèle libres et champs facultatifs vides ; ajout/consultation/modification/suppression d'une dépense ; calcul du montant d'un plein ; enregistrement d'un trajet incomplet ; changement réel des structures Liste/Grille ; recherche dans les notes ; création et clôture d'une échéance.

Les tests DOM utilisent jsdom, Testing Library et une simulation IndexedDB. Les données de tests ne sont pas injectées dans l'application livrée.

## Ce qui reste à tester sur les appareils

Aucun téléphone physique, tablette, Surface Pro, navigateur graphique Windows/macOS, émulateur Android ou simulateur iOS n'a été testé. La capacité de contrôle de navigateur requise pour une inspection visuelle de cet environnement n'était pas disponible.

À vérifier sur votre matériel : rendu et absence de débordement à 360/390/768/1024/1440 px, portrait/paysage, zoom, clavier tactile, impression et PDF à l'ouverture, téléchargement et partage, installation PWA, rechargement effectif hors connexion et après fermeture, conservation des blobs de documents dans le navigateur réel, caméra et permissions, notifications natives.

La validation de WebMCP dans un navigateur compatible est indisponible ; les outils sont optionnels et ne conditionnent pas le carnet.

## Limites connues

- Application locale : pas de compte applicatif ni de synchronisation automatique.
- Pas de rappels fiables en arrière-plan dans le navigateur ; affichage des échéances dans l'application.
- Android/iOS : configuration et adaptateurs fournis, projets à générer avec Capacitor sur une machine possédant les prérequis. Aucun APK/IPA généré ou testé ici.
- Export PDF textuel ; pièces jointes conservées séparément dans les sauvegardes. Police PDF intégrée pour alphabet latin ; utiliser l'impression du navigateur pour les autres écritures.
- Notifications natives : actualisation manuelle dans Paramètres après changement des échéances. Les alertes dont la date est passée restent visibles dans le carnet mais ne sont pas replanifiées.
- Les sauvegardes peuvent être volumineuses. Limites ZIP : 150 Mo compressés, 200 Mo de pièces jointes décompressées.
- Mise à jour sans migration destructive : la base actuelle est versionnée 1. Toute évolution du schéma nécessitera une migration dédiée.

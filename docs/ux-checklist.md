# UX checklist — Blind Box Closet

Parcours à valider avant chaque TestFlight.

## Premier lancement
- [ ] Choix de la langue (FR / EN / ES) puis tout l'écran suivant est dans cette langue
- [ ] Onboarding : uniquement le choix des marques/séries, un seul bouton, puis directement l'interface
- [ ] Marques « coming soon » non sélectionnables

## Accueil
- [ ] Cartes pastel Smiski / Sonny Angel / Labubu + coming soon, favoris en premier
- [ ] Compteurs Main uniquement
- [ ] Engrenage → Réglages

## Checklist d'une marque
- [ ] Toggle Main / Extras
- [ ] Chaque série affiche son icône officielle (Smiski) ou la première figurine (autres marques)
- [ ] Accordéon + progression, tap = coché / décoché
- [ ] Feuille d'édition (possédé / wishlist / échange) traduite
- [ ] Recherche filtre les figurines
- [ ] Image manquante : « ? » Smiski uniquement pour une figurine Smiski sans image ; tuile neutre pour les autres marques
- [ ] Libellés de catégorie de série traduits (FR / EN / ES)

## Réglages
- [ ] Langue modifiable, refaire le choix des marques
- [ ] Export / import de la collection (fichier JSON)
- [ ] Entrée Admin visible uniquement pour Dorian

## Admin (Dorian uniquement)
- [ ] Renommer une série / une figurine
- [ ] Changer l'image d'une figurine ou d'une série parmi les images du serveur
- [ ] Créer une série et y ajouter des figurines

## Données (vérifié par `node scripts/audit_media.mjs` + audit de l'API)
- [ ] Aucune image manquante, minuscule ou partagée entre figurines différentes
- [ ] Aucun « ? » Smiski sur Sonny Angel / Labubu
- [ ] Les images viennent du même bloc que le nom de la figurine (aucune assignation par ordre)

## Performance / stabilité
- [ ] Ouverture d'une marque sans lag (un seul appel `checklist`)
- [ ] Sonny Angel (133 séries) fluide : séries repliées par défaut sauf la première

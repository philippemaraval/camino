# Camino — jeu des rues de Marseille

Jeu web (HTML/CSS/JS) : trouver une rue/monument sur une carte de Marseille.

## Modes (type de partie)
- Classique : 20 items
- Marathon : 3 erreurs max
- Chrono : 1 minute
- Lecture : apprentissage

## Zones
- Rues principales (facile)
- Par quartier (faisable)
- Ville entière (difficile)
- Monuments (faisable)
- (à ajouter) Rues célèbres (très facile)

## Scoring (session)
Bonne réponse : jusqu’à 10 points selon la rapidité (–1 par seconde). Au-delà de 10s : 0 point. Mauvaise réponse : 0.

## Roadmap technique (PR atomiques)
1) Refactor JS en modules sans changer le gameplay.
2) Ajouter la zone “Rues célèbres”.
3) Auth (email+mdp) + pseudo unique via service géré.
4) Best score par (zone, mode) + leaderboard public.
5) Anti-triche : score autoritaire côté serveur (functions).
6) Daily : 1 rue/jour (Ville entière), 5 essais, distance en cas d’échec, leaderboard daily.

## Contraintes
- Mobile-first (responsive primordial)
- Données personnelles minimales : email + pseudo
- Pas de jeu Daily en invité

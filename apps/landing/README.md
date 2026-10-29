# Passaparola — site vitrine

Site d'une page, en italien et en anglais, pour la phase pilote de Passaparola à Milan : des créateurs de contenu locaux viennent manger dans des restaurants de quartier et publient une vidéo.

Site statique sans build ni dépendance, dans `apps/landing/` : ouvrir `index.html` dans un navigateur, ou servir le dossier (depuis la racine du dépôt : `npm run dev:landing`) :

```sh
python3 -m http.server 8000
```

## Fichiers

- `index.html` — la page (accroche, fonctionnement restaurants / créateurs, phase pilote, formulaires, pied de page)
- `privacy.html` — informativa privacy RGPD
- `en/index.html`, `en/privacy.html` — version anglaise (bouton IT / EN en haut de chaque page)
- `styles.css` — styles, mobile d'abord
- `script.js` — validation et envoi des formulaires
- `assets/favicon.svg`

## À compléter avant la mise en ligne

1. **Adresse e-mail** : `ciao@passaparola.it` est provisoire. La remplacer dans les quatre pages HTML et dans `script.js` (`CONTACT_EMAIL`).
2. **Réception des formulaires** : sans backend, l'envoi ouvre l'application e-mail du visiteur avec un message prérempli. Pour recevoir les candidatures directement, créer un formulaire sur un service type [Formspree](https://formspree.io) et coller son URL dans `FORM_ENDPOINT` (`script.js`).
3. **Politique de confidentialité** : renseigner le nom du référent (`[Nome e cognome del referente]` en italien, `[Full name of the contact person]` en anglais) et vérifier les durées de conservation et les prestataires utilisés.

## Modifier les textes

Chaque langue a sa propre page : une modification de texte doit être faite dans `index.html` **et** dans `en/index.html` (idem pour la politique de confidentialité). Les messages des formulaires sont dans `script.js` (`MESSAGES`).

## Photos

Photos de plats hébergées sur Unsplash (licence Unsplash, usage libre). Si une image ne charge pas, un fond terracotta/crème prend sa place.

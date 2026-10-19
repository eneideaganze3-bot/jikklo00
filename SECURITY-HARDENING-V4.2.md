# JIKKLO V4.2 — Security hardening applied

Cette version est une consolidation de V4.1 avant déploiement. Elle ne change pas le modèle métier.

## Corrections appliquées

1. **XSS côté catalogue public**
   - Noms, descriptions, SKU, unités, identifiants et autres valeurs dynamiques injectées dans HTML sont échappés.
   - Les URL d’images provenant du catalogue sont acceptées uniquement en `http:`/`https:` avant insertion dans `src`.
   - Les valeurs de panier et de checkout sont également échappées avant rendu HTML.

2. **Paiements API non intégrés**
   - Un moyen `kind=api` ne peut pas être activé tant que sa configuration ne contient pas explicitement `integrationReady: true`.
   - Le catalogue public filtre aussi les anciens enregistrements `api` activés par erreur.
   - Une commande refuse également un moyen API non prêt.
   - Les secrets ne sont toujours pas stockés dans D1 : les secrets de provider restent des secrets Cloudflare Worker.

3. **Validation serveur des commandes**
   - Adresse, commentaire et référence de paiement ont des longueurs maximales.
   - `deliveryMode` est vérifié à runtime.
   - Une adresse est obligatoire lorsque `deliveryMode=delivery`.

4. **Robustesse configuration paiement**
   - Une configuration JSON mal formée n’est plus silencieusement acceptée.
   - La lecture d’une configuration corrompue ne fait plus tomber l’endpoint Admin.
   - L’interface Admin affiche maintenant l’erreur lorsqu’une activation est refusée par le serveur.

## Important pour la production

`integrationReady: true` ne doit être utilisé que lorsqu’une véritable intégration de paiement de production est effectivement déployée et testée. Ce flag n’installe pas une API à lui seul.

Les moyens de paiement initiaux sont créés désactivés. Les moyens manuels peuvent être activés après configuration de leurs instructions. Les moyens API restent désactivés tant qu’une intégration réelle n’est pas opérationnelle.

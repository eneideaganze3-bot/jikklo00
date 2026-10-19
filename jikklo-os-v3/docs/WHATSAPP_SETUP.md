# WHATSAPP_SETUP.md — Configuration de l'intégration WhatsApp

## État actuel

L'intégration WhatsApp est **entièrement codée et prête**, mais **désactivée
tant que tu n'as pas fourni tes identifiants Meta**. Sans configuration, le
système :
- génère quand même le message de commande complet (voir `api/src/lib/whatsapp.ts`, fonction `buildOrderWhatsAppMessage`) ;
- répond honnêtement `whatsappConfigured: false` à l'API ;
- affiche côté client un bouton de secours (lien `wa.me` standard) plutôt que de simuler un envoi automatique.

Aucune fausse valeur n'a été mise dans le code (règle #2 V3).

## Ce que tu dois fournir

Trois valeurs, obtenues depuis [Meta for Developers](https://developers.facebook.com/apps) → ton app → produit "WhatsApp" :

| Variable | Où la trouver |
|---|---|
| `WHATSAPP_API_TOKEN` | Meta for Developers → ton app → WhatsApp → API Setup → "Temporary access token" (ou un token permanent via un compte System User pour la production) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta for Developers → ton app → WhatsApp → API Setup → "Phone number ID" |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta Business Manager → paramètres de l'entreprise → comptes WhatsApp |

## Comment les configurer

**En local** (`api/.dev.vars`, jamais committé) :
```
WHATSAPP_API_TOKEN=colle_ton_token_ici
WHATSAPP_PHONE_NUMBER_ID=colle_ton_id_ici
```

**En production** (jamais dans un fichier) :
```bash
cd api
npx wrangler secret put WHATSAPP_API_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
```

**Numéro business affiché aux clients** (paramètre non-secret, configurable
depuis JIKKLO OS → Paramètres, ou directement en base) :
```sql
UPDATE settings SET value = '243900000000' WHERE key = 'business_whatsapp_number';
UPDATE settings SET value = 'true' WHERE key = 'whatsapp_enabled';
```
(Format international sans le `+`, sans espaces.)

## Vérifier que ça fonctionne

Une fois les secrets posés et l'API redéployée :
1. Passe une commande de test sur jikklo.com.
2. La réponse de `/api/orders/public/create` doit contenir `"whatsappConfigured": true`.
3. Si `whatsappSent` est `false` alors que `whatsappConfigured` est `true`,
   regarde les logs Cloudflare (`wrangler tail`) — l'erreur vient probablement
   d'un token expiré (les tokens temporaires Meta expirent en 24h, il faut un
   token permanent pour la production) ou d'un numéro business non vérifié.

## Ce qui n'est PAS géré actuellement

- Réception de messages entrants (webhooks WhatsApp) — non implémentée, cette
  intégration est **sortante uniquement** (JIKKLO → client).
- Templates de message pré-approuvés Meta (nécessaires pour envoyer un
  message à un client qui n'a pas initié la conversation dans les 24h) — le
  code actuel envoie un message texte libre, qui ne fonctionne que dans la
  fenêtre de conversation active de 24h ouverte par le client. Pour des
  notifications proactives (ex: "ta commande est prête") en dehors de cette
  fenêtre, il faudra créer et faire approuver un template Meta, puis adapter
  `WhatsAppCloudApiProvider.sendMessage()` dans `api/src/lib/whatsapp.ts`.

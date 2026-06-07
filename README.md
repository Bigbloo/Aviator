# ✈️ Aviator — Full-Stack Crash Game

Application complète du jeu Aviator (crash game) avec :
- **Frontend** : Next.js + TypeScript + PixiJS (canvas) + Zustand + Socket.IO client
- **Backend** : Node.js + Express + SQLite (better-sqlite3) + Socket.IO + Stripe
- **Android** : Compatible WebView (build statique exportable)

---

## 📁 Structure du projet

```
aviator/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── index.js          # Serveur principal + Socket.IO game loop
│   │   ├── db/
│   │   │   └── database.js   # SQLite init (users, rounds, bets, transactions)
│   │   ├── controllers/
│   │   │   ├── userController.js     # Création user, balance
│   │   │   ├── paymentController.js  # Stripe PaymentIntent, webhook, retrait
│   │   │   └── gameController.js     # Rounds, bets, crash point
│   │   └── routes/
│   │       ├── userRoutes.js
│   │       ├── paymentRoutes.js
│   │       └── gameRoutes.js
│   ├── .env.example
│   └── package.json
│
└── frontend/                 # Next.js app
    ├── app/
    │   ├── page.tsx          # Page principale
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── AviatorCanvas.tsx # Canvas PixiJS (courbe + avion)
    │   ├── BetPanel.tsx      # Mise + encaissement
    │   ├── Header.tsx        # Balance + boutons dépôt/retrait
    │   ├── DepositModal.tsx  # Modal dépôt (Stripe / simulé)
    │   └── WithdrawModal.tsx # Modal retrait
    ├── hooks/
    │   └── useSocket.ts      # Hook Socket.IO
    ├── lib/
    │   └── api.ts            # Client API REST
    ├── store/
    │   └── gameStore.ts      # Zustand store
    ├── .env.local.example
    └── package.json
```

---

## 🚀 Lancement en développement

### 1. Backend

```bash
cd backend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Stripe

# Lancer le serveur (port 4000)
npm run dev
# ou
npm start
```

### 2. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Configurer
cp .env.local.example .env.local
# Éditer .env.local si le backend n'est pas sur localhost:4000

# Lancer Next.js (port 3000)
npm run dev
```

Ouvrir **http://localhost:3000**

---

## 📱 Packaging pour Android WebView

### 1. Build statique du frontend

Dans `frontend/next.config.ts`, décommenter :
```ts
output: 'export',
```

Puis builder :
```bash
cd frontend
npm run build
```

Le dossier `frontend/out/` contient le build statique.

### 2. Copier dans Android Studio

```bash
cp -r frontend/out/* android-app/app/src/main/assets/
```

### 3. Configuration WebView (MainActivity.kt)

```kotlin
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val webView = WebView(this)
        setContentView(webView)
        
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true        // Pour localStorage
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
        }
        
        webView.webViewClient = WebViewClient()
        
        // Charger depuis les assets
        webView.loadUrl("file:///android_asset/index.html")
        
        // OU pointer vers le backend déployé :
        // webView.loadUrl("https://votre-backend.com")
    }
}
```

### 4. AndroidManifest.xml — permissions réseau

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 🔌 API Backend

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/create` | Crée un nouvel utilisateur |
| `GET` | `/api/balance/:userId` | Retourne le solde |
| `POST` | `/api/create-payment-intent` | Crée un PaymentIntent Stripe |
| `POST` | `/api/webhook` | Webhook Stripe (crédit solde) |
| `POST` | `/api/deposit/simulate` | Dépôt simulé (mode test) |
| `POST` | `/api/withdraw` | Retrait (simulé en test) |
| `POST` | `/api/round/start` | Démarre une manche |
| `GET` | `/api/round/:roundId` | Info sur une manche |
| `POST` | `/api/bet` | Place une mise + encaissement |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `game:state` | Server → Client | État actuel au moment de la connexion |
| `round:start` | Server → Client | Nouvelle manche démarrée |
| `round:tick` | Server → Client | Multiplicateur courant (toutes les 100ms) |
| `round:crash` | Server → Client | Crash avec le multiplicateur final |

---

## 💳 Configuration Stripe

1. Créer un compte sur [stripe.com](https://stripe.com)
2. Récupérer les clés dans **Dashboard → Developers → API Keys**
3. Configurer le webhook :
   - URL : `https://votre-backend.com/api/webhook`
   - Event : `payment_intent.succeeded`
4. Copier le `Signing secret` dans `.env` → `STRIPE_WEBHOOK_SECRET`

---

## 🎮 Fonctionnement du jeu

1. **Waiting** (5s) : entre deux manches
2. **Flying** : l'avion décolle, le multiplicateur monte exponentiellement
3. **Crash** : le backend génère un crash point aléatoire (distribution exponentielle, house edge 5%)
4. Le joueur doit **encaisser avant le crash** pour gagner
5. Le backend vérifie que `cashoutMultiplier ≤ crashPoint` avant de créditer

---

## ⚠️ Notes importantes

- En mode test, utiliser le bouton **"Déposer (Mode Test)"** — aucun vrai paiement
- Le crash point est généré **côté serveur** et jamais envoyé au client avant le crash
- SQLite stocke toutes les données localement dans `backend/aviator.db`
- Pour la production : déployer le backend sur un VPS/Railway/Render et configurer les vraies clés Stripe

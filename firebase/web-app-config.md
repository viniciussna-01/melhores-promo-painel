# firebaseConfig do app Web (para o painel — Fase 3)

Não é secreto: são identificadores públicos do cliente. A segurança é feita
pelas regras do Firestore + Firebase Auth.

Na Fase 3 (Next.js na Vercel) isto vira variáveis de ambiente `NEXT_PUBLIC_*`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBgRvjDTiIv2J6WQDqPurReD_JVB3uPIEc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=melhores-promo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=melhores-promo
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=melhores-promo.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=119054822770
NEXT_PUBLIC_FIREBASE_APP_ID=1:119054822770:web:da08b295e94f8fc0f441eb
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-3EWWBBSPG2
```

# Sabor do Oeste Backend

API Node para:
- sincronizar snapshot do app no Firebase Firestore
- consultar IA com fallback OpenAI/Gemini
- operar em producao com CORS restrito e rate limit

## 1) Instalar

```bash
cd backend
npm install
```

## 2) Configurar ambiente

```bash
cp .env.example .env
```

Preencha no `.env`:
- `FIREBASE_SERVICE_ACCOUNT_JSON` (ou `FIREBASE_SERVICE_ACCOUNT_PATH`)
- `OPENAI_API_KEY` e/ou `GEMINI_API_KEY`
- `FRONTEND_ORIGIN` com a origem do seu frontend (ou varias, separadas por virgula)
- `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX` conforme volume esperado

## 3) Rodar

```bash
npm run dev
```

Servidor padrao: `http://localhost:8787`

## Endpoints

- `GET /health`
- `POST /api/sync/import-local`
  - body: `{ "dados": { "lotes": [], "vendas": [], "clientes": [] } }`
- `POST /api/ai/analisar`
  - body: `{ "perguntaUsuario": "...", "dados": { ... } }`

## Colecao Firestore

O snapshot e salvo em:
- `sabor_do_oeste/snapshot`

## Provedor de IA

A ordem de fallback vem de `AI_PROVIDER_PRIORITY`.
Exemplos:
- `openai,gemini`
- `gemini,openai`

## Deploy backend (Render)

1. Crie um novo Web Service apontando para a pasta `backend`.
2. Runtime: Docker (usa `backend/Dockerfile`).
3. Configure variaveis de ambiente do `.env.example`.
4. Defina `NODE_ENV=production`.
5. Defina `FRONTEND_ORIGIN=https://seu-front.vercel.app`.

## Deploy backend (Railway)

1. Crie novo projeto e selecione a pasta `backend`.
2. Build command: `npm ci`.
3. Start command: `npm run start`.
4. Configure as mesmas variaveis de ambiente.

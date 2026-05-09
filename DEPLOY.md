# Deploy Completo - Sabor do Oeste

Este projeto agora esta dividido em:
- Frontend estatico: `index.html`
- Backend Node dedicado: `backend/`

## Arquitetura recomendada

- Frontend: Vercel (ou Netlify)
- Backend: Render ou Railway
- Banco: Firebase Firestore

## 1) Publicar frontend (Vercel)

1. Suba o repositorio no GitHub.
2. Importe o repo na Vercel.
3. Root directory: `/`.
4. Framework preset: `Other`.
5. Build command: vazio.
6. Output directory: `/`.

Apos deploy, voce tera uma URL parecida com:
- `https://sabor-do-oeste.vercel.app`

## 2) Publicar backend (Render/Railway)

Use a pasta `backend` como servico Node.

Variaveis obrigatorias:
- `NODE_ENV=production`
- `PORT` (a plataforma normalmente injeta automaticamente)
- `FRONTEND_ORIGIN=https://sabor-do-oeste.vercel.app`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (ou `FIREBASE_SERVICE_ACCOUNT_PATH`)
- `OPENAI_API_KEY` e/ou `GEMINI_API_KEY`
- `AI_PROVIDER_PRIORITY=openai,gemini`

Variaveis recomendadas:
- `RATE_LIMIT_WINDOW_MS=900000`
- `RATE_LIMIT_MAX=120`

## 3) Conectar frontend ao backend

No dashboard do app, no card "IA Cloud · Operacao":
1. Preencha "API Base URL" com a URL publica do backend.
2. Clique em "Salvar URL".
3. Clique em "Sincronizar dados no Firestore".
4. Consulte o agente com perguntas operacionais.

## 4) Checklist de go-live

- [ ] CORS restrito apenas ao dominio do frontend
- [ ] Chaves de API somente no backend
- [ ] Health endpoint respondendo (`/health`)
- [ ] Sync inicial para Firestore concluida
- [ ] Consulta IA respondendo com provider esperado
- [ ] Teste manual de lote, venda e cliente apos deploy

## 5) Checklist de monitoramento semanal

- [ ] Validar erros de API no provedor de hospedagem
- [ ] Verificar consumo de tokens da IA
- [ ] Revisar estoque critico (< 10 unidades)
- [ ] Revisar sugestao de compra (30 dias)

# Runbook Final de Publicacao - Sabor do Oeste

## Objetivo
Publicar o frontend estatico e o backend Node na nuvem, conectar os dois e validar o fluxo completo (sync + IA).

## Pre-requisitos
- Conta no GitHub
- Conta na Vercel
- Conta na Render ou Railway
- Projeto Firebase com Firestore ativo
- Chaves de IA (OpenAI e/ou Gemini)

## Etapa 1 - Subir codigo no GitHub
1. Inicialize git na pasta do projeto (se ainda nao estiver inicializado).
2. Crie o repositorio remoto no GitHub.
3. Envie todos os arquivos, incluindo:
   - index.html
   - backend/
   - vercel.json
   - DEPLOY.md

## Etapa 2 - Publicar Frontend na Vercel
1. Na Vercel, clique em Add New Project.
2. Selecione o repositorio do projeto.
3. Configure:
   - Framework: Other
   - Build command: vazio
   - Output directory: /
4. Conclua o deploy.
5. Guarde a URL final do frontend (exemplo: https://seu-app.vercel.app).

## Etapa 3 - Publicar Backend (Render)
1. Na Render, crie Web Service novo apontando para o mesmo repositorio.
2. Defina Root Directory como backend.
3. Defina Build Command como npm ci.
4. Defina Start Command como npm run start.
5. Configure variaveis de ambiente:
   - NODE_ENV=production
   - FRONTEND_ORIGIN=https://seu-app.vercel.app
   - RATE_LIMIT_WINDOW_MS=900000
   - RATE_LIMIT_MAX=120
   - AI_PROVIDER_PRIORITY=openai,gemini
   - OPENAI_API_KEY=...
   - GEMINI_API_KEY=... (opcional)
   - OPENAI_MODEL=gpt-4o-mini
   - GEMINI_MODEL=gemini-1.5-flash
   - FIREBASE_PROJECT_ID=...
   - FIREBASE_SERVICE_ACCOUNT_JSON={...json da service account em linha unica...}
6. Conclua o deploy e guarde a URL final do backend.

## Etapa 4 - Validar API em producao
1. Abra no navegador:
   - URL_BACKEND/health
2. Esperado:
   - ok=true
   - service=sabor-do-oeste-backend

## Etapa 5 - Conectar frontend ao backend
1. Abra o app publicado na Vercel.
2. Entre no Dashboard.
3. No card IA Cloud · Operacao:
   - Preencha API Base URL com a URL publica do backend.
   - Clique em Salvar URL.

## Etapa 6 - Migrar dados para Firestore
1. Ainda no card IA Cloud · Operacao, clique em Sincronizar dados no Firestore.
2. Verifique mensagem de sucesso com contagem de lotes, vendas e clientes.

## Etapa 7 - Validar IA com fallback
1. Faça uma pergunta operacional no campo de pergunta.
2. Clique em Consultar IA.
3. Valide resposta com:
   - provider informado
   - blocos de diagnostico e acao

## Etapa 8 - Checklist final de go-live
- CORS restrito para dominio real do frontend
- Nenhuma chave de API no frontend
- Endpoint /health respondendo
- Sync para Firestore executado
- Consulta IA funcionando
- Fluxo manual testado: criar lote, criar venda, criar cliente

## Rollback rapido
1. Se backend falhar, volte para a versao anterior no provedor (Render/Railway).
2. Se frontend falhar, redeploy da build anterior na Vercel.
3. Em caso de erro de CORS, ajuste FRONTEND_ORIGIN e redeploy backend.

# Sabor do Oeste – Sistema de Gestão de Charcutaria 🥩

Sistema de gestão profissional para produção artesanal de linguiças e salames, com suporte a operação em nuvem, banco de dados Firebase Firestore e análises assistidas por IA (OpenAI e Gemini).

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs em tempo real: lotes ativos, unidades em estoque, vendas e lucro do mês |
| **Lotes** | Registro de lotes com cálculo automático de custo (fórmula baseada nas regras de negócio da charcutaria) |
| **Vendas** | Registro de vendas com cálculo de lucro real (inclui quebra de maturação para salames) |
| **Compras** | Histórico de compras de insumos (carne, tripas, temperos) |
| **Painel IA** | Análise de estoque, otimização de lucro e sugestão de compras via OpenAI/Gemini |
| **Alertas** | Alertas automáticos quando estoque < 10 unidades por lote |
| **Maturação** | Acompanhamento visual do progresso de maturação de salames e copas |

---

## 🏗️ Arquitetura

```
sabor-do-oeste/
├── frontend/              # App estático (HTML + CSS + JS modular)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         # Entry point principal
│       ├── firebase-config.js  # Init Firebase SDK
│       ├── firestore.js   # Data layer (Firestore + localStorage fallback)
│       ├── business.js    # Regras de negócio (custo, lucro, maturação)
│       └── ui.js          # Utilitários de UI
│
├── backend/               # API Node.js (Express)
│   ├── server.js
│   ├── routes/
│   │   ├── ai.js          # /api/ai/* – análise e chat com IA
│   │   └── stock.js       # /api/stock/* – cálculos de estoque
│   ├── services/
│   │   ├── aiProvider.js  # Facade com primary/fallback OpenAI↔Gemini
│   │   ├── openai.js      # Wrapper OpenAI
│   │   ├── gemini.js      # Wrapper Google Gemini
│   │   └── businessRules.js  # Regras de negócio (espelho do frontend)
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── tests/             # Testes (node:test + supertest)
│   └── .env.example
│
├── firebase.json          # Config Firebase Hosting + Firestore
├── firestore.rules        # Regras de segurança Firestore
├── vercel.json            # Config deploy Vercel
└── .gitignore
```

---

## 🚀 Deploy – Passo a Passo

### Opção A: Firebase Hosting (Frontend) + Render/Railway (Backend)

#### 1. Firebase – Frontend

```bash
# Instalar CLI
npm install -g firebase-tools

# Login e init
firebase login
firebase init hosting  # selecione o projeto criado no console

# Deploy
firebase deploy --only hosting
```

#### 2. Firestore – Banco de Dados

1. Acesse [Firebase Console](https://console.firebase.google.com) → seu projeto → Firestore Database
2. Crie o banco em **Native Mode**
3. Copie as configurações do app web em **Project Settings → Your apps → Web**
4. Edite `frontend/js/firebase-config.js` substituindo os valores `YOUR_*`

```bash
# Deploy das regras de segurança
firebase deploy --only firestore:rules
```

#### 3. Backend Node.js (Render, Railway, Fly.io ou VPS)

```bash
cd backend
cp .env.example .env
# Edite .env com suas chaves reais

npm install
npm start
```

Variáveis de ambiente obrigatórias em produção:
- `OPENAI_API_KEY` ou `GEMINI_API_KEY` (pelo menos uma)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH` (ou `FIREBASE_SERVICE_ACCOUNT_JSON`)
- `CORS_ORIGIN` com a URL do frontend em produção

### Opção B: Vercel (fullstack)

```bash
npm install -g vercel
vercel --prod
```

Configure as variáveis de ambiente no dashboard da Vercel.

---

## 🔧 Desenvolvimento Local

### Frontend

Abra `frontend/index.html` em qualquer servidor HTTP local:

```bash
# Python
cd frontend && python3 -m http.server 5500

# Node
npx serve frontend -p 5500

# VS Code: instale Live Server e clique em "Go Live"
```

**Sem Firebase configurado:** o app funciona 100% com `localStorage` (modo demo).

### Backend

```bash
cd backend
cp .env.example .env
# Edite .env

npm install
npm run dev    # hot-reload com node --watch
```

### Testes

```bash
cd backend && npm test
```

---

## 📐 Regras de Negócio

### Fórmula de Custo

```
C_total = (Kg_carne × Preço_carne)
        + (0,35 × Kg_carne/10 × R$68)    ← Aglomix
        + (0,10 × Kg_carne/10 × R$19)    ← Alho
        + (Metros_tripa × R$1,33)          ← Tripas
```

### Referências

| Insumo | Quantidade | Preço Base |
|--------|-----------|-----------|
| Tempero Aglomix | 350g/10kg de carne | R$ 68,00/kg |
| Alho | 100g/10kg de carne | R$ 19,00/kg |
| Tripa | — | R$ 40,00/moço (30m) = R$ 1,33/m |
| Rendimento tripa | 0,55 kg de massa/metro | — |
| Quebra maturação (salame/copa) | 35% de perda de peso | — |

---

## 🤖 Agente de IA

O backend expõe três endpoints de IA:

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/ai/analyze` | Análise de estoque e lucro real |
| `POST /api/ai/purchase-suggestions` | Sugestão de compras para 30 dias |
| `POST /api/ai/chat` | Pergunta livre ao especialista |

**Segurança:** as chaves de API nunca saem do backend. O frontend envia apenas dados de negócio (lotes, vendas, estoques) e recebe a resposta em texto.

**Fallback automático:** configure `AI_PROVIDER=openai` e `AI_FALLBACK_PROVIDER=gemini` (ou vice-versa). Se o provider primário falhar, o fallback é acionado automaticamente.

---

## 🔒 Segurança

- [x] Chaves de API de IA **nunca** no frontend
- [x] Regras Firestore validam campos obrigatórios e tipos
- [x] CORS configurável por variável de ambiente
- [x] `localStorage` é apenas cache — Firestore é a fonte da verdade em produção
- [x] Stack traces não expostos em produção (`NODE_ENV=production`)
- [x] Limite de tamanho de request (256 KB)

---

## 🗺️ Migração localStorage → Firestore

A migração é **automática e incremental**:

1. Configure o Firebase no `firebase-config.js`
2. Na primeira vez que o usuário abrir o app com Firestore configurado, os dados existentes no `localStorage` são exportados automaticamente para o Firestore
3. A migração é executada apenas uma vez (controlada pela chave `sdo_migrated_v1` no localStorage)

---

## 📄 Licença

MIT

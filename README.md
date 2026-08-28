# CultivAI

Protótipo web de um **assistente agrícola baseado em IA**. O produtor rural se cadastra, preenche o perfil da sua propriedade (localização, solo, histórico de cultivo, objetivos) e conversa com um chatbot que gera recomendações agronômicas personalizadas, combinando esses dados com o clima em tempo real e a estação do ano.

## Stack tecnológica

- **Framework**: [Next.js 16](https://nextjs.org) (App Router) + React 19
- **Linguagem**: JavaScript, com TypeScript em alguns módulos (`perfil-propriedade`, schemas de validação)
- **Estilos**: Tailwind CSS 4, CSS Modules e variáveis globais em `src/styles/variables.css`
- **Formulários**: `react-hook-form` + `zod`
- **Autenticação**: `bcryptjs` (hash de senha) + `jose` (JWT em cookie httpOnly)
- **Banco de dados**: MongoDB via `mongoose`
- **IA / LLM**:
  - `@google/generative-ai` (Gemini) — geração de embeddings para a base de conhecimento (RAG)
  - [AnythingLLM](https://anythingllm.com) (serviço externo hospedado) — processa as perguntas do chat e gera as respostas, usando o workspace `cultivai`
- **Clima**: [OpenWeatherMap](https://openweathermap.org/api)
- **Outros**: `lucide-react` (ícones), `react-markdown` (renderização das respostas do bot)

## Arquitetura

```
src/
  app/
    (public)/              → páginas públicas (usam Navbar)
      page.js                 rota "/", redireciona para /login
      login/
      cadastro/
      redefinir-senha/
    (authed)/               → páginas autenticadas (usam Sidebar)
      chatbot/                assistente de IA
      perfil-propriedade/     cadastro/edição dos dados da propriedade
      conta/                  dados da conta do usuário
    api/
      auth/
        login/                POST → autentica e seta cookie JWT
        register/              POST → cria usuário
        reset-password/        POST → redefine a senha por email
      chat/history/           GET/DELETE → histórico de mensagens do usuário
      llm/                    POST → orquestra clima + contexto da propriedade + AnythingLLM
      propriedade/            GET/POST → CRUD do perfil da propriedade
      user/                   GET → dados do usuário logado
      weather/                GET → proxy para a API do OpenWeatherMap
  components/               → Sidebar, Navbar, DynamicForm, Button, Card, Input
  lib/
    mongodb.js                conexão cacheada com o MongoDB
    schemas/propriedadeSchema.ts
  models/                   → User, Propriedade, ChatMessage, Knowledge (Mongoose)
scripts/
  ingest.mjs                → script standalone de ingestão de conhecimento (gera embeddings via Gemini)
```

## Como funciona

### Autenticação
A rota raiz `/` redireciona sempre para `/login`. Depois do login, o backend gera um JWT (`jose`, HS256, expira em 7 dias) e o envia em um cookie `authToken` (httpOnly). Todas as rotas de API autenticadas (`llm`, `chat/history`, `propriedade`, `user`) leem esse cookie e validam o token antes de responder.

### Perfil da propriedade
Formulário multi-seção (`/perfil-propriedade`) com dados de localização (com autopreenchimento de endereço via [ViaCEP](https://viacep.com.br)), solo, histórico de plantio, problemas enfrentados e objetivos. Esses dados alimentam o contexto enviado à IA no chat.

### Chatbot
Ao enviar uma mensagem em `/chatbot`, o endpoint `/api/llm`:
1. Autentica o usuário via JWT.
2. Salva a mensagem no MongoDB (`ChatMessage`).
3. Infere a estação do ano atual a partir do mês.
4. Busca o clima da cidade cadastrada na propriedade (`/api/weather`, proxy do OpenWeatherMap).
5. Monta um prompt de contexto combinando localização, clima, solo, histórico de cultivo e objetivos.
6. Envia o prompt para o workspace `cultivai` no AnythingLLM.
7. Recebe a resposta (que pode incluir um pedido de dados adicionais, exibido como formulário dinâmico na interface) e a salva no histórico.

### Base de conhecimento (RAG)
`scripts/ingest.mjs` é um script independente que gera embeddings de textos agronômicos via Gemini (`gemini-embedding-001`) e os salva na coleção `Knowledge` do MongoDB, para busca por similaridade (requer um índice vetorial configurado no MongoDB Atlas). Atualmente o RAG e o histórico de conversa em produção são geridos nativamente pelo próprio AnythingLLM.

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com:

```bash
MONGODB_URI=            # string de conexão do MongoDB
JWT_SECRET=             # segredo para assinar/verificar os JWTs de autenticação
GEMINI_API_KEY=         # chave da API Gemini (usada em scripts/ingest.mjs)
OPENWEATHER_API_KEY=    # chave da API do OpenWeatherMap
NEXT_PUBLIC_BASE_URL=   # opcional; URL base usada em chamadas internas (default: http://localhost:3000)
```

`JWT_SECRET` é obrigatória — as rotas de API lançam erro na inicialização se ela não estiver definida.

## Rodando o projeto

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

Outros scripts disponíveis:

```bash
npm run build   # build de produção
npm run start   # inicia o servidor de produção
npm run lint    # roda o ESLint
```
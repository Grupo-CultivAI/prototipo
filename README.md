# CultivAI

Protótipo web de um **assistente agrícola baseado em IA**. O produtor rural se cadastra, preenche o perfil da sua propriedade (localização, solo, histórico de cultivo, objetivos) e conversa com um chatbot que gera recomendações agronômicas personalizadas, combinando uma base de conhecimento da Embrapa (RAG) com o perfil cadastrado.

## Stack tecnológica

- **Framework**: [Next.js 16](https://nextjs.org) (App Router) + React 19
- **Linguagem**: JavaScript, com TypeScript em alguns módulos (`llm`, `perfil-propriedade`, schemas de validação)
- **Estilos**: Tailwind CSS 4, CSS Modules e variáveis globais em `src/styles/variables.css`
- **Formulários**: `react-hook-form` + `zod`
- **Autenticação**: `bcryptjs` (hash de senha) + `jose` (JWT em cookie httpOnly)
- **Banco de dados**: MongoDB via `mongoose`
- **IA / RAG** (chamadas feitas diretamente pela própria rota da API, sem servidor intermediário):
  - [Google Gemini](https://ai.google.dev) (`@google/genai`) — gera os embeddings da base de conhecimento e das perguntas (`gemini-embedding-001`, 768 dimensões)
  - [Pinecone](https://www.pinecone.io) (Starter, serverless) — banco vetorial com os trechos indexados dos PDFs da Embrapa
  - [Groq](https://groq.com) — gera a resposta final (`openai/gpt-oss-20b`, com fallback automático para `qwen/qwen3.8-27b` em caso de limite de cota)
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
      redefinir-senha/       ⚠️ ainda não verifica identidade do usuário (ver Status do projeto)
    (authed)/               → páginas autenticadas (usam Sidebar)
      chatbot/                assistente de IA
      perfil-propriedade/     cadastro/edição dos dados da propriedade
      conta/                  dados da conta do usuário
    api/
      auth/
        login/                POST → autentica e seta cookie JWT
        register/              POST → cria usuário
        reset-password/        POST → redefine a senha por email ⚠️ sem verificação de identidade (ver Status do projeto)
      chat/history/           GET/DELETE → histórico de mensagens do usuário
      llm/                    POST → autentica, aplica rate limit e orquestra o RAG (Gemini + Pinecone + Groq)
      propriedade/            GET/POST → CRUD do perfil da propriedade
      user/                   GET → dados do usuário logado
      weather/                GET → proxy para a API do OpenWeatherMap ⚠️ ainda sem autenticação (ver Status do projeto)
  components/               → Sidebar, Navbar, DynamicForm, Button, Card, Input
  lib/
    mongodb.js                conexão cacheada com o MongoDB
    auth.js                   leitura/validação do cookie JWT (usado por todas as rotas autenticadas)
    schemas/propriedadeSchema.ts
  models/                   → User, Propriedade, ChatMessage (Mongoose)
scripts/
  check-pdfs.mjs            → checagem local dos PDFs antes de ingerir (não consome cota de API)
  ocr-pdf.ps1               → gera o .txt acompanhante de um PDF com texto corrompido (só Windows)
  ingest-pdfs.mjs           → ingestão dos PDFs da Embrapa: extrai texto, gera embeddings via Gemini e indexa no Pinecone
  verify-ingest.mjs         → consulta avulsa ao Pinecone, para conferir um PDF específico
tests/
  verificar-base.mjs        → suíte de verificação da indexação (ver tests/README.md)
  casos-verificacao.json    → amostra de perguntas e fontes esperadas
docs-embrapa/               → pasta onde os PDFs da Embrapa são colocados manualmente antes de rodar a ingestão (não versionada no git)
```

## Como funciona

### Autenticação
A rota raiz `/` redireciona sempre para `/login`. Depois do login, o backend gera um JWT (`jose`, HS256, expira em 7 dias) e o envia em um cookie `authToken` (httpOnly). Todas as rotas de API autenticadas (`llm`, `chat/history`, `propriedade`, `user`) leem esse cookie e validam o token antes de responder.

### Perfil da propriedade
Formulário multi-seção (`/perfil-propriedade`) com dados de localização (com autopreenchimento de endereço via [ViaCEP](https://viacep.com.br)), solo, histórico de plantio, problemas enfrentados e objetivos.

### Chatbot (RAG)
Ao enviar uma mensagem em `/chatbot`, o endpoint `/api/llm`:

1. Autentica o usuário via JWT — retorna 401 se não houver sessão válida.
2. Aplica um limite de uso por usuário, contando as perguntas já feitas (padrão: 4 por minuto, 30 por dia). Tentativas que falham também contam, porque cada uma já gastou cota do Gemini.
3. Lê do MongoDB o perfil da propriedade e as últimas mensagens da conversa. O perfil vem do banco, nunca do navegador.
4. Grava a pergunta. Se algo falhar adiante, ela é marcada e deixa de aparecer no histórico.
5. Gera o embedding da pergunta via Gemini (`gemini-embedding-001`, 768 dimensões). Perguntas curtas de continuação ("e para soja?") são combinadas com a pergunta anterior antes da busca.
6. Busca 5 trechos no Pinecone e descarta os de score abaixo de `RAG_MIN_SCORE` (padrão 0,65), ficando com até 3. Em paralelo, busca o clima atual da cidade do perfil.
7. Monta o prompt com data de hoje, perfil, clima, trechos e histórico, e envia à Groq. A cadeia de modelos tenta o próximo em qualquer falha, inclusive quando a resposta passa de 1.000 tokens (sinal de repetição em laço).
8. Confere se os números escritos depois de "📘 Segundo a Embrapa" aparecem nos trechos enviados. Se não aparecem, pede ao modelo que reescreva; se a revisão também falhar, a resposta vai com um aviso ao produtor.
9. Grava a resposta com as fontes usadas (arquivo e páginas) e devolve ao chat.

**Capacidade no plano gratuito da Groq:** cada modelo aceita 8.000 tokens por minuto, somando todos os usuários, e cada pergunta gasta entre 1.300 e 1.700. Com os dois modelos `gpt-oss` na cadeia, o CultivAI inteiro responde cerca de 10 perguntas por minuto. Numa demonstração com muitas pessoas ao mesmo tempo, vale escalonar o uso. O log da função registra os tokens de cada resposta.

**Pedido de dados que faltam:** se o perfil não tem tipo de solo, localização ou culturas e a resposta depende disso, o modelo termina pedindo o dado com a marca `[PEDIR: código]` na última linha. A rota tira a marca do texto e devolve `tipo: 'coleta_dados'` com os campos do formulário, usando as mesmas opções do Meu Cultivo; o que o produtor responde é salvo no perfil. Só se pede o que falta, no máximo dois dados, e no máximo uma vez a cada 4 mensagens.

Os cenários de regressão do chat rodam com o servidor no ar (`npm run dev` em outro terminal):

```bash
npm run cenarios-chat
```

### Base de conhecimento (RAG)
`scripts/ingest-pdfs.mjs` é um script standalone que lê os PDFs colocados manualmente na pasta `docs-embrapa/`, quebra o texto em trechos, gera embeddings via Gemini e envia os vetores para o Pinecone (namespace configurável por `PINECONE_NAMESPACE`). O progresso é salvo em `.ingest-state.json` (não versionado), permitindo retomar a ingestão de onde parou caso o processo seja interrompido — por exemplo, ao atingir o limite diário gratuito da API do Gemini.

Cada vetor enviado ao Pinecone carrega três campos de metadata: `fonte` (nome do arquivo), `texto` (o trecho) e `pagina` (número da página **dentro do PDF**, começando em 1). Atenção: esse número é o índice da página no arquivo, que não necessariamente coincide com o número impresso na publicação original da Embrapa — um capítulo extraído de um livro maior começa na página 1 do PDF mesmo que o rodapé diga "29".

PDFs cujo texto não pôde ser extraído (escaneados sem OCR, por exemplo) são registrados em `failedFiles` no `.ingest-state.json` e listados ao final da execução.

Antes de ingerir, vale rodar a checagem local, que lê os PDFs sem consumir cota de API e aponta arquivos defeituosos:

```bash
node scripts/check-pdfs.mjs             # analisa ./docs-embrapa
node scripts/check-pdfs.mjs ./outra-pasta
```

Ela detecta dois tipos de defeito: PDF sem texto extraível (escaneado sem OCR) e PDF cujo texto sai ilegível porque a fonte foi embutida sem o mapa de caracteres. **O segundo tipo abre normalmente na tela** — o defeito só aparece na extração, então não dá para confiar em abrir o arquivo e olhar. A checagem também estima quantos trechos a ingestão vai gerar, que é o número de chamadas de embedding.

#### Arquivo acompanhante para PDFs defeituosos
Quando um PDF tem a camada de texto corrompida, um arquivo `.txt` de mesmo nome na mesma pasta substitui a extração. As páginas dentro dele são separadas por *form feed* (`\f`), para o número da página continuar correto no metadata. Tanto a ingestão quanto a checagem respeitam o acompanhante.

O `scripts/ocr-pdf.ps1` gera esse arquivo usando o reconhecimento óptico embutido no Windows, sem instalar nada (requer o pacote do idioma):

```powershell
.\scripts\ocr-pdf.ps1 -Pdf docs-embrapa\arquivo.pdf -Saida docs-embrapa\arquivo.txt
```

Esse script é o único trecho do projeto que só roda no Windows. Vale usá-lo quando a extração do PDF está totalmente ilegível — não quando está apenas imperfeita, já que o OCR erra sobrescritos e marcadores de rodapé.

```bash
node scripts/ingest-pdfs.mjs            # ingere os PDFs de ./docs-embrapa
node scripts/ingest-pdfs.mjs ./outra-pasta
```

### Verificação técnica da indexação
A suíte em [`tests/`](tests/README.md) confere se a base está indexada corretamente: para cada pergunta de uma amostra fixa, verifica se os melhores resultados vêm do documento esperado com score acima do limiar. O `tests/README.md` registra os resultados da última execução e os problemas em aberto.

```bash
npm run verificar-base
```

Para uma consulta avulsa, fora da suíte:

```bash
node scripts/verify-ingest.mjs "qual a importância da rotação de culturas?" cereais_inverno_rotacao_culturas.pdf
node scripts/verify-ingest.mjs "pergunta solta"   # sem PDF esperado, só lista os resultados
```

## Status do projeto

A migração da arquitetura antiga (Railway + Render + AnythingLLM) para o modelo atual, 100% serverless e de custo zero, já está em produção para o fluxo principal do chat. Itens ainda pendentes, em divisão de tarefas com o grupo:

- O perfil da propriedade e o clima atual ainda **não** são usados no contexto enviado ao chatbot.
- O logout ainda não invalida a sessão no servidor (o cookie `httpOnly` continua válido após sair).
- `/api/weather` ainda não exige autenticação.
- `/api/auth/reset-password` ainda não verifica a identidade de quem está redefinindo a senha.
- Não é possível excluir o perfil de propriedade cadastrado.
- Da base de PDFs da Embrapa, apenas uma amostra foi ingerida até o momento; a ingestão completa (36 PDFs) está em andamento.

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com:

```bash
MONGODB_URI=            # string de conexão do MongoDB
JWT_SECRET=             # segredo para assinar/verificar os JWTs de autenticação
OPENWEATHER_API_KEY=    # chave da API do OpenWeatherMap

# IA / RAG
GEMINI_API_KEY=         # chave da API Gemini (embeddings)
GROQ_API_KEY=           # chave da API Groq (geração de texto)
GROQ_MODELS=            # opcional; modelos em ordem de fallback, separados por vírgula
                         # (padrão: openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b)
PINECONE_API_KEY=       # chave da API do Pinecone
PINECONE_INDEX_HOST=    # host do índice no Pinecone, sem "https://"
PINECONE_NAMESPACE=     # opcional (padrão: embrapa)
RAG_MIN_SCORE=          # opcional (padrão: 0.65); trechos abaixo disso não entram no prompt

# Limites de uso
RATE_LIMIT_PER_MINUTE=  # opcional (padrão: 4)
RATE_LIMIT_PER_DAY=     # opcional (padrão: 30)
```

`JWT_SECRET` é obrigatória — as rotas de API lançam erro na inicialização se ela não estiver definida.

O índice do Pinecone precisa ser criado previamente com **768 dimensões** e **métrica cosine**, antes de rodar a ingestão.

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

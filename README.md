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
- **Clima**: [OpenWeatherMap](https://openweathermap.org/api), consultado pelo servidor (`lib/weather.ts`) para o contexto do chat
- **Outros**: `lucide-react` (ícones), `react-markdown` (renderização das respostas do bot)

## Arquitetura

```
src/
  proxy.ts                  → manda ao login quem abre uma página logada sem sessão válida (o "middleware" do Next 16)
  app/
    (public)/              → páginas públicas (usam Navbar)
      page.js                 rota "/", redireciona para /login
      login/                  entrar (quem já está logado vai direto ao chat)
      cadastro/               criar conta, com aceite do aviso de privacidade
      esqueci-senha/          pede o link de recuperação por email
      redefinir-senha/        senha nova pelo link do email (?codigo=...) ou troca com a senha atual
      privacidade/            aviso de privacidade (LGPD)
    (authed)/               → páginas autenticadas (usam Sidebar)
      chatbot/                assistente de IA
      perfil-propriedade/     cadastro/edição dos dados da propriedade
      conta/                  dados da conta do usuário
    api/
      auth/
        login/                POST → autentica e seta cookie JWT (5 erros por email em 15 min bloqueiam)
        logout/               POST → apaga o cookie de sessão (httpOnly: só o servidor apaga)
        register/             POST → cria usuário (senha de 8+ caracteres e aceite do aviso de privacidade)
        esqueci-senha/        POST → envia por email um link de recuperação válido por 30 min
        reset-password/       POST → senha nova pelo código do link, ou troca com a senha atual
      chat/history/           GET → mensagens da conversa atual e perguntas restantes no dia; DELETE → apaga a conversa
      chat/avaliacao/         POST → 👍/👎 do produtor numa resposta
      conversas/              POST → "Nova conversa" (a anterior fica guardada)
      llm/                    POST → autentica, aplica rate limit e orquestra o RAG (Gemini + Pinecone + Groq)
      propriedade/            GET/POST → perfil da propriedade; DELETE → "Apagar dados da propriedade"
      user/                   GET → dados do usuário logado; DELETE → "Excluir minha conta" (pede a senha e apaga tudo)
  components/               → Sidebar, Navbar, DynamicForm, Input (campo acessível das telas de conta), AvisoFormulario, Button, Card
  lib/
    mongodb.js                conexão cacheada com o MongoDB
    auth.js                   leitura/validação do cookie JWT (usado por todas as rotas autenticadas)
    documentos.json           catálogo dos PDFs da base: arquivo → título mostrado ao produtor (e link, quando houver)
    limites.ts                limite de perguntas por minuto e por dia (usado pelo chat e pelo contador)
    conversas.ts              conversa atual de cada pessoa e migração do histórico antigo
    senha.js                  regra de senha (mínimo de 8) e padronização do email
    tentativas.ts             limite de tentativas de login e de pedidos de recuperação
    email.ts                  envio de email por SMTP (recuperação de senha)
    sessao.ts                 "já está logado?" para as telas de login e cadastro
    cookieSessao.js           apaga o cookie de sessão (logout e exclusão de conta)
    schemas/propriedadeSchema.ts
  models/                   → User, Propriedade, Conversa, ChatMessage, TentativaAcesso (Mongoose)
scripts/
  check-pdfs.mjs            → checagem local dos PDFs antes de ingerir (não consome cota de API)
  ocr-pdf.ps1               → gera o .txt acompanhante de um PDF com texto corrompido (só Windows)
  ingest-pdfs.mjs           → ingestão dos PDFs da Embrapa: extrai texto, gera embeddings via Gemini e indexa no Pinecone
  verify-ingest.mjs         → consulta avulsa ao Pinecone, para conferir um PDF específico
  relatorio-chat.mjs        → respostas com 👎 e perguntas com pouca cobertura na base (npm run relatorio-chat)
tests/
  verificar-base.mjs        → suíte de verificação da indexação (ver tests/README.md)
  casos-verificacao.json    → amostra de perguntas e fontes esperadas
docs-embrapa/               → pasta onde os PDFs da Embrapa são colocados manualmente antes de rodar a ingestão (não versionada no git)
```

## Como funciona

### Autenticação
A rota raiz `/` redireciona sempre para `/login`. Depois do login, o backend gera um JWT (`jose`, HS256, expira em 7 dias) e o envia em um cookie `authToken` (httpOnly). Todas as rotas de API autenticadas (`llm`, `chat/history`, `propriedade`, `user`) leem esse cookie e validam o token antes de responder. "Sair da Conta" chama `/api/auth/logout`, que apaga o cookie pelo servidor.

- **Cadastro:** senha de no mínimo 8 caracteres e aceite do aviso de privacidade (`/privacidade`), cuja data fica gravada. O email é gravado sem espaços e em minúsculas.
- **Tentativas:** 5 logins errados para o mesmo email, ou 20 para o mesmo IP, em 15 minutos, bloqueiam novas tentativas até o fim da janela. A coleção `tentativaacessos` se apaga sozinha (índice TTL).
- **Esqueci a senha:** `/esqueci-senha` envia um link com um código aleatório, válido por 30 minutos e de uso único; o banco guarda só o hash do código. A resposta é a mesma exista a conta ou não, para não revelar quem usa o CultivAI. Sem SMTP configurado, em desenvolvimento o link aparece no terminal do `npm run dev`; em produção a tela avisa que a recuperação ainda não está ativa.
- **Telas de conta:** erros aparecem dentro do formulário e levam o foco ao campo a corrigir; os campos têm rótulo ligado, `autocomplete` para o gerenciador de senhas e botão de mostrar a senha.

### Perfil da propriedade
Formulário multi-seção (`/perfil-propriedade`) com dados de localização (com autopreenchimento de endereço via [ViaCEP](https://viacep.com.br)), solo, histórico e manejo (culturas, sistema de plantio, irrigação), problemas enfrentados, próxima cultura e objetivos.

- As culturas são opções clicáveis, com campo para acrescentar outra; `src/lib/perfil.js` padroniza a grafia, para "milho" e "Milho" não virarem duas culturas.
- "Não sei" é resposta válida no tipo de solo e no sistema de plantio, e a IA é avisada de que o produtor não sabe.
- Um indicador mostra quantos dos itens que mais mudam a recomendação estão preenchidos. A mesma lista (`ITENS_DO_PERFIL`) gera o lembrete no início do chat.
- "Salvar e pedir análise à IA" abre o chat e já envia a primeira pergunta, que conta no limite diário. "Só salvar" não gasta pergunta.

### Chatbot (RAG)
Ao enviar uma mensagem em `/chatbot`, o endpoint `/api/llm`:

1. Autentica o usuário via JWT — retorna 401 se não houver sessão válida.
2. Aplica um limite de uso por usuário, contando as perguntas já feitas (padrão: 4 por minuto, 30 por dia). Tentativas que falham também contam, porque cada uma já gastou cota do Gemini. O limite é por pessoa, não por conversa. "Apagar conversa" apaga as mensagens, mas as perguntas das últimas 24 horas ficam registradas sem o texto, para o limite não zerar.
3. Lê do MongoDB o perfil da propriedade e as últimas mensagens **da conversa aberta**. O perfil vem do banco, nunca do navegador.
4. Grava a pergunta. Se algo falhar adiante, ela é marcada e deixa de aparecer no histórico.
5. Gera o embedding da pergunta via Gemini (`gemini-embedding-001`, 768 dimensões). Perguntas curtas de continuação ("e para soja?") são combinadas com a pergunta anterior antes da busca.
6. Busca 5 trechos no Pinecone e descarta os de score abaixo de `RAG_MIN_SCORE` (padrão 0,65), ficando com até 3. Em paralelo, busca o clima atual da cidade do perfil.
7. Monta o prompt com data de hoje, perfil, clima, trechos e histórico, e envia à Groq. A cadeia de modelos tenta o próximo em qualquer falha, inclusive quando a resposta passa de 1.000 tokens (sinal de repetição em laço).
8. Confere se os números escritos depois de "📘 Segundo a Embrapa" aparecem nos trechos enviados. Se não aparecem, pede ao modelo que reescreva; se a revisão também falhar, a resposta vai com um aviso ao produtor.
9. Grava a resposta com as fontes usadas (arquivo e páginas) e devolve ao chat, com o título de cada documento tirado de `src/lib/documentos.json`. Também grava o maior score da busca, que alimenta o relatório de lacunas, e devolve quantas perguntas restam no dia.

**Capacidade no plano gratuito da Groq:** cada modelo aceita 8.000 tokens por minuto, somando todos os usuários, e cada pergunta gasta entre 1.300 e 1.700. Com os dois modelos `gpt-oss` na cadeia, o CultivAI inteiro responde cerca de 10 perguntas por minuto. Numa demonstração com muitas pessoas ao mesmo tempo, vale escalonar o uso. O log da função registra os tokens de cada resposta.

**Pedido de dados que faltam:** se o perfil não tem tipo de solo, localização ou culturas e a resposta depende disso, o modelo termina pedindo o dado com a marca `[PEDIR: código]` na última linha. A rota tira a marca do texto e devolve `tipo: 'coleta_dados'` com os campos do formulário, usando as mesmas opções do Meu Cultivo; o que o produtor responde é salvo no perfil. Só se pede o que falta, no máximo dois dados, e no máximo uma vez a cada 4 mensagens.

Os cenários de regressão do chat rodam com o servidor no ar (`npm run dev` em outro terminal):

```bash
npm run cenarios-chat
```

**Conversas:** o botão "Nova conversa" começa do zero sem apagar nada. O contexto da IA (mensagens anteriores e a junção de perguntas curtas com a anterior) fica restrito à conversa aberta, para uma dúvida antiga sobre outro assunto não contaminar a nova. A tela mostra sempre a conversa mais recente; as anteriores ficam guardadas na coleção `conversas`, prontas para uma futura lista. O histórico gravado antes das conversas existirem vira uma conversa na primeira vez que a pessoa abre o chat.

**O que fica registrado de cada resposta** (`ChatMessage`): quem perguntou (`userId`), em que conversa (`conversaId`), a pergunta que ela responde (`metadata.perguntaId`), as fontes usadas, a busca (texto buscado, maior score, trechos usados), a geração (modelo, tokens de entrada e saída, tempo de resposta, se a checagem de números pediu revisão e se a resposta saiu com aviso), o perfil e o clima que a IA considerou naquele momento, o pedido de dado, se houve, e a avaliação 👍/👎.

**Na tela do chat** o produtor também encontra: sugestões de primeira pergunta montadas com o perfil, o contador de perguntas restantes no dia, 👍/👎 em cada resposta, o botão Imprimir (que gera papel ou PDF só com a conversa, pelo próprio navegador) e o microfone para ditar a pergunta. O microfone usa o reconhecimento de fala do navegador, gratuito, e aparece só onde ele existe (Chrome e Edge, inclusive no Android).

#### Relatório do chat
Lê o MongoDB, sem consumir cota de API, e não mostra quem perguntou:

```bash
npm run relatorio-chat                          # últimos 30 dias
npm run relatorio-chat -- --dias 7 --limite 0.70
```

- **Respostas com 👎:** pergunta, resposta e score da busca, para a Frente 3 investigar.
- **Pouca cobertura na base:** perguntas cuja busca não passou de 0,72 (ajustável com `--limite`). São candidatas a assuntos que faltam na base, mas as faixas de score se sobrepõem, então cada uma precisa ser lida. Abaixo de 0,62, em geral, a pergunta está fora do tema.

Quem reinicia o chat apaga também as próprias avaliações, que deixam de aparecer no relatório.

### Base de conhecimento (RAG)
`scripts/ingest-pdfs.mjs` é um script standalone que lê os PDFs colocados manualmente na pasta `docs-embrapa/`, quebra o texto em trechos, gera embeddings via Gemini e envia os vetores para o Pinecone (namespace configurável por `PINECONE_NAMESPACE`). O progresso é salvo em `.ingest-state.json` (não versionado), permitindo retomar a ingestão de onde parou caso o processo seja interrompido — por exemplo, ao atingir o limite diário gratuito da API do Gemini.

Cada vetor enviado ao Pinecone carrega três campos de metadata: `fonte` (nome do arquivo), `texto` (o trecho) e `pagina` (número da página **dentro do PDF**, começando em 1). Atenção: esse número é o índice da página no arquivo, que não necessariamente coincide com o número impresso na publicação original da Embrapa — um capítulo extraído de um livro maior começa na página 1 do PDF mesmo que o rodapé diga "29".

PDFs cujo texto não pôde ser extraído (escaneados sem OCR, por exemplo) são registrados em `failedFiles` no `.ingest-state.json` e listados ao final da execução.

Antes de ingerir, vale rodar a checagem local, que lê os PDFs sem consumir cota de API e aponta arquivos defeituosos:

```bash
node scripts/check-pdfs.mjs             # analisa ./docs-embrapa
node scripts/check-pdfs.mjs ./outra-pasta
```

Ela detecta dois tipos de defeito: PDF sem texto extraível (escaneado sem OCR) e PDF cujo texto sai ilegível porque a fonte foi embutida sem o mapa de caracteres. **O segundo tipo abre normalmente na tela** — o defeito só aparece na extração, então não dá para confiar em abrir o arquivo e olhar. A checagem também estima quantos trechos a ingestão vai gerar, que é o número de chamadas de embedding, e lista os PDFs que ainda não têm título no catálogo.

#### Título de cada documento
O Pinecone guarda só o nome do arquivo, que muitas vezes não diz nada ao produtor (`pat.pdf`, `ORAL11.pdf`). O título que aparece em "Documentos da Embrapa consultados" vem de `src/lib/documentos.json`:

```json
"pat.pdf": { "titulo": "Calcário, gesso e efeito residual de fertilizantes na produção de biomassa e ciclagem de nutrientes de milheto", "url": "https://..." }
```

Ao acrescentar um PDF à base, acrescente também a linha dele. O `url` é opcional: quando existe, o título vira link para a publicação original. O catálogo é lido na hora de mostrar a resposta, então corrigir um título não exige reingerir nada e vale também para as conversas antigas.

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

- Lista de conversas anteriores: o banco já guarda as conversas (coleção `conversas`), mas a tela mostra só a mais recente.
- A recuperação de senha por email depende das variáveis de SMTP na Vercel (configuradas com a conta pex.ifsp@gmail.com).

A antiga rota `/api/weather` foi removida em 26/10/2026: nenhuma tela a usava (o chat consulta o clima pelo servidor) e ela permitia a qualquer pessoa, sem login, gastar a cota do OpenWeather do projeto.

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

# Email de recuperação de senha (SMTP; ex.: Gmail com senha de app, ou Brevo)
SMTP_HOST=              # ex.: smtp.gmail.com ou smtp-relay.brevo.com
SMTP_PORT=              # opcional (padrão: 587; 465 usa conexão segura direta)
SMTP_USER=              # usuário/login do SMTP
SMTP_PASS=              # senha do SMTP (no Gmail, uma "senha de app", não a senha da conta)
EMAIL_REMETENTE=        # opcional; ex.: "CultivAI <cultivai.projeto@gmail.com>" (padrão: SMTP_USER)
APP_URL=                # opcional; endereço usado no link do email (ex.: https://prototipo-cultivai.vercel.app)
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

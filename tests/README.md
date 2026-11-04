# Verificação técnica da base (Frente 2)

Confere se os PDFs da Embrapa foram indexados corretamente no Pinecone: para cada pergunta, se os melhores resultados vêm do documento esperado e com score de similaridade acima do limiar do modelo de embedding (0,35 com o `llama-text-embed-v2`; era 0,5 com o Gemini). O limiar fica em `src/lib/embeddings.mjs`, junto com o modelo, porque a escala dos scores muda de um modelo para outro.

**O que isto não faz:** avaliar se a resposta final do chatbot está correta. Isso é escopo da Frente 3.

## Como rodar

```bash
node tests/verificar-base.mjs      # ou: npm run verificar-base
node tests/verificar-base.mjs --namespace outro   # confere uma base de teste nos mesmos casos
```

Precisa de `PINECONE_API_KEY` e `PINECONE_INDEX_HOST` no `.env.local` (os embeddings vêm do Pinecone Inference).

Códigos de saída: `0` tudo certo, `1` algum caso reprovou, `2` não foi possível consultar (tipicamente o limite por minuto do Pinecone Inference).

Para uma consulta avulsa, fora da suíte, existe `scripts/verify-ingest.mjs`:

```bash
node scripts/verify-ingest.mjs "sua pergunta" arquivo.pdf
node scripts/verify-ingest.mjs "sua pergunta" parte1.pdf parte2.pdf   # vários aceitos
node scripts/verify-ingest.mjs "sua pergunta"                          # só lista os resultados
```

## Os casos

Ficam em [`casos-verificacao.json`](casos-verificacao.json). Cada caso tem a pergunta, as fontes aceitas e o formato do documento — a amostra mistura artigos longos, resumos de uma página, um texto em inglês e folders com tabela, para não validar só o caso fácil.

Dois campos merecem atenção ao editar:

- **`fontesAceitas`** aceita mais de um arquivo. Necessário quando a base tem documentos irmãos: perguntar sobre genótipos de milho resistentes a nematoides pode legitimamente trazer as partes 1 e 2 da mesma publicação, e exigir um único arquivo geraria reprovação falsa.
- **`falhaConhecida`** marca um caso que reprova por um problema já identificado e documentado. Ele aparece no relatório mas não derruba a suíte, para que um defeito conhecido e aguardando ação externa não deixe o resultado vermelho para sempre.

As perguntas foram escritas a partir de um trecho real de cada documento. Pergunta vaga casa com vários arquivos e produz reprovação falsa.

## Resultados registrados

Execução de **28/10/2026**, depois da troca do modelo de embedding (Gemini → `llama-text-embed-v2`, namespace `embrapa-llama`), sobre os mesmos 35 PDFs e 835 trechos.

**10 casos: 7 aprovados, 3 reprovados.** Nos 10, o 1º resultado vem do documento esperado. As 3 reprovações são do 2º ou 3º resultado vindo de um documento vizinho, de assunto parecido:

| Documento | Melhor score | Resultado |
|---|---|---|
| `NubiaSelectivityofbentazon.pdf` (inglês) | 0,7358 | passou (3/3) |
| `mandioca_rotacao_culturas_cultivo_consorciado.pdf` | 0,7035 | passou (3/3) |
| `rotacao_culturas_manejo_nematoide_reniforme_algodoeiro.pdf` | 0,6976 | passou (3/3) |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` (dados numéricos) | 0,6587 | passou (3/3) |
| `manejo_nematoide_soja.pdf` ou `milho_nematoides.pdf` | 0,6467 | passou (3/3) |
| `viabilidade_agroeconomica_rotacao.pdf` | 0,6421 | passou (3/3) |
| `cereais_inverno_rotacao_culturas.pdf` | 0,5297 | passou (3/3) |
| `oxido_nitroso_manejo_solo_rotacao_culturas.pdf` | 0,7374 | reprovou (1/3: 2º e 3º de `viabilidade_agroeconomica_rotacao.pdf` e `rotacao_culturas_cerrado.pdf`) |
| `16silvasousa.pdf` | 0,7274 | reprovou (2/3: 3º de `46neilaproducao.pdf`, também sobre nabo-forrageiro) |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` (tema) | 0,6596 | reprovou (2/3: 3º de `cereais_inverno_rotacao_culturas.pdf`, também sobre trigo) |

Comparação feita no mesmo dia, com busca exata sobre os 835 trechos: `llama-text-embed-v2` acertou o 1º resultado em 10/10 e os 3 em 7/10; `multilingual-e5-large` (1.024 dimensões, exigiria outro índice) acertou 10/10 e 8/10, mas separa mal o que é do tema: "receita de bolo" pontuou 0,81 e perguntas do tema, de 0,84 a 0,89. Com o Llama, fora do tema fica abaixo de 0,31 e do tema acima de 0,37, o que permite um limiar confiável. Por isso a escolha foi o Llama.

### Teste do corte por frase (03/11/2026)

Os PDFs não têm parágrafos marcados (nenhuma linha em branco; cada quebra de linha é o fim de uma linha visual), por isso o teste foi o corte por frase: cada trecho termina no fim de uma frase, e a última frase se repete no começo do seguinte. Cada variante foi gravada num namespace de teste (`ingest-pdfs.mjs --namespace`), comparada com a base em uso e apagada depois.

| Base | Trechos | Começam / terminam no meio de uma frase | Casos aprovados | Trechos do documento certo nos 3 primeiros |
|---|---|---|---|---|
| Em uso (corte por tamanho, 800) | 835 | 73% / 93% | 7/10 | 26/30 |
| Por frase, até 800 caracteres | 977 | 2% / 5% | 8/10 | 28/30 |
| Por frase, até 1.000 caracteres | 736 | — | 7/10 | 26/30 |

Nas perguntas vagas dos produtores, porém, o corte por frase de até 800 baixou os scores: "meu feijao ta dando pouco o que eu faço" caiu de 0,370 para 0,334, abaixo do limiar, e ficaria sem nenhum trecho da Embrapa; "quando eu planto feijão aqui" caiu de 4 para 1 trecho acima do limiar. Com até 1.000 caracteres, essas perguntas recuperaram parte (0,352 e 2 trechos), mas a melhora nos casos específicos sumiu. As perguntas fora do tema ficaram abaixo de 0,30 nas três bases. **A base em uso foi mantida**: nenhuma variante foi melhor em tudo, e as perguntas vagas são as mais comuns no chat.

### Antes da troca (Gemini)


Execução de **20/10/2026**, sobre 36 PDFs e 849 trechos indexados.

> Atualização em 27/10/2026: `pratylenchus_brachyurus_soja_produtividade.pdf` saiu da base. Era o mesmo estudo de `cultivo_soja_pratylenchus_brachyurus_graos.pdf` (mesmos números), com uma página de capa a mais, e os dois ocupavam juntos as vagas de trechos de uma mesma resposta. A base passou a ter 35 PDFs e 835 trechos. Nenhum caso de verificação usava esse arquivo.

> Correção em 25/10/2026: este registro dizia 864 trechos, número que estava errado. O índice tinha 850 vetores — 849 válidos e um trecho órfão com o texto corrompido antigo do PDF de trigo, que sobrou quando o OCR reduziu o documento de 16 para 15 trechos. O script de ingestão passou a remover esses excedentes, e o órfão foi apagado.

**10 casos, 10 aprovados, nenhuma falha.**

| Documento | Melhor score | Resultado |
|---|---|---|
| `16silvasousa.pdf` | 0,8767 | passou (3/3) |
| `NubiaSelectivityofbentazon.pdf` (inglês) | 0,8612 | passou (3/3) |
| `rotacao_culturas_manejo_nematoide_reniforme_algodoeiro.pdf` | 0,8378 | passou (3/3) |
| `oxido_nitroso_manejo_solo_rotacao_culturas.pdf` | 0,8350 | passou (3/3) |
| `mandioca_rotacao_culturas_cultivo_consorciado.pdf` | 0,8344 | passou (3/3) |
| `viabilidade_agroeconomica_rotacao.pdf` | 0,8236 | passou (3/3) |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` (dados numéricos) | 0,8182 | passou (3/3) |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` (tema) | 0,8120 | passou (3/3) |
| `manejo_nematoide_soja.pdf` ou `milho_nematoides.pdf` | 0,7972 | passou (3/3) |
| `cereais_inverno_rotacao_culturas.pdf` | 0,7740 | passou (3/3) |

Os 30 resultados retornados ficaram acima do limiar de 0,5, na faixa de 0,73 a 0,88.

### Efeito da correção de cabeçalho nos folders com tabela

Mesma pergunta, antes e depois de repetir o cabeçalho das colunas em cada trecho:

| Posição | Antes | Depois |
|---|---|---|
| 1º resultado | 0,7932 | 0,7972 |
| 2º resultado | 0,7768 | 0,7883 |
| 3º resultado | 0,7648 | 0,7859 |

Os três melhoraram. A preocupação de que o prefixo diluísse o embedding, tornando os trechos do arquivo parecidos demais entre si, não se confirmou — a recuperação ficou ligeiramente melhor, e agora cada trecho recuperado chega ao modelo com a explicação das colunas junto.

### Observação sobre o limiar

Os scores variam levemente entre execuções, porque os embeddings do Gemini não são idênticos a cada chamada. Um mesmo trecho mediu 0,8049 numa rodada e 0,7760 em outra. Trate 0,5 como faixa, não como corte exato.

## Verificação de integridade do texto

Além da recuperação, os 36 PDFs passaram por uma checagem de densidade de palavras funcionais (`de`, `da`, `para`, `que`, `the`, `of`) a cada mil caracteres. Texto natural tem densidade alta; texto com codificação de fonte quebrada não tem nenhuma.

| Grupo | Densidade | Avaliação |
|---|---|---|
| 34 arquivos | 21 a 40 | íntegros |
| `manejo_nematoide_soja.pdf`, `milho_nematoides.pdf` | 15,7 e 14,6 | íntegros — densidade baixa explicada pelo conteúdo tabular |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` | 0,6 → 39,7 | corrigido pelo acompanhante `.txt` |

Nenhum PDF escaneado sem OCR foi encontrado. A checagem roda com `node scripts/check-pdfs.mjs` e hoje não aponta nenhum problema.

A medição é feita por documento, não por página. Medir por página foi testado e gera falso positivo: capas de folder e páginas de tabela têm pouco texto corrido por natureza e caem abaixo do limiar sem estarem defeituosas.

## Ressalva conhecida

**`cereais_inverno_rotacao_culturas.pdf` tem cerca de 6% do texto ilegível**, com trechos corrompidos entremeados no corpo e a página de referências inteira comprometida. É o mesmo defeito de fonte descrito abaixo, mas parcial.

Optou-se por deixar como está. Aplicar OCR trocaria 6% de lixo evidente por imprecisão espalhada no documento inteiro, já que o reconhecimento erra sobrescritos e marcadores de rodapé. Os 94% restantes estão corretos e o documento é recuperado normalmente, com 3 de 3 resultados no caso de teste.

## Resolvido

**`trigo_desempenho_agronomico_rotacao_culturas.pdf` tinha a camada de texto corrompida na origem.**

O arquivo abre e lê normalmente na tela — o defeito só aparecia na extração, porque a fonte foi embutida sem o mapa que associa cada glifo à sua letra. "Henrique Pereira dos Santos" era extraído como `+HQULTXH3HUHLUDGRV6DQWRV`.

Duas tentativas de recuperação foram feitas antes da que funcionou:

- **Converter o deslocamento.** O desvio é de exatamente 29 posições na tabela de caracteres, e a conversão inversa recupera a prosa. Descartada porque os acentos não voltam, os espaços se perdem e **os números desaparecem por completo** — e o valor do artigo está justamente nos resultados numéricos.
- **Baixar uma cópia limpa.** O arquivo foi obtido do repositório Alice, da própria Embrapa, e é byte a byte idêntico ao que já tínhamos. O defeito está no PDF publicado, não numa cópia estragada.

**Solução aplicada:** OCR com o reconhecimento embutido no Windows (`scripts/ocr-pdf.ps1`), gravado como arquivo acompanhante `.txt`. A densidade do documento subiu de 0,6 para 39,7, a mais alta da base. Os dados experimentais voltaram inteiros — uma busca por "rendimento de grãos com dois anos de rotação" agora traz os trechos com 3.571 kg/ha e 2.495 kg/ha.

O OCR não é transcrição perfeita: sobrescritos saem errados (`kg hL⁻¹` virou `kg 111--1`) e alguns marcadores de rodapé se perdem. Nenhum defeito afeta os valores ou o sentido.

**Efeito colateral observado:** com o documento legível, ele passou a competir legitimamente com `cereais_inverno_rotacao_culturas.pdf` numa pergunta genérica sobre rotação de culturas para cereais de inverno — os dois tratam do tema. O caso de teste foi reancorado num dado que só existe no capítulo, em vez de aceitar as duas fontes.



**Folders com tabela recuperados sem o cabeçalho.** A tabela de genótipos se divide em vários trechos e o cabeçalho que identifica as colunas aparecia uma única vez. Uma busca recuperava, com score 0,7768, um trecho de linhas soltas como `GNZ 7280PRO2 Geneze S R S`, sem nada indicando a qual nematoide cada letra se refere — o modelo poderia inverter as colunas e recomendar um híbrido suscetível como resistente.

Corrigido em `scripts/ingest-pdfs.mjs`, que repete o cabeçalho e a legenda em todos os trechos desses dois arquivos, e reindexado em 20/10/2026. Cada trecho recuperado agora chega ao modelo com a explicação das colunas junto.

# Checagens das respostas do chat (Frente 1)

`tests/checagens.mjs` confere, sem rede, sem banco e sem IA, as checagens que a rota do chat aplica a cada resposta antes de mostrá-la ao produtor:

- **erros agronômicos** (`src/lib/errosAgronomicos.ts`): planta de verão no inverno do Sul, plantio no inverno seco do Cerrado sem irrigação, planta de inverno semeada na primavera, soja no inverno, nomes de plantas trocados, leguminosa errada, mandioca "semeada";
- **agrotóxicos** (`src/lib/agrotoxicos.ts`): produto com dose ou produto proibido;
- **origem da informação** (`src/lib/atribuicao.ts`): números sob o 📘 que não estão nos trechos da Embrapa e datas sob o 🗓️ que não estão nas janelas do ZARC;
- **reescrita** (`src/lib/revisao.ts`): o corte das desculpas no começo da resposta reescrita;
- **estação e clima** (`src/lib/estacao.ts`) e a **cultura de antes** nas perguntas do ZARC (`src/lib/zarc-formato.mjs`).

```bash
npm run checagens
```

Roda em segundos e faz parte da CI. Cada caso é uma frase que a checagem deve marcar (errada) ou deixar passar (certa). As checagens são expressões regulares: uma mudança pequena pode quebrá-las sem aviso, e um falso positivo custa uma reescrita da resposta (cerca de 4 mil tokens da cota gratuita). Ao achar um erro novo nas respostas da IA, acrescente a frase errada e uma parecida, porém certa, antes de mexer na checagem.

# Avaliação das respostas da IA (Frentes 1 e 3)

`tests/avaliar-respostas.mjs` faz à IA de verdade as perguntas do teste com personas de 02/11/2026 e casos de época e região (inverno no Sul, inverno seco no Cerrado, pergunta sem região), cada uma com o perfil da persona.

- **Reprova** se uma resposta não vier (HTTP diferente de 200), tiver um erro agronômico conhecido (`src/lib/errosAgronomicos.ts`) ou agrotóxico com dose, ou não cumprir o que o caso espera (por exemplo, indicar planta de inverno na pergunta de inverno do Sul, ou dar a janela oficial do feijão).
- **Observa**, sem reprovar: legibilidade abaixo de 50 (Flesch adaptado ao português), resposta a pergunta informal com mais de 200 palavras, aviso de "não pôde ser conferido" e qual modelo respondeu.

Roda toda segunda-feira às 3h (`.github/workflows/avaliacao-semanal.yml`), num banco descartável com as janelas do ZARC de `tests/dados/zarc-amostra.json` (dados abertos do MAPA, licença CC-BY). O resumo aparece na página da execução, na aba Actions. O fluxo precisa dos secrets `GROQ_API_KEY`, `PINECONE_API_KEY` e `PINECONE_INDEX_HOST` (e, opcionais, `NVIDIA_API_KEY` e `OPENWEATHER_API_KEY`); sem eles, só avisa. Localmente, com o servidor e o teste no mesmo banco local:

```bash
MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run dev                 # em outro terminal
MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run avaliar-respostas
MONGODB_URI=mongodb://127.0.0.1:27999/cultivai npm run avaliar-respostas -- --caso josiane
```

Gasta umas 10 perguntas da cota da IA. A pausa padrão é de 40 s entre as perguntas: com menos, a Groq estoura o limite por minuto, e a resposta vem de um modelo pior, o que mede a fila e não o prompt. Ao achar um erro novo nas respostas, acrescente o caso aqui e a frase em `tests/checagens.mjs`.

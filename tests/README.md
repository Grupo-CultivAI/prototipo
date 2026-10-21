# Verificação técnica da base (Frente 2)

Confere se os PDFs da Embrapa foram indexados corretamente no Pinecone: para cada pergunta, se os melhores resultados vêm do documento esperado e com score de similaridade acima do limiar acordado pelo grupo (0,5).

**O que isto não faz:** avaliar se a resposta final do chatbot está correta. Isso é escopo da Frente 3.

## Como rodar

```bash
node tests/verificar-base.mjs      # ou: npm run verificar-base
```

Precisa de `GEMINI_API_KEY`, `PINECONE_API_KEY` e `PINECONE_INDEX_HOST` no `.env.local`.

Códigos de saída: `0` tudo certo, `1` algum caso reprovou, `2` não foi possível consultar (tipicamente cota do Gemini esgotada).

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

Execução de **20/10/2026**, sobre 36 PDFs e 850 trechos indexados. Base completa, já com a correção de cabeçalho dos folders com tabela.

**8 passaram, 0 falharam, 1 falha conhecida.**

| Documento | Melhor score | Resultado |
|---|---|---|
| `16silvasousa.pdf` | 0,8767 | passou (3/3) |
| `NubiaSelectivityofbentazon.pdf` (inglês) | 0,8612 | passou (3/3) |
| `rotacao_culturas_manejo_nematoide_reniforme_algodoeiro.pdf` | 0,8378 | passou (3/3) |
| `oxido_nitroso_manejo_solo_rotacao_culturas.pdf` | 0,8350 | passou (3/3) |
| `mandioca_rotacao_culturas_cultivo_consorciado.pdf` | 0,8344 | passou (3/3) |
| `viabilidade_agroeconomica_rotacao.pdf` | 0,8236 | passou (3/3) |
| `manejo_nematoide_soja.pdf` ou `milho_nematoides.pdf` | 0,7972 | passou (3/3) |
| `cereais_inverno_rotacao_culturas.pdf` | 0,7867 | passou (3/3) |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` | 0,8035 | falha conhecida (1/3) |

Os 27 resultados retornados ficaram acima do limiar de 0,5, na faixa de 0,77 a 0,88.

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
| 34 arquivos | 21 a 37 | íntegros |
| `manejo_nematoide_soja.pdf`, `milho_nematoides.pdf` | 15,7 e 14,6 | íntegros — densidade baixa explicada pelo conteúdo tabular |
| `trigo_desempenho_agronomico_rotacao_culturas.pdf` | 0,6 | **corrompido** |

Nenhum PDF escaneado sem OCR foi encontrado.

## Problema em aberto

**`trigo_desempenho_agronomico_rotacao_culturas.pdf` tem a camada de texto corrompida na origem.**

O arquivo abre e lê normalmente na tela — o defeito só aparece na extração, porque a fonte foi embutida sem o mapa que associa cada glifo à sua letra. "Henrique Pereira dos Santos" é extraído como `+HQULTXH3HUHLUDGRV6DQWRV`.

O deslocamento é de exatamente 29 posições na tabela de caracteres e a conversão inversa foi testada, mas descartada: os acentos não voltam, os espaços se perdem e **os números desaparecem por completo**. Como é um artigo experimental cujo valor está nos resultados numéricos (3.571 kg/ha contra 2.495 kg/ha, por exemplo), o texto recuperado viraria afirmação genérica sem o dado que a sustenta.

**Encaminhamento:** obter uma cópia íntegra junto à Embrapa Trigo, ou aplicar OCR. Até lá o documento está indexado mas localizável apenas pelo título.

## Resolvido

**Folders com tabela recuperados sem o cabeçalho.** A tabela de genótipos se divide em vários trechos e o cabeçalho que identifica as colunas aparecia uma única vez. Uma busca recuperava, com score 0,7768, um trecho de linhas soltas como `GNZ 7280PRO2 Geneze S R S`, sem nada indicando a qual nematoide cada letra se refere — o modelo poderia inverter as colunas e recomendar um híbrido suscetível como resistente.

Corrigido em `scripts/ingest-pdfs.mjs`, que repete o cabeçalho e a legenda em todos os trechos desses dois arquivos, e reindexado em 20/10/2026. Cada trecho recuperado agora chega ao modelo com a explicação das colunas junto.

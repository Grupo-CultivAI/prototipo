# Design system do CultivAI

Cores, raios, sombras e camadas das telas saem dos tokens de [`src/styles/variables.css`](../src/styles/variables.css). Cor ou medida escrita direto no código fica de fora de qualquer ajuste de contraste ou de tema, e foi assim que o app chegou a ter dois vermelhos de apagar e sete raios de canto diferentes.

**A regra:** em CSS e em `style={{ }}`, use `var(--token)`. Se nenhum token serve, crie um em `variables.css`, com um comentário dizendo para que serve, em vez de escrever o valor na tela.

**A exceção:** o email de recuperação de senha (`src/app/api/auth/esqueci-senha/route.js`) usa cores escritas por extenso, porque programas de email não entendem variáveis de CSS.

## Cores

| Token | Para quê |
| --- | --- |
| `--primary` | Botão principal, links, ícones da marca. Texto branco sobre ele: 5,02:1 |
| `--primary-dark` | Títulos, texto sobre fundo verde-claro, item ativo do menu. Texto branco sobre ele: 11,8:1 |
| `--primary-medium` | Só o degradê do cartão de boas-vindas do Painel |
| `--primary-tint-weak` / `--primary-tint` / `--primary-tint-strong` | Fundos verde-claros em transparência: dica, item marcado, passar o mouse |
| `--primary-line` | Borda de aviso de sucesso e de item marcado |
| `--primary-soft` | Fundo verde-claro opaco (ícone redondo, faixas) |
| `--bg` / `--surface` / `--surface-muted` | Fundo da página / cartões / campos e opções de formulário |
| `--surface-translucent` / `--surface-hover` | Topo translúcido da página inicial / passar o mouse num botão neutro |
| `--border` / `--placeholder` | Bordas e divisórias / esboço da tela enquanto carrega |
| `--text-primary` / `--text-secondary` | Texto principal (14:1) / texto de apoio (5,6:1 ou mais em todos os fundos) |
| `--on-dark-muted` / `--on-dark-faint` / `--on-dark-subtle` / `--on-dark-accent` | Texto e detalhes sobre o verde-escuro |
| `--erro` | Texto de erro e de ação de apagar (6,47:1) |
| `--erro-forte` | Fundo e borda de botão de apagar (texto branco: 4,83:1) |
| `--erro-fundo` / `--erro-fundo-forte` / `--erro-borda` | Fundo de aviso de erro / passar o mouse / borda |
| `--aviso` / `--aviso-forte` | Texto de aviso (7,1:1) / destaque "fecha logo" no calendário |
| `--aviso-icone` / `--aviso-fundo` / `--aviso-borda` | Ícones e filetes de aviso (não é texto) / fundo / borda |
| `--info` | Filete do aviso de chuva no Painel |
| `--risco-20` / `--risco-30` / `--risco-40` / `--risco-nenhum` | Calendário de plantio (ZARC): cada cor é um nível de risco |
| `--mapa-destaque` / `--mapa-onda` | Mapa do Painel: estado com cultivo / onda em volta do ponto |
| `--print-text` / `--print-line` | Só na impressão da conversa |

Antes de usar um texto novo sobre um fundo novo, confira o contraste (4,5:1 para texto normal). A checagem de acessibilidade do CI (`npm run acessibilidade`) mede isso em todas as telas.

## Raios

`--radius-xs` 4px · `--radius-sm` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 20px · `--radius-2xl` 24px · `--radius-pill` 999px (botões e selos arredondados). Círculo continua `50%`.

## Sombras

| Token | Para quê |
| --- | --- |
| `--shadow-sm` / `--shadow-md` / `--shadow-lg` | Cartões, do mais rente ao mais alto |
| `--shadow-strong` | Balão do produtor no chat, item ativo do menu |
| `--shadow-up` | Barras presas no pé da tela (sombra para cima) |
| `--shadow-float` | Dica flutuante, marcador do mapa |
| `--shadow-primary` / `--shadow-primary-sm` | Botão principal grande / pequeno |
| `--focus-ring` / `--focus-ring-erro` | Campo em foco / campo com erro em foco |

## Camadas (z-index)

Da mais baixa para a mais alta: `--z-mapa` 0 · `--z-acima` 1 · `--z-barra` 5 (barra de Salvar) · `--z-lista` 20 (sugestões de um campo) · `--z-flutuante` 30 (menus e dicas) · `--z-navegacao` 40 (menu lateral, Fale conosco) · `--z-navegacao-celular` 50. Um elemento novo entra numa dessas camadas; um número solto acaba por cima do menu ou por baixo da barra sem ninguém saber por quê.

## Componentes

Ficam em [`src/components/ui/`](../src/components/ui/), em TypeScript: o editor sugere as variantes e uma variante errada vira erro no build.

### Botao

```tsx
import Botao from '@/components/ui/Botao';

<Botao onClick={salvar}>Salvar</Botao>                                   // principal, tamanho m
<Botao href="/meus-cultivos/novo" pilula icone={Plus}>Cadastrar cultivo</Botao>  // link com cara de botão
<Botao variante="neutro" tamanho="p" icone={Pencil}>Editar</Botao>
<Botao variante="discreto" apenasIcone icone={X} rotulo="Tirar esta safra" />   // só ícone: rotulo é obrigatório
<Botao type="submit" tamanho="g" larguraTotal carregando={enviando} textoCarregando="Salvando...">Salvar senha nova</Botao>
```

| Variante | Para quê |
| --- | --- |
| `principal` | A ação principal da tela: uma por tela, de preferência |
| `secundario` | Ação importante, mas não a principal (Nova conversa, Perguntar sobre este cultivo, Trocar senha) |
| `neutro` | Ações comuns (Editar, Ver no Painel, Cancelar, Imprimir) |
| `discreto` | Ícones de apoio, sem borda (ouvir, avaliar, copiar, tirar um item) |
| `perigo` | Confirmar uma exclusão (fundo vermelho) |
| `perigoDiscreto` | Abrir uma exclusão ou sair da conta (texto vermelho, sem fundo) |
| `claro` | Sobre o verde-escuro (cartão de boas-vindas do Painel, Fale conosco da página inicial) |

Tamanhos: `p` (36 px de altura; 40 no celular), `m` (44 px), `g` (52 px). Com `aria-pressed` ou `aria-expanded` verdadeiro, `neutro` e `discreto` ficam verdes (ligado ou aberto). Com `href`, vira link (`<Link>`; `<a>` para `http` e `mailto:`). Não usa hooks: serve também nas páginas de servidor.

### Aviso

```tsx
<Aviso tipo="erro">{erro}</Aviso>            // anunciado na hora (role="alert")
<Aviso tipo="sucesso">Cultivo salvo.</Aviso> // anunciado sem interromper (role="status")
<Aviso tipo="alerta" papel="note">...</Aviso> // já vem na página: não é anunciado
```

Tipos: `erro`, `alerta`, `sucesso`, `info`. Sempre com ícone, para a cor não ser a única pista.

### Selo

`<Selo tipo="ok">Completo</Selo>`. Tipos: `ok` (com ✓), `falta`, `erro` (com ícone), `neutro`, `destaque` (verde cheio).

### ConfirmarNaTela

Para apagar ou excluir algo, no lugar do `confirm()` do navegador. O foco vai para "Cancelar", Esc cancela, e se `aoConfirmar` lançar um erro a mensagem aparece na própria confirmação. Quem abre devolve o foco ao botão de origem em `aoCancelar`.

```tsx
<ConfirmarNaTela pergunta="Excluir este cultivo? Sua conta e suas conversas continuam."
  rotuloConfirmar="Excluir" textoOcupado="Excluindo..." aoConfirmar={excluir} aoCancelar={fechar} />
```

`aparencia="faixa"` destaca em vermelho-claro (usado no chat); o padrão, `linha`, cabe dentro de um cartão.

## Ainda por fazer

Os componentes de formulário (campo, opções clicáveis, bloco do formulário, barra de ações) e os tamanhos de texto e espaçamentos entram no próximo PR. Ficam fora do `Botao`, de propósito, os itens de menu e de lista (menu "Mais" e lista de conversas do chat), o anel do contador de perguntas e o botão de mostrar a senha.

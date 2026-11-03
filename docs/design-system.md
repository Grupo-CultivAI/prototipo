# Design system do CultivAI

Cores, raios, sombras e camadas das telas saem dos tokens de [`src/styles/variables.css`](../src/styles/variables.css). Cor ou medida escrita direto no código fica de fora de qualquer ajuste de contraste ou de tema, e foi assim que o app chegou a ter dois vermelhos de apagar e sete raios de canto diferentes.

**A regra:** em CSS e em `style={{ }}`, use `var(--token)`. Se nenhum token serve, crie um em `variables.css`, com um comentário dizendo para que serve, em vez de escrever o valor na tela.

**A exceção:** o email de recuperação de senha (`src/app/api/auth/esqueci-senha/route.js`) usa cores escritas por extenso, porque programas de email não entendem variáveis de CSS.

**Quem confere:** `npm run checar-tokens` (`tests/tokens.mjs`) procura cor escrita fora dos tokens (hexadecimal, `rgb`/`hsl` e nomes como `white`) e roda no CI a cada PR. Comentários ficam de fora.

**Catálogo:** com o `npm run dev` no ar, [http://localhost:3000/componentes](http://localhost:3000/componentes) mostra os tokens de cor e cada componente em todas as variações. Em produção, o endereço não existe.

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

### Campo, Entrada, Selecao e AreaTexto

O rótulo, a dica e o erro já chegam ligados ao controle (`htmlFor`/`id`, `aria-describedby`, `aria-invalid`): o leitor de tela lê o nome do campo e a mensagem, e tocar no rótulo leva ao campo. Funcionam com o `register` do react-hook-form.

```tsx
import Campo, { Entrada, Selecao, AreaTexto, classeDoControle } from '@/components/ui/Campo';

<Entrada rotulo="Nome do cultivo" obrigatorio erro={errors.nome?.message} dica="Aparece na lista e no chat." {...register('nome')} />
<Entrada rotulo="Senha" type="password" acessorio={<Link href="/esqueci-senha">Esqueci a senha</Link>} />  // com mostrar/esconder
<Selecao rotulo="Estado" obrigatorio {...register('estado')}><option value="">Selecione...</option></Selecao>
<AreaTexto rotulo="Observações" opcional rows={4} {...register('observacoes')} />
<Campo rotulo="Cidade" obrigatorio>{(ligacao) => <BuscaCidade idCampo={ligacao.id} classe={ligacao.className} ... />}</Campo>
```

`obrigatorio` mostra o `*` (escondido do leitor de tela, que ouve "obrigatório" pelo `aria-required`); `opcional` mostra "(opcional)" ou o texto dado; `invalido` marca o erro sem mensagem (quando ela está num `Aviso`). Para linhas com vários controles sem rótulo visível (safras, etapas do plano), `classeDoControle(true)` dá a aparência compacta; nesses, o nome vai em `aria-label`.

### Opcoes e Marcar

```tsx
<Opcoes rotulo="O que pretende plantar?" opcoes={CULTURAS} marcadas={[valor]} alternar={escolher} />  // botões com aria-pressed, num grupo com nome
<Marcar {...register('objetivos')} value="Recuperar solo">Recuperar solo</Marcar>                  // caixa de marcar num cartão
```

### Bloco

O bloco que abre e fecha do formulário do cultivo: cabeçalho com ícone, título, descrição e o `Selo` da situação, que fica embaixo da descrição para nunca alargar a página. O título leva o id `secao-<id>`.

### BarraDeAcoes

A barra presa no pé da tela com a mensagem do envio e os botões. Reserva espaço para o foco não cair atrás dela (`scroll-padding`). No celular, os botões ficam no tamanho médio; use `<TextoAdaptavel longo="Salvar e pedir análise à IA" curto="Salvar e analisar" />` para um texto curto.

## Letra grande e telas estreitas

Medidas em `rem` crescem com a letra que a pessoa escolheu no aparelho. Para algo mudar de arranjo quando falta espaço, prefira quebrar linha (`flex-wrap`) ou uma consulta de contêiner em `rem` (`@container (max-width: 20rem)`), como o campo do chat, a uma media query em `px`: ela não percebe a letra aumentada. Para conferir, há o roteiro do teste com personas (letra em 130% num celular de 360 px e em 150% num de 320 px).

## Fora dos componentes, de propósito

Os itens de menu e de lista (menu "Mais" e lista de conversas do chat), as sugestões de pergunta do chat e o anel do contador de perguntas têm estilo próprio na tela.

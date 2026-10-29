import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarDays, CloudRain, Sprout, Mic, ShieldCheck, UserPlus, ClipboardList, MessageCircle, Mail } from "lucide-react";
import { usuarioLogado } from "@/lib/sessao";
import { linkFaleConosco } from "@/lib/faleConosco";
import styles from "./inicio.module.css";

// Página inicial: explica o CultivAI a quem chega pela primeira vez, antes do login ou do
// cadastro. Quem já entrou vê "Abrir o CultivAI" no lugar de "Criar conta".

export const metadata = {
  title: "CultivAI — rotação de culturas com inteligência artificial",
  description: "Assistente gratuito que ajuda pequenos produtores a decidir o que plantar, quando plantar e como cuidar do solo, com base em pesquisas da Embrapa e no calendário oficial de plantio do seu município.",
};

const FALE_CONOSCO = linkFaleConosco("/");

const RECURSOS = [
  { icone: BookOpen, titulo: "Respostas com base na Embrapa", texto: "O CultivAI consulta publicações da Embrapa sobre rotação de culturas e manejo do solo, e mostra quais documentos usou." },
  { icone: CalendarDays, titulo: "Época de plantio do seu município", texto: "Mostra a janela oficial de plantio (ZARC, do Ministério da Agricultura) para a sua cidade e o seu solo. É ela que o Proagro e o seguro rural exigem." },
  { icone: CloudRain, titulo: "Chuva dos próximos dias", texto: "Para plantar, adubar ou colher, o assistente considera a previsão do tempo da sua cidade." },
  { icone: Sprout, titulo: "Feito para a sua terra", texto: "Você conta o tipo de solo, o que já plantou e o que pretende plantar. As respostas levam isso em conta." },
  { icone: Mic, titulo: "Fale e ouça", texto: "Pode fazer a pergunta falando e ouvir a resposta em voz alta, direto do celular." },
  { icone: ShieldCheck, titulo: "Orientação responsável", texto: "O CultivAI não indica produto nem dose de agrotóxico. Para isso, orienta procurar um engenheiro agrônomo." },
];

const PASSOS = [
  { icone: UserPlus, titulo: "Crie sua conta", texto: "Só nome, email e senha. É gratuito." },
  { icone: ClipboardList, titulo: "Conte sobre a sua área", texto: "No Meu Cultivo: cidade, tipo de solo e as culturas dos últimos anos. Leva poucos minutos." },
  { icone: MessageCircle, titulo: "Pergunte", texto: "\"O que plantar depois do milho?\", \"Quando planto feijão?\". Escreva ou fale, do jeito que preferir." },
];

const PERGUNTAS = [
  { p: "O CultivAI é pago?", r: "Não. É gratuito, sem anúncios. Cada pessoa pode fazer até 40 perguntas por dia." },
  { p: "Preciso entender de tecnologia?", r: "Não. Funciona no navegador do celular ou do computador, como uma conversa." },
  { p: "As respostas substituem a assistência técnica?", r: "Não. O CultivAI é uma ferramenta de apoio à tomada de decisão: ajuda a planejar e tirar dúvidas, mas não substitui os profissionais da área. Decisões importantes devem ser confirmadas com a assistência técnica, como a Emater, ou com um engenheiro agrônomo." },
  { p: "O que acontece com os meus dados?", r: "Os dados da sua propriedade servem só para personalizar as respostas. Você pode corrigir ou apagar tudo quando quiser, e excluir a conta a qualquer momento." },
];

export default async function Inicio() {
  const logado = await usuarioLogado();
  const principal = logado ? { href: "/painel", texto: "Abrir o CultivAI" } : { href: "/cadastro", texto: "Criar conta grátis" };

  return (
    <div className={styles.pagina}>
      {/* Abertura */}
      <section className={styles.abertura}>
        <div className={styles.aberturaTexto}>
          <span className={styles.selo}>Gratuito · Projeto de extensão do IFSP Campus Pirituba</span>
          <h1>Decida o que plantar, e quando, com mais segurança</h1>
          <p className={styles.chamada}>
            O CultivAI é um assistente que ajuda pequenos produtores a planejar a <strong>rotação de culturas</strong>:
            o que plantar depois da safra atual, a época certa para o seu município e como cuidar do solo.
            As respostas se baseiam em pesquisas da Embrapa e no calendário oficial de plantio.
          </p>
          <div className={styles.botoes}>
            <Link href={principal.href} className={styles.botaoPrincipal}>{principal.texto}</Link>
            {!logado && <Link href="/login" className={styles.botaoSecundario}>Já tenho conta</Link>}
          </div>
        </div>
        <div className={styles.aberturaImagem}>
          <Image src="/inicio/lavoura.svg" alt="" width={640} height={480} priority className={styles.ilustracao} />
          {/* Exemplo de conversa: texto de verdade, não imagem, para ser lido também pelo leitor de tela */}
          <div className={styles.exemplo} aria-label="Exemplo de conversa com o CultivAI">
            <p className={styles.exemploPergunta}>Quando posso plantar feijão aqui em Uberlândia?</p>
            <p className={styles.exemploResposta}>
              🗓️ Pelo calendário oficial (ZARC), a janela mais segura para o feijão de sequeiro em solo argiloso
              vai de <strong>11/10 a 31/12</strong>. A previsão indica chuva na segunda: aproveite a umidade para semear.
            </p>
          </div>
        </div>
      </section>

      {/* O que faz */}
      <section id="o-que-faz" className={styles.secao}>
        <h2>O que o CultivAI faz por você</h2>
        <p className={styles.subtitulo}>Informação de pesquisa, em linguagem simples, pensada para a realidade da sua propriedade.</p>
        <ul className={styles.recursos}>
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo} className={styles.cartao}>
              <span className={styles.icone}><Icone size={24} aria-hidden="true" /></span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Por que rotação */}
      <section className={`${styles.secao} ${styles.rotacao}`}>
        <Image src="/inicio/rotacao.svg" alt="" width={360} height={360} className={styles.ilustracaoRotacao} />
        <div>
          <h2>Por que fazer rotação de culturas?</h2>
          <p>
            Plantar sempre a mesma cultura na mesma área cansa o solo e favorece pragas, doenças e plantas daninhas.
            Alternar culturas, como milho, feijão e adubo verde, ajuda a <strong>recuperar a fertilidade</strong>,
            a <strong>quebrar o ciclo de pragas e nematoides</strong> e a <strong>reduzir gastos com adubo</strong>.
          </p>
          <p>O difícil é saber qual sequência combina com a sua terra e o seu clima. É aí que o CultivAI ajuda.</p>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className={styles.secao}>
        <h2>Como funciona</h2>
        <ol className={styles.passos}>
          {PASSOS.map(({ icone: Icone, titulo, texto }, i) => (
            <li key={titulo} className={styles.passo}>
              <span className={styles.numero} aria-hidden="true">{i + 1}</span>
              <Icone size={28} aria-hidden="true" className={styles.iconePasso} />
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ol>
        <div className={styles.botoesCentro}>
          <Link href={principal.href} className={styles.botaoPrincipal}>{logado ? "Abrir o CultivAI" : "Começar agora"}</Link>
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section id="duvidas" className={styles.secao}>
        <h2>Dúvidas frequentes</h2>
        <div className={styles.duvidas}>
          {PERGUNTAS.map(({ p, r }) => (
            <details key={p} className={styles.duvida}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Sobre e contato */}
      <section id="sobre" className={`${styles.secao} ${styles.sobre}`}>
        <div>
          <h2>Sobre o projeto</h2>
          <p>
            O CultivAI é um projeto de extensão do Instituto Federal de São Paulo (IFSP), Campus Pirituba, desenvolvido por estudantes
            para levar informação técnica sobre rotação de culturas a pequenos produtores e à agricultura familiar, de graça.
          </p>
          <p>
            É uma <strong>ferramenta de apoio à tomada de decisão</strong>: orienta e ajuda a planejar, mas não substitui
            os profissionais da área. Para decisões importantes, procure a Emater da sua região ou um engenheiro agrônomo.
          </p>
        </div>
        <div className={styles.contato}>
          <Mail size={32} aria-hidden="true" />
          <h3>Fale conosco</h3>
          <p>Dúvidas, sugestões ou quer levar o CultivAI para a sua comunidade? Escreva para a equipe.</p>
          <a href={FALE_CONOSCO} className={styles.botaoPrincipal}>Fale conosco</a>
        </div>
      </section>

      <footer className={styles.rodape}>
        <span>CultivAI · Projeto de extensão do IFSP Campus Pirituba</span>
        <nav aria-label="Rodapé">
          <Link href="/privacidade">Privacidade</Link>
          <a href={FALE_CONOSCO}>Contato</a>
          {!logado && <Link href="/login">Entrar</Link>}
        </nav>
      </footer>
    </div>
  );
}

import Link from "next/link"
import styles from "../conta.module.css"

export const metadata = { title: "Aviso de privacidade | CultivAI" }

// Linguagem simples, para o produtor rural. Ao mudar o que o app coleta ou com quem
// compartilha, atualize este texto e a data abaixo.
const ATUALIZADO_EM = "26 de outubro de 2026"
// Mesma conta que envia os emails de recuperação de senha (SMTP_USER na Vercel).
const CONTATO = "pex.ifsp@gmail.com"

const secoes = [
  {
    titulo: "Quem somos",
    texto: ["O CultivAI é um projeto de extensão do Instituto Federal de São Paulo (IFSP), Campus Pirituba, que ajuda pequenos agricultores a planejar a rotação de culturas, com respostas baseadas em documentos da Embrapa. O uso é gratuito."],
  },
  {
    titulo: "Quais dados guardamos",
    lista: [
      "Conta: nome, email e senha. A senha é guardada criptografada; nem a equipe consegue lê-la.",
      "Meu Cultivo: o que você preencher sobre a propriedade, como cidade, tipo de solo, culturas, irrigação e objetivos.",
      "Conversas: as perguntas que você faz, as respostas do CultivAI e as avaliações 👍/👎 que você der.",
      "Data em que você aceitou este aviso.",
    ],
  },
  {
    titulo: "Para que usamos",
    lista: [
      "Para responder às suas perguntas levando em conta a sua propriedade.",
      "Para melhorar o CultivAI: a equipe analisa as respostas avaliadas como ruins e as perguntas que a base de documentos não cobre, sem identificar quem perguntou.",
      "Não vendemos seus dados e não usamos para propaganda.",
    ],
  },
  {
    titulo: "Com quem os dados são compartilhados",
    texto: ["Para funcionar, o CultivAI usa serviços de outras empresas, algumas fora do Brasil. Cada uma recebe só o necessário:"],
    lista: [
      "Groq (inteligência artificial que escreve as respostas): recebe a sua pergunta, as mensagens anteriores da conversa e um resumo do seu Meu Cultivo. Não recebe seu nome nem seu email.",
      "Google Gemini: recebe o texto da pergunta, para encontrar os trechos da Embrapa relacionados.",
      "OpenWeather: recebe só o nome da sua cidade, para informar o clima atual.",
      "MongoDB Atlas (banco de dados, em servidores em São Paulo) e Vercel (hospedagem do site): guardam e entregam os dados do aplicativo.",
    ],
  },
  {
    titulo: "Cookies",
    texto: ["Usamos um único cookie, para manter você conectado por até 7 dias. Ele não é usado para rastrear você em outros sites."],
  },
  {
    titulo: "Seus direitos",
    lista: [
      "Corrigir ou apagar os dados da propriedade: edite o Meu Cultivo a qualquer momento, ou use \"Apagar dados da propriedade\" no fim da página.",
      "Apagar conversas: use o botão \"Apagar conversa\" no chat. As perguntas das últimas 24 horas ficam registradas por um dia, sem o texto, só para controlar o limite diário de perguntas.",
      "Excluir a conta: em Minha Conta, use \"Excluir minha conta\". Tudo o que está guardado nela é apagado na hora: conta, Meu Cultivo, conversas e avaliações.",
      `Pedir uma cópia dos seus dados: escreva para ${CONTATO}, o email do projeto.`,
    ],
  },
]

export default function Privacidade() {
  return (
    <div className={styles.fundo}>
      <article className={styles.cartao} style={{ maxWidth: "760px", lineHeight: 1.6 }}>
        <h1 className={styles.titulo}>Aviso de privacidade</h1>
        <p className={styles.subtitulo} style={{ marginBottom: "2rem" }}>Atualizado em {ATUALIZADO_EM}.</p>

        {secoes.map(({ titulo, texto, lista }) => (
          <section key={titulo} style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.2rem", color: "var(--primary-dark)", marginBottom: "0.5rem" }}>{titulo}</h2>
            {texto?.map((t) => <p key={t} style={{ color: "var(--text-primary)" }}>{t}</p>)}
            {lista && (
              <ul style={{ paddingLeft: "1.25rem", color: "var(--text-primary)", marginTop: texto ? "0.5rem" : 0 }}>
                {lista.map((item) => <li key={item} style={{ marginBottom: "0.4rem" }}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "1.2rem", color: "var(--primary-dark)", marginBottom: "0.5rem" }}>Contato</h2>
          <p style={{ color: "var(--text-primary)" }}>
            Dúvidas sobre os seus dados: <a href={`mailto:${CONTATO}`} style={{ color: "var(--primary-dark)", fontWeight: 600 }}>{CONTATO}</a>
          </p>
        </section>

        <p className={styles.rodape}>
          <Link href="/cadastro">Voltar para o cadastro</Link>
        </p>
      </article>
    </div>
  )
}

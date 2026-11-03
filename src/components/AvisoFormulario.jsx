import { AlertCircle, CheckCircle2 } from "lucide-react";

// Mensagem dentro do formulário (login, cadastro), no lugar do alert() do navegador.
// role="alert" faz o leitor de tela anunciar a mensagem assim que ela aparece.
const CORES = {
  erro: { fundo: "var(--erro-fundo)", borda: "var(--erro-borda)", texto: "var(--erro)", Icone: AlertCircle },
  sucesso: { fundo: "var(--primary-tint)", borda: "var(--primary-line)", texto: "var(--primary-dark)", Icone: CheckCircle2 },
};

export default function AvisoFormulario({ tipo = "erro", children }) {
  const { fundo, borda, texto, Icone } = CORES[tipo];
  return (
    <div role="alert" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", padding: "0.85rem 1rem", borderRadius: "var(--radius-md)", background: fundo, border: `1px solid ${borda}`, color: texto, fontSize: "0.92rem", lineHeight: 1.45 }}>
      <Icone size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
      <div>{children}</div>
    </div>
  );
}

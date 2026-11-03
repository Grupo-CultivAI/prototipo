// Cabeçalhos de segurança em todas as respostas (revisão de engenharia, 03/11/2026):
// - nenhum outro site pode abrir o CultivAI dentro de um quadro (iframe), o que permitiria
//   enganar a pessoa e fazê-la clicar sem ver, por exemplo, em "Excluir minha conta";
// - o navegador não "adivinha" o tipo de um arquivo diferente do que o servidor diz;
// - outros sites não recebem o endereço completo das páginas (que pode ter o código do link de
//   troca de senha), só o domínio;
// - só o próprio CultivAI usa o microfone (pergunta por voz no chat) e a localização ("Usar
//   minha localização" no cultivo); câmera, nunca.
// Uma política de scripts (Content-Security-Policy completa) ficou de fora: o Next e o mapa
// usam scripts e estilos na linha, e uma política errada quebraria telas sem aviso.
const CABECALHOS_DE_SEGURANCA = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: CABECALHOS_DE_SEGURANCA }];
  },
};

export default nextConfig;

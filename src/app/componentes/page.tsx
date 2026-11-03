import { notFound } from 'next/navigation';
import Catalogo from './Catalogo';

export const metadata = { title: 'Componentes · CultivAI' };

// Catálogo do design system: cada componente de src/components/ui em todas as variações, para
// quem vai montar uma tela nova ver o que já existe (regras em docs/design-system.md).
// Só no npm run dev: na Vercel (produção), o endereço responde "não encontrada".
export default function Componentes() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <Catalogo />;
}

import FormularioCultivo from '../FormularioCultivo';

export const metadata = { title: 'Editar cultivo · CultivAI' };

// ?bloco=plano abre o formulário já no bloco do plano (link "Ver e ajustar o plano" do chat).
// Lido aqui, no servidor, para a página já chegar com o bloco aberto.
const BLOCOS = ['localizacao', 'solo', 'historico', 'objetivo', 'plano'];

export default async function EditarCultivo({ params, searchParams }) {
    const { id } = await params;
    const { bloco } = await searchParams;
    return <FormularioCultivo id={id} blocoInicial={BLOCOS.includes(bloco) ? bloco : undefined} />;
}

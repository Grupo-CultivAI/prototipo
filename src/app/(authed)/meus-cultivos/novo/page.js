import FormularioCultivo from '../FormularioCultivo';

export const metadata = { title: 'Novo cultivo · CultivAI' };

// ?copiar=id: "Duplicar" no cartão de Meus Cultivos.
export default async function NovoCultivo({ searchParams }) {
    const { copiar } = await searchParams;
    return <FormularioCultivo copiarDe={typeof copiar === 'string' ? copiar : undefined} />;
}

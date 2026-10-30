import FormularioCultivo from '../FormularioCultivo';

export const metadata = { title: 'Editar cultivo · CultivAI' };

export default async function EditarCultivo({ params }) {
    const { id } = await params;
    return <FormularioCultivo id={id} />;
}

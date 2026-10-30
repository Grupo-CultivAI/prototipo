import { redirect } from 'next/navigation';

// O "Meu Cultivo" virou Meus Cultivos (30/10/2026). Links antigos (favoritos, emails) continuam funcionando.
export default function PerfilPropriedade() {
    redirect('/meus-cultivos');
}

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Roda antes das páginas logadas (o "middleware" do Next, renomeado para proxy no Next 16).
// Sem cookie de sessão válido, a pessoa vai para o login antes de a página carregar; antes,
// a página abria e só depois descobria que não havia sessão.
//
// Aqui só se confere a assinatura do cookie, sem consultar o banco (isso rodaria a cada
// página). Uma conta excluída com cookie ainda válido passa, e a própria página manda para
// o login quando /api/user responde que a conta não existe.
export async function proxy(req: NextRequest) {
    const token = req.cookies.get('authToken')?.value;
    if (token && process.env.JWT_SECRET) {
        try {
            await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
            return NextResponse.next();
        } catch {
            // cookie vencido ou adulterado: segue para o login
        }
    }
    return NextResponse.redirect(new URL('/login', req.url));
}

// Páginas logadas. O Next exige a lista escrita literalmente (nada calculado).
export const config = {
    matcher: ['/chatbot/:path*', '/perfil-propriedade/:path*', '/conta/:path*'],
};

import { SignJWT } from 'jose';

// O cookie de sessão é httpOnly: o JavaScript da página não consegue lê-lo nem apagá-lo, só o
// servidor. Gravado no login e na troca de senha; apagado pelo logout e pela exclusão de conta.

const DIAS_DE_SESSAO = 7;
const opcoes = (maxAge) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/',
});

// versaoSessao vai no cookie (campo v): quando a senha muda, a versão da conta sobe e as
// sessões abertas antes deixam de valer (src/lib/auth.ts).
export async function gravarCookieSessao(response, user) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
    const jwt = await new SignJWT({ id: user._id.toString(), v: user.versaoSessao ?? 0, email: user.email, nome: user.nome })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${DIAS_DE_SESSAO}d`)
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    response.cookies.set('authToken', jwt, opcoes(DIAS_DE_SESSAO * 24 * 60 * 60));
    return response;
}

export function apagarCookieSessao(response) {
    response.cookies.set('authToken', '', opcoes(0));
    return response;
}

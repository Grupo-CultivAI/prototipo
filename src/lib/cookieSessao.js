// O cookie de sessão é httpOnly: o JavaScript da página não consegue apagá-lo, só o servidor.
// Usado pelo logout e pela exclusão de conta.
export function apagarCookieSessao(response) {
    response.cookies.set('authToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    });
    return response;
}

import { NextResponse } from 'next/server';

// O cookie de sessão é httpOnly: o JavaScript da página não consegue apagá-lo, então o
// "Sair" antigo (document.cookie = ...) deixava a pessoa conectada. Só o servidor apaga.
export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set('authToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    });
    return response;
}

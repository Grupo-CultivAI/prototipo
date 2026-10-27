import { NextResponse } from 'next/server';
import { apagarCookieSessao } from '@/lib/cookieSessao';

// O "Sair" antigo (document.cookie = ...) deixava a pessoa conectada: o cookie é httpOnly.
export async function POST() {
    return apagarCookieSessao(NextResponse.json({ success: true }));
}

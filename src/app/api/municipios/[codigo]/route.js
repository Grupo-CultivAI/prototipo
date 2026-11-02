import { NextResponse } from 'next/server';
import mapa from '@/lib/dados/mapa-brasil.json';

// Centro do município (malha do IBGE), para o mapa do formulário do cultivo abrir na cidade
// escolhida. Dado público; o arquivo fica só no servidor (são 5.570 municípios).
export async function GET(req, { params }) {
    const { codigo } = await params;
    const centro = /^\d{7}$/.test(codigo) ? mapa.centros[codigo] : null;
    if (!centro) return NextResponse.json({ message: 'Município não encontrado.' }, { status: 404 });
    return NextResponse.json(
        { lat: centro[1], lng: centro[0] },
        { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
}

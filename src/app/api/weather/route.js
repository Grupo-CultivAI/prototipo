import { NextResponse } from 'next/server';

const API_KEY = process.env.OPENWEATHER_API_KEY;

export async function GET(req) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'OPENWEATHER_API_KEY não definido' },
      { status: 500 }
    );
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  const city = req.nextUrl.searchParams.get('city');
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');

  if (lat && lon) {
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
  } else if (city) {
    url.searchParams.set('q', city);
  } else {
    return NextResponse.json(
      { error: 'city ou lat/lon são obrigatórios' },
      { status: 400 }
    );
  }

  url.searchParams.set('appid', API_KEY);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'pt_br');

  const response = await fetch(url.toString());
  const data = await response.json();

  return NextResponse.json(data, { status: response.status });
}
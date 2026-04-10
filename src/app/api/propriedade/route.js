import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import Propriedade from '@/models/Propriedade';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback_secret'
);

async function getUserIdFromToken() {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.id;
    } catch (error) {
        return null;
    }
}

export async function GET(req) {
    try {
        await dbConnect();
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const prop = await Propriedade.findOne({ userId });
        return NextResponse.json({ success: true, propriedade: prop || null });
    } catch (err) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await dbConnect();
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const data = await req.json();
        const prop = await Propriedade.findOneAndUpdate(
            { userId },
            { ...data, userId },
            { new: true, upsert: true }
        );
        return NextResponse.json({ success: true, propriedade: prop });
    } catch (err) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback_secret'
);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('authToken')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const user = await User.findById(payload.id).select('-senha');

        if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });
        return NextResponse.json({ user });
    } catch (error) {
        console.error('API User Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

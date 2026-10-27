import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { getUserIdFromToken } from '@/lib/auth';

export async function GET() {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        // Nunca devolver ao navegador a senha nem o código de recuperação, mesmo em hash.
        const user = await User.findById(userId).select('-senha -resetSenhaHash -resetSenhaExpira');

        if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });
        return NextResponse.json({ user });
    } catch (error) {
        console.error('API User Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

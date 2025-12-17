import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json(null);
        }

        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                banned: true,
            },
        });

        if (!user) {
            return NextResponse.json(null);
        }

        return NextResponse.json({
            user: {
                ...session.user,
                role: user.role,
                banned: user.banned,
            },
            session: session.session,
        });
    } catch (error) {
        console.error("[GET_SESSION_STATUS]", error);
        return NextResponse.json(null);
    }
}
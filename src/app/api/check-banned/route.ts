import { db } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        const user = await db.user.findUnique({
            where: { username },
            select: { 
                banned: true,
                role: true,
            },
        });

        if (!user) {
            return NextResponse.json({ banned: false });
        }

        return NextResponse.json({ 
            banned: user.banned,
            role: user.role,
        });
    } catch (error) {
        console.error("[CHECK_BANNED]", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
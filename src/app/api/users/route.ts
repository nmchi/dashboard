import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/users
 * Lấy danh sách users
 * 
 * Query params:
 * - parentId: Lấy users con của parent (Agent lấy Players của mình)
 * - role: Lọc theo role (AGENT, PLAYER)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const parentId = searchParams.get('parentId');
        const role = searchParams.get('role') as Role | null;
        
        const where: Record<string, unknown> = {};
        
        if (parentId) {
            where.parentId = parentId;
        }
        
        if (role) {
            where.role = role;
        }
        
        const users = await db.user.findMany({
            where,
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                banned: true,
                betSettings: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        
        return NextResponse.json({
            success: true,
            data: users,
        });
        
    } catch {
        return NextResponse.json({
            success: false,
            error: 'Đã xảy ra lỗi',
        }, { status: 500 });
    }
}
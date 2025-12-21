import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Role } from "@prisma/client";

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
        });
        
        return NextResponse.json({
            success: true,
            data: users,
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        return NextResponse.json({
            success: false,
            error: 'Đã xảy ra lỗi',
        }, { status: 500 });
    }
}
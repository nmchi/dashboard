'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { Role, Prisma } from "@prisma/client";
import { DEFAULT_BET_SETTINGS, BetSettings } from "@/types/bet-settings";

const PlayerSchema = z.object({
    username: z.string().min(3, "Tài khoản tối thiểu 3 ký tự").regex(/^[a-zA-Z0-9_]+$/, "Chỉ chứa chữ không dấu, số và gạch dưới"),
    name: z.string().optional(),
    banned: z.boolean().optional(),
    betSettings: z.custom<BetSettings>().optional(),
});

type CreatePlayerInput = z.infer<typeof PlayerSchema>;
type UpdatePlayerInput = Partial<CreatePlayerInput>;

async function checkAgent() {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user;
    if (!user || user.role !== "AGENT") throw new Error("Unauthorized: Bạn không phải Đại lý");
    return user.id;
}

export async function createPlayer(data: CreatePlayerInput) {
    try {
        const agentId = await checkAgent();

        // 1. Kiểm tra trùng username
        const exists = await db.user.findUnique({ where: { username: data.username } });
        if (exists) return { error: "Tên tài khoản đã tồn tại" };

        // 2. Lấy cấu hình giá của Agent để làm mẫu (Kế thừa)
        const agent = await db.user.findUnique({
            where: { id: agentId },
            select: { betSettings: true }
        });

        const baseSettings = (agent?.betSettings as unknown as BetSettings) || DEFAULT_BET_SETTINGS;
        
        const finalSettings = { ...baseSettings, ...(data.betSettings || {}) };

        await db.user.create({
            data: {
                username: data.username,
                name: data.name,
                role: Role.PLAYER,
                parentId: agentId,
                
                betSettings: finalSettings as unknown as Prisma.InputJsonValue, 
            }
        });

        revalidatePath("/agent/players");
        return { success: true, message: "Tạo người chơi thành công" };
    } catch (error) { 
        console.error("Create Player Error:", error);
        return { error: "Lỗi hệ thống khi tạo tài khoản" }; 
    }
}

export async function updatePlayer(id: string, data: UpdatePlayerInput) {
    try {
        const agentId = await checkAgent();

        const player = await db.user.findFirst({
            where: { id, parentId: agentId }
        });
        
        if (!player) return { error: "Không tìm thấy người chơi hoặc không thuộc quyền quản lý" };

        // Chuẩn bị dữ liệu update
        const updateData: Prisma.UserUpdateInput = { 
            name: data.name,
            banned: data.banned,
        };

        if (data.betSettings) {
            updateData.betSettings = data.betSettings as unknown as Prisma.InputJsonValue;
        }

        // Thực hiện Update
        await db.user.update({
            where: { id },
            data: updateData
        });

        revalidatePath("/agent/players");
        return { success: true, message: "Cập nhật thành công" };
    } catch (error) { 
        console.error("Update Player Error:", error);
        return { error: "Lỗi hệ thống khi cập nhật" }; 
    }
}

// --- XÓA PLAYER ---
export async function deletePlayer(id: string) {
    try {
        const agentId = await checkAgent();
        
        // Security Check: Chỉ xóa được con của mình
        const count = await db.user.count({ where: { id, parentId: agentId } });
        if (count === 0) return { error: "Không tìm thấy người chơi" };

        await db.user.delete({ where: { id } });
        
        revalidatePath("/agent/players");
        return { success: true, message: "Đã xóa tài khoản" };
    } catch (e) { 
        return { error: "Lỗi khi xóa (Có thể do ràng buộc dữ liệu vé cược)" }; 
    }
}
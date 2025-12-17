'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { Role, Prisma } from "@prisma/client";
import { DEFAULT_BET_SETTINGS, BetSettings } from "@/types/bet-settings";

// 1. Schema Validation
const PlayerSchema = z.object({
    name: z.string().min(1, "Vui lòng nhập tên khách (VD: Anh Ba)"),
    phoneNumber: z.string().optional(),
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

// Hàm sinh username ngẫu nhiên
function generateRandomUsername() {
    return `khach_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// --- TẠO PLAYER ---
export async function createPlayer(data: CreatePlayerInput) {
    try {
        // FIX LỖI 1: Sử dụng PlayerSchema để validate dữ liệu đầu vào (Runtime check)
        const validatedData = PlayerSchema.parse(data);

        const agentId = await checkAgent();

        // FIX LỖI 2: Dùng const thay vì let vì biến này không bị gán lại
        const finalPhone = validatedData.phoneNumber && validatedData.phoneNumber.trim() !== "" 
            ? validatedData.phoneNumber 
            : null;
        
        let finalUsername = "";

        if (finalPhone) {
            // Check trùng SĐT
            const exists = await db.user.findFirst({
                where: {
                    OR: [
                        { username: finalPhone },
                        { phoneNumber: finalPhone }
                    ]
                }
            });
            if (exists) return { error: "Số điện thoại này đã tồn tại trong hệ thống" };
            finalUsername = finalPhone;
        } else {
            finalUsername = generateRandomUsername();
        }

        const agent = await db.user.findUnique({
            where: { id: agentId },
            select: { betSettings: true }
        });
        const baseSettings = (agent?.betSettings as unknown as BetSettings) || DEFAULT_BET_SETTINGS;
        const finalSettings = { ...baseSettings, ...(validatedData.betSettings || {}) };

        await db.user.create({
        data: {
            username: finalUsername,
            name: validatedData.name,
            phoneNumber: finalPhone,
            role: Role.PLAYER,
            parentId: agentId,
            betSettings: finalSettings as unknown as Prisma.InputJsonValue,
        }
        });

        revalidatePath("/agent/players");
        return { success: true, message: `Đã thêm khách: ${validatedData.name}` };
    } catch (error) { 
        // FIX LỖI 3: Sử dụng biến error (log ra console)
        console.error("Create Player Error:", error);
        return { error: "Lỗi hệ thống khi tạo khách" }; 
    }
}

// --- CẬP NHẬT PLAYER ---
export async function updatePlayer(id: string, data: UpdatePlayerInput) {
    try {
        // Validate dữ liệu update (partial)
        const validatedData = PlayerSchema.partial().parse(data);
        
        const agentId = await checkAgent();
        const player = await db.user.findFirst({ where: { id, parentId: agentId } });
        if (!player) return { error: "Không tìm thấy khách" };

        const updateData: Prisma.UserUpdateInput = { 
            name: validatedData.name,
            banned: validatedData.banned,
            phoneNumber: validatedData.phoneNumber || null
        };

        if (validatedData.phoneNumber && validatedData.phoneNumber.trim() !== "") {
            updateData.username = validatedData.phoneNumber;
        }

        if (validatedData.betSettings) {
            updateData.betSettings = validatedData.betSettings as unknown as Prisma.InputJsonValue;
        }

        await db.user.update({ where: { id }, data: updateData });
        revalidatePath("/agent/players");
        return { success: true, message: "Cập nhật thành công" };
    } catch (error) { 
        console.error("Update Player Error:", error);
        return { error: "Lỗi cập nhật thông tin" }; 
    }
}

// --- XÓA PLAYER ---
export async function deletePlayer(id: string) {
    try {
        const agentId = await checkAgent();
        const count = await db.user.count({ where: { id, parentId: agentId } });
        if (count === 0) return { error: "Không tìm thấy khách hàng này" };
        
        await db.user.delete({ where: { id } });
        revalidatePath("/agent/players");
        return { success: true, message: "Đã xóa khách hàng" };
    } catch (e) { 
        // FIX LỖI 4: Sử dụng biến e (log ra console)
        console.error("Delete Player Error:", e);
        return { error: "Lỗi khi xóa (Có thể do ràng buộc dữ liệu)" }; 
    }
}
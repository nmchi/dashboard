'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/auth-guard";
import { z } from "zod";
import { Role, Prisma } from "@prisma/client";
import { DEFAULT_BET_SETTINGS, BetSettings } from "@/types/bet-settings";

const PlayerSchema = z.object({
    name: z.string().min(1, "Vui lòng nhập tên khách (VD: Anh Ba)"),
    phoneNumber: z.string().optional(),
    banned: z.boolean().optional(),
    betSettings: z.custom<BetSettings>().optional(),
});

type CreatePlayerInput = z.infer<typeof PlayerSchema>;
type UpdatePlayerInput = Partial<CreatePlayerInput>;

function generateRandomUsername() {
    return `khach_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export async function createPlayer(data: CreatePlayerInput) {
    try {
        const validatedData = PlayerSchema.parse(data);
        const agent = await requireAgent();

        const finalPhone = validatedData.phoneNumber && validatedData.phoneNumber.trim() !== "" 
            ? validatedData.phoneNumber 
            : null;
        
        let finalUsername = "";

        if (finalPhone) {
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

        const agentData = await db.user.findUnique({
            where: { id: agent.id },
            select: { betSettings: true }
        });
        const baseSettings = (agentData?.betSettings as unknown as BetSettings) || DEFAULT_BET_SETTINGS;
        const finalSettings = { ...baseSettings, ...(validatedData.betSettings || {}) };

        await db.user.create({
            data: {
                username: finalUsername,
                name: validatedData.name,
                phoneNumber: finalPhone,
                role: Role.PLAYER,
                parentId: agent.id,
                betSettings: finalSettings as unknown as Prisma.InputJsonValue,
            }
        });

        revalidatePath("/agent/players");
        return { success: true, message: `Đã thêm khách: ${validatedData.name}` };
    } catch (error) { 
        console.error("Create Player Error:", error);
        return { error: "Lỗi hệ thống khi tạo khách" }; 
    }
}

export async function updatePlayer(id: string, data: UpdatePlayerInput) {
    try {
        const validatedData = PlayerSchema.partial().parse(data);
        const agent = await requireAgent();
        
        const player = await db.user.findFirst({ where: { id, parentId: agent.id } });
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

export async function deletePlayer(id: string) {
    try {
        const agent = await requireAgent();
        const count = await db.user.count({ where: { id, parentId: agent.id } });
        if (count === 0) return { error: "Không tìm thấy khách hàng này" };
        
        await db.user.delete({ where: { id } });
        revalidatePath("/agent/players");
        return { success: true, message: "Đã xóa khách hàng" };
    } catch (error) { 
        console.error("Delete Player Error:", error);
        return { error: "Lỗi khi xóa (Có thể do ràng buộc dữ liệu)" }; 
    }
}
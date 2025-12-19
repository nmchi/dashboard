'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { z } from "zod";

const BetTypeSchema = z.object({
    name: z.string().min(1),
    aliases: z.string().min(1),
});

export async function createBetType(data: z.infer<typeof BetTypeSchema>) {
    try {
        await requireAdmin();
        await db.betType.create({ data });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { 
        console.error("Create bet type error:", error);
        return { error: "Lỗi tạo" }; 
    }
}

export async function updateBetType(id: string, data: z.infer<typeof BetTypeSchema>) {
    try {
        await requireAdmin();
        await db.betType.update({ where: { id }, data });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { 
        console.error("Update bet type error:", error);
        return { error: "Lỗi cập nhật" }; 
    }
}

export async function deleteBetType(id: string) {
    try {
        await requireAdmin();
        await db.betType.delete({ where: { id } });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { 
        console.error("Delete bet type error:", error);
        return { error: "Không thể xóa" }; 
    }
}
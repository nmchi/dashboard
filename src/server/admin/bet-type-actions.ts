'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const BetTypeSchema = z.object({
    name: z.string().min(1),
    aliases: z.string().min(1),
});

async function checkAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "ADMIN") throw new Error("Không có quyền");
}

export async function createBetType(data: z.infer<typeof BetTypeSchema>) {
    try {
        await checkAdmin();
        await db.betType.create({ data });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { return { error: "Lỗi tạo" }; }
}

export async function updateBetType(id: string, data: z.infer<typeof BetTypeSchema>) {
    try {
        await checkAdmin();
        await db.betType.update({ where: { id }, data });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { return { error: "Lỗi cập nhật" }; }
}

export async function deleteBetType(id: string) {
    try {
        await checkAdmin();
        await db.betType.delete({ where: { id } });
        revalidatePath("/admin/bet-types");
        return { success: true };
    } catch (error) { return { error: "Không thể xóa" }; }
}
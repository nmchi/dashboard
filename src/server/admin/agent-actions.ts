'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";

// 1. Action: Khóa / Mở khóa tài khoản
export async function toggleBanAgent(userId: string, currentBanStatus: boolean) {
    try {
        await requireAdmin();

        await db.user.update({
            where: { id: userId },
            data: { banned: !currentBanStatus }
        });

        revalidatePath("/admin/agents");
        return { success: true, message: currentBanStatus ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản" };
    } catch (error) {
        console.error("Toggle ban error:", error);
        return { error: "Lỗi khi cập nhật trạng thái" };
    }
}

// 2. Action: Xóa tài khoản vĩnh viễn
export async function deleteAgent(userId: string) {
    try {
        await requireAdmin();

        await db.user.delete({
            where: { id: userId }
        });

        revalidatePath("/admin/agents");
        return { success: true, message: "Đã xóa đại lý thành công" };
    } catch (error) {
        console.error("Delete agent error:", error);
        return { error: "Không thể xóa (Có thể do ràng buộc dữ liệu Player hoặc Đơn hàng)" };
    }
}
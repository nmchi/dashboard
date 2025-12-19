'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const PackageSchema = z.object({
    name: z.string().min(1, "Tên gói không được trống"),
    price: z.coerce.number().min(0, "Giá không hợp lệ"),
    durationDay: z.coerce.number().min(1, "Thời hạn tối thiểu 1 ngày"),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
});

type ActionResponse = {
    success?: boolean;
    error?: string;
    message?: string;
};

export async function createPackage(data: z.infer<typeof PackageSchema>): Promise<ActionResponse> {
    try {
        await requireAdmin();
        await db.subscriptionPackage.create({ data });
        revalidatePath("/admin/packages");
        return { success: true, message: "Tạo gói cước thành công" };
    } catch (error) { 
        console.error("Create package error:", error);
        return { error: "Lỗi khi tạo gói cước" }; 
    }
}

export async function updatePackage(id: string, data: z.infer<typeof PackageSchema>): Promise<ActionResponse> {
    try {
        await requireAdmin();
        await db.subscriptionPackage.update({ where: { id }, data });
        revalidatePath("/admin/packages");
        return { success: true, message: "Cập nhật gói cước thành công" };
    } catch (error) { 
        console.error("Update package error:", error);
        return { error: "Lỗi khi cập nhật gói cước" }; 
    }
}

export async function deletePackage(id: string): Promise<ActionResponse> {
    try {
        await requireAdmin();
        await db.subscriptionPackage.delete({ where: { id } });
        revalidatePath("/admin/packages");
        return { success: true, message: "Đã xóa vĩnh viễn gói cước." };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return { error: "Không thể xóa: Gói này đã có đơn hàng. Hãy vô hiệu hóa nó thay vì xóa." };
        }
        console.error("Delete package error:", error);
        return { error: "Lỗi hệ thống không thể xóa gói." }; 
    }
}
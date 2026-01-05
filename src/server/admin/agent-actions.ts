'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { DEFAULT_BET_SETTINGS } from "@/types/bet-settings";

interface CreateAgentInput {
    username: string;
    name: string;
    email?: string;
    phoneNumber?: string;
    password: string;
}

// 1. Action: Tạo đại lý mới
export async function createAgent(data: CreateAgentInput) {
    try {
        await requireAdmin();

        // Kiểm tra username đã tồn tại chưa
        const existingUser = await db.user.findUnique({
            where: { username: data.username }
        });

        if (existingUser) {
            return { error: "Tên đăng nhập đã tồn tại" };
        }

        // Kiểm tra email đã tồn tại chưa (nếu có)
        if (data.email) {
            const existingEmail = await db.user.findUnique({
                where: { email: data.email }
            });
            if (existingEmail) {
                return { error: "Email đã được sử dụng" };
            }
        }

        // Hash mật khẩu
        const hashedPassword = await hash(data.password, 12);

        // Tạo user với role AGENT
        await db.user.create({
            data: {
                username: data.username,
                name: data.name,
                email: data.email || null,
                phoneNumber: data.phoneNumber || null,
                password: hashedPassword,
                role: Role.AGENT,
                mustChangePassword: true, // Yêu cầu đổi mật khẩu lần đầu
                betSettings: DEFAULT_BET_SETTINGS as unknown as Prisma.InputJsonValue,
                accounts: {
                    create: {
                        providerId: 'credential',
                        accountId: data.username,
                        password: hashedPassword,
                    }
                }
            }
        });

        revalidatePath("/admin/agents");
        return { success: true, message: `Đã tạo đại lý "${data.name}" thành công` };
    } catch (error) {
        console.error("Create agent error:", error);
        return { error: "Lỗi khi tạo đại lý" };
    }
}

// 2. Action: Khóa / Mở khóa tài khoản
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

// 3. Action: Xóa tài khoản vĩnh viễn
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

// 4. Action: Reset mật khẩu cho Agent
export async function resetAgentPassword(userId: string, newPassword: string) {
    try {
        await requireAdmin();

        const hashedPassword = await hash(newPassword, 12);

        await db.$transaction([
            db.user.update({
                where: { id: userId },
                data: { 
                    password: hashedPassword,
                    mustChangePassword: true,
                }
            }),
            db.account.updateMany({
                where: { 
                    userId: userId,
                    providerId: 'credential'
                },
                data: { password: hashedPassword }
            }),
            // Xóa tất cả sessions để buộc đăng nhập lại
            db.session.deleteMany({
                where: { userId: userId }
            })
        ]);

        revalidatePath("/admin/agents");
        return { success: true, message: "Đã reset mật khẩu thành công" };
    } catch (error) {
        console.error("Reset password error:", error);
        return { error: "Lỗi khi reset mật khẩu" };
    }
}
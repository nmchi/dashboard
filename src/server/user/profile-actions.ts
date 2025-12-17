'use server'

import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { compare, hash } from "bcryptjs";

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
});

export async function changePassword(data: z.infer<typeof ChangePasswordSchema>) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const userId = session?.user?.id;
        
        if (!userId) return { error: "Bạn chưa đăng nhập" };

        const user = await db.user.findUnique({ 
            where: { id: userId },
            include: { accounts: true } 
        });
        
        if (!user) return { error: "Không tìm thấy tài khoản" };

        // --- CHECK MẬT KHẨU CŨ ---
        let isPasswordValid = false;
        if (user.password) {
            isPasswordValid = await compare(data.currentPassword, user.password);
        }
        if (!isPasswordValid) {
            const accountWithPass = user.accounts.find(a => a.password !== null && a.password !== "");
            if (accountWithPass && accountWithPass.password) {
                isPasswordValid = await compare(data.currentPassword, accountWithPass.password);
            }
        }

        if (!isPasswordValid) {
            return { error: "Mật khẩu hiện tại không đúng" };
        }

        // --- MÃ HÓA MỚI ---
        const hashedPassword = await hash(data.newPassword, 12);
        
        // --- THỰC HIỆN "NUCLEAR" UPDATE (Cập nhật Password + Xóa Session) ---
        await db.$transaction([
            // 1. Cập nhật User
            db.user.update({
                where: { id: userId },
                data: { password: hashedPassword }
            }),
            
            // 2. Cập nhật Account (Credential)
            db.account.updateMany({
                where: { 
                    userId: userId,
                    password: { not: null } 
                },
                data: { password: hashedPassword }
            }),

            // 3. THU HỒI SESSION TRỰC TIẾP (Fix lỗi TS của bạn tại đây)
            // Thay vì gọi auth.api, ta xóa thẳng trong DB. Nhanh và sạch sẽ.
            db.session.deleteMany({
                where: { userId: userId }
            })
        ]);

        return { success: true, message: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại." };
    } catch (error) {
        console.error("Change Password Error:", error);
        return { error: "Lỗi hệ thống khi đổi mật khẩu" };
    }
}
import { headers } from "next/headers";
import { auth } from "@/lib/auth"; 
import { redirect } from "next/navigation";
// Import layout chung mà chúng ta đã làm
import { DashboardLayout } from "@/components/layout/dashboard-layout"; 
// Import Type từ Prisma để fix lỗi 'any'
import { User, Role } from "@prisma/client"; 

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
    // 1. Lấy session
    const session = await auth.api.getSession({
        headers: await headers()
    });

    // 2. Chưa đăng nhập -> Login
    if (!session) redirect("/auth/login");

    // 3. SỬA LỖI TYPESCRIPT 'any':
    // Ép kiểu session.user về Type User chuẩn của Prisma
    const currentUser = session.user as unknown as User;

    // 4. Chặn quyền (Security)
    if (currentUser.role !== "AGENT") {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4">
                <h1 className="text-2xl font-bold text-red-600">Truy cập bị từ chối!</h1>
                <p className="text-slate-600">Tài khoản <strong>{currentUser.username}</strong> không có quyền Đại lý (AGENT).</p>
                <a href="/auth/login" className="text-blue-600 hover:underline">Quay về trang đăng nhập</a>
            </div>
        );
    }

    // 5. Chuẩn bị dữ liệu user để truyền vào Layout
    // Object này khớp với interface DashboardLayoutProps
    const layoutUser = {
        name: currentUser.name || "Agent",
        username: currentUser.username,
        role: currentUser.role, // "AGENT"
    };

    // 6. Tái sử dụng DashboardLayout
    return (
        <DashboardLayout user={layoutUser}>
            {children}
        </DashboardLayout>
    );
}
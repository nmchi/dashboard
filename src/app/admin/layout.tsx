import { headers } from "next/headers";
import { auth } from "@/lib/auth"; 
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) redirect("/");

    // Ép kiểu role cho TypeScript yên tâm
    const user = {
        name: session.user.name || "User",
        username: (session.user as any).username || session.user.email,
        role: (session.user as any).role || "PLAYER",
    };

    // Logic chặn quyền (Nếu cần chặn cứng ở tầng Server)
    if (user.role !== "ADMIN") {
        return <div className="p-8 text-red-500">Bạn không có quyền truy cập khu vực Admin</div>
    }

    return (
        <DashboardLayout user={user}>
        {children}
        </DashboardLayout>
    );
}
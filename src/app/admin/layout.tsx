import { headers } from "next/headers";
import { auth } from "@/lib/auth"; 
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) redirect("/");

    const user = {
        name: session.user.name || "User",
        username: (session.user as { username?: string }).username || session.user.email || "",
        role: (session.user as { role?: string }).role || "PLAYER",
    };

    if (user.role !== "ADMIN") {
        return <div className="p-8 text-red-500">Bạn không có quyền truy cập khu vực Admin</div>
    }

    return (
        <DashboardLayout user={user}>
            {children}
        </DashboardLayout>
    );
}
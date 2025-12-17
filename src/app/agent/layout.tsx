import { headers } from "next/headers";
import { auth } from "@/lib/auth"; 
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) redirect("/auth/login");

    const user = {
        name: session.user.name || "Agent",
        username: (session.user as { username?: string }).username || "",
        role: (session.user as { role?: string }).role || "PLAYER",
    }

    if (user.role !== "AGENT") {
        return <div className="p-8 text-red-500">Bạn không có quyền truy cập khu vực Agent</div>
    }

    return (
        <DashboardLayout user={user}>
            {children}
        </DashboardLayout>
    );
}
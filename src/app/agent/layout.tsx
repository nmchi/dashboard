import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getCurrentUser } from "@/lib/auth-session";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    if (!user) redirect("/");
    if (user.banned) redirect("/banned");
    if (user.role !== "AGENT") redirect("/unauthorized");

    return (
        <DashboardLayout user={{
            name: user.name || user.username,
            username: user.username,
            role: user.role,
        }}>
            {children}
        </DashboardLayout>
    );
}
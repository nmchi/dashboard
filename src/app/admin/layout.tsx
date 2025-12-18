import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getCurrentUser } from "@/lib/auth-session";

export default async function AdminRouteLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();

    if (!user) redirect("/");
    if (user.banned) redirect("/banned");
    if (user.role !== "ADMIN") redirect("/unauthorized");

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
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardLayoutProps {
    children: React.ReactNode;
    user: {
        name: string;
        username: string;
        role: string;
    };
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar userRole={user.role} />

            <div className="flex-1 flex flex-col">
                <Header user={user} />
                
                <main className="flex-1 p-3 md:p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
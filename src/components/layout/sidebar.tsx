'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { sidebarLinks } from "@/app/config/nav";

interface SidebarProps {
    userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const filteredLinks = sidebarLinks.filter((link) => 
        link.roles.includes(userRole)
    );

    const handleLogout = async () => {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/");
                    router.refresh();
                },
            },
        });
    };

    return (
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 h-screen flex-col sticky top-0">
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <span className="text-2xl font-bold text-blue-600">XSNHANH</span>
                <span className="ml-2 text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                    {userRole}
                </span>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {filteredLinks.map((link) => {
                    const Icon = link.icon;

                    let finalHref = link.href;
                    if (link.href === "/" || link.href === "/admin") {
                        if (userRole === "ADMIN") finalHref = "/admin";
                        else if (userRole === "AGENT") finalHref = "/agent";
                    }

                    let isActive = false;
                    if (finalHref === "/admin" || finalHref === "/agent") {
                        isActive = pathname === finalHref;
                    } else {
                        isActive = pathname === finalHref || pathname.startsWith(`${finalHref}/`);
                    }

                    return (
                        <Link key={link.href} href={finalHref}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 mb-1",
                                    isActive 
                                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800" 
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                {link.title}
                            </Button>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                    onClick={handleLogout} 
                >
                    <LogOut className="h-5 w-5" />
                    Đăng xuất
                </Button>
            </div>
        </aside>
    );
}
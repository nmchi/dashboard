'use client'

import { Menu, LogOut } from "lucide-react"; // Icon 3 gạch
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { useState } from "react";
import { sidebarLinks } from "@/app/config/nav";

interface MobileSidebarProps {
    userRole: string;
}

export function MobileSidebar({ userRole }: MobileSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false); // State để quản lý đóng/mở

    const filteredLinks = sidebarLinks.filter((link) => 
        link.roles.includes(userRole)
    );

    const handleLogout = async () => {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/");
                }
            }
        });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>

            <SheetContent side="left" className="p-0 flex flex-col w-72">
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="text-left text-blue-600 font-bold text-xl">
                        XSNHANH <span className="text-xs text-slate-500 font-normal">({userRole})</span>
                    </SheetTitle>
                </SheetHeader>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {filteredLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname.startsWith(link.href);

                        return (
                            <Link 
                                key={link.href} 
                                href={link.href}
                                onClick={() => setOpen(false)} // Bấm link xong thì tự đóng menu
                            >
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start gap-3 mb-1",
                                        isActive 
                                        ? "bg-blue-50 text-blue-700" 
                                        : "text-slate-600"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    {link.title}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t bg-slate-50">
                    <Button 
                        variant="outline" 
                        className="w-full justify-start gap-3 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5" />
                        Đăng xuất
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileSidebar } from "./mobile-sidebar"; // <--- Import mới

interface HeaderProps {
    user: {
        name: string;
        username: string;
        role: string; // <--- Cần thêm role vào đây để truyền cho MobileSidebar
    }
}

export function Header({ user }: HeaderProps) {
    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
        
            <div className="flex items-center gap-4">
                <MobileSidebar userRole={user.role} />

                <h2 className="text-lg font-semibold text-slate-800 hidden md:block">
                    Dashboard
                </h2>
            </div>

            <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">@{user.username}</p>
                </div>
                <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                        {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
}
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, FileText } from "lucide-react";
import Link from "next/link";

// Helper lấy thống kê riêng cho Agent
async function getAgentStats(agentId: string) {
    const [totalPlayers, activePlayers, bannedPlayers, pendingTickets] = await Promise.all([
        db.user.count({ 
            where: { parentId: agentId, role: "PLAYER" } 
        }),
        db.user.count({ 
            where: { parentId: agentId, role: "PLAYER", banned: false } 
        }),
        db.user.count({ 
            where: { parentId: agentId, role: "PLAYER", banned: true } 
        }),
        db.ticket.count({
            where: {
                user: { parentId: agentId },
                status: "PENDING"
            }
        })
    ]);

    return { totalPlayers, activePlayers, bannedPlayers, pendingTickets };
}

export default async function AgentDashboardPage() {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "AGENT") {
        redirect("/");
    }

    const stats = await getAgentStats(user.id);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Đại Lý</h1>
                    <p className="text-slate-500">Xin chào, {user.name || user.username}</p>
                </div>
            </div>

            {/* Grid Thống Kê */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng Khách Hàng</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalPlayers}</div>
                        <p className="text-xs text-muted-foreground">Tài khoản cấp dưới</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Đang Hoạt Động</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.activePlayers}</div>
                        <p className="text-xs text-muted-foreground">Sẵn sàng cược</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tài Khoản Bị Khóa</CardTitle>
                        <UserX className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.bannedPlayers}</div>
                        <p className="text-xs text-muted-foreground">Cần kiểm tra lại</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tin Chờ Xử Lý</CardTitle>
                        <FileText className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats.pendingTickets}</div>
                        <p className="text-xs text-muted-foreground">Tin nhắn chưa chốt</p>
                    </CardContent>
                </Card>
            </div>

            {/* Khu vực chức năng nhanh */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader><CardTitle>Quản lý nhanh</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 grid-cols-2">
                        <Link href="/agent/players" className="block">
                            <div className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer flex flex-col items-center text-center gap-2 transition-colors">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                                    <Users className="w-6 h-6" />
                                </div>
                                <span className="font-semibold text-slate-700">Danh sách Khách</span>
                                <span className="text-xs text-slate-500">Tạo mới, sửa giá, khóa tài khoản</span>
                            </div>
                        </Link>
                        <div className="p-4 border rounded-lg bg-slate-50 opacity-60 flex flex-col items-center text-center gap-2">
                            <div className="p-3 bg-slate-200 text-slate-500 rounded-full">
                                <FileText className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-slate-700">Soi Tin Nhắn</span>
                            <span className="text-xs text-slate-500">Chức năng sắp ra mắt</span>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="col-span-3">
                    <CardHeader><CardTitle>Thông báo hệ thống</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500 italic">Chưa có thông báo mới...</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
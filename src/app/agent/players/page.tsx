import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlayerDialog } from "@/components/agent/players/player-dialog"; // Đảm bảo bạn đã tạo file này từ bước trước
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { BetSettings, DEFAULT_BET_SETTINGS } from "@/types/bet-settings";

// Helper lấy session
async function getAgentSession() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.role !== 'AGENT') return null;
    return session.user;
}

interface PageProps { searchParams: Promise<{ q?: string }> }

export default async function AgentPlayersPage(props: PageProps) {
    const agent = await getAgentSession();
    if (!agent) redirect("/auth/login"); 

    const searchParams = await props.searchParams;
    const query = searchParams.q || "";

    // Query: Chỉ lấy user là con của Agent này
    const players = await db.user.findMany({
        where: {
            parentId: agent.id,
            role: 'PLAYER',
            username: { contains: query, mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Quản lý Khách chơi</h1>
                <p className="text-slate-500 text-sm">Quản lý tài khoản và cấu hình giá cho cấp dưới.</p>
            </div>
            <div className="flex items-center gap-2">
                <SearchInput placeholder="Tìm tài khoản..." />
                {/* Dialog Tạo mới */}
                <PlayerDialog />
            </div>
        </div>

        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Tên hiển thị</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {players.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">Chưa có khách nào. Hãy tạo mới!</TableCell></TableRow>
                ) : players.map((p) => {
                    // Xử lý betSettings: Nếu null thì dùng default để truyền vào Dialog không bị lỗi
                    const safePlayer = {
                        ...p,
                        betSettings: (p.betSettings as unknown as BetSettings) || DEFAULT_BET_SETTINGS
                    };

                    return (
                        <TableRow key={p.id} className={p.banned ? "bg-red-50" : "hover:bg-slate-50"}>
                            <TableCell className="font-bold">{p.username}</TableCell>
                            <TableCell>{p.name || "-"}</TableCell>
                            <TableCell>
                                {p.banned ? <Badge variant="destructive">Đang khóa</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Hoạt động</Badge>}
                            </TableCell>
                            <TableCell className="text-slate-500 text-xs">
                                {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                            </TableCell>
                            <TableCell className="text-right">
                                {/* Truyền safePlayer vào Dialog Sửa */}
                                <PlayerDialog player={safePlayer} />
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
            </Table>
        </div>
        </div>
    );
}
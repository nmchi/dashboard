import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import { PlayerDialog } from "@/components/agent/players/player-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { BetSettings, DEFAULT_BET_SETTINGS } from "@/types/bet-settings";

interface PageProps { 
    searchParams: Promise<{ q?: string }> 
}

export default async function AgentPlayersPage(props: PageProps) {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "AGENT") {
        redirect("/");
    }

    const searchParams = await props.searchParams;
    const query = searchParams.q || "";

    const players = await db.user.findMany({
        where: {
            parentId: user.id,
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
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                    Chưa có khách nào. Hãy tạo mới!
                                </TableCell>
                            </TableRow>
                        ) : players.map((p) => {
                            const safePlayer = {
                                ...p,
                                betSettings: (p.betSettings as unknown as BetSettings) || DEFAULT_BET_SETTINGS
                            };

                            return (
                                <TableRow key={p.id} className={p.banned ? "bg-red-50" : "hover:bg-slate-50"}>
                                    <TableCell className="font-bold">{p.username}</TableCell>
                                    <TableCell>{p.name || "-"}</TableCell>
                                    <TableCell>
                                        {p.banned 
                                            ? <Badge variant="destructive">Đang khóa</Badge> 
                                            : <Badge className="bg-green-600 hover:bg-green-700">Hoạt động</Badge>
                                        }
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-xs">
                                        {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                                    </TableCell>
                                    <TableCell className="text-right">
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
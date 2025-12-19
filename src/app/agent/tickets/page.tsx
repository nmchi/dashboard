import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TicketDetail } from "@/components/agent/tickets/ticket-detail"; // Import dialog vừa tạo

export default async function TicketHistoryPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.role !== "AGENT") redirect("/auth/login");

    const tickets = await db.ticket.findMany({
        where: {
            user: {
                parentId: session.user.id
            }
        },
        include: {
            user: true,
            bets: {
                include: {
                    province: true,
                    betType: true
                }
            } 
        },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Lịch Sử Tin Nhắn</h1>
                <p className="text-sm text-slate-500">Quản lý toàn bộ đơn cược đã lưu</p>
            </div>
            <div className="text-sm font-medium bg-blue-50 text-blue-700 px-4 py-2 rounded-lg">
                Tổng số đơn: {tickets.length}
            </div>
        </div>

        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                <TableHead className="w-[100px]">Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Nội dung gốc</TableHead>
                <TableHead>Miền</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Chi tiết</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tickets.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                            Chưa có tin nhắn nào được lưu.
                        </TableCell>
                    </TableRow>
                ) : (
                    tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                            <TableCell className="font-mono text-xs text-slate-500">
                                #{ticket.id.slice(-6)}
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{ticket.user.name}</div>
                                <div className="text-xs text-slate-400">{ticket.user.username}</div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-slate-500 italic text-xs">
                                {ticket.rawContent}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">{ticket.region}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-700">
                                {new Intl.NumberFormat('vi-VN').format(Number(ticket.totalAmount))}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                                {new Date(ticket.createdAt).toLocaleString('vi-VN')}
                            </TableCell>
                            <TableCell className="text-right">
                                {/* Nút xem chi tiết */}
                                <TicketDetail ticket={ticket} />
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </div>
        </div>
    );
}
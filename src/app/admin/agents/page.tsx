import { db } from "@/lib/prisma";
// import { CreateAgentDialog } from ... -> XÓA DÒNG NÀY
import { AgentActions } from "@/components/admin/agents/agent-actions"; // Import mới
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default async function AdminAgentsPage() {
    const agents = await db.user.findMany({
        where: { role: 'AGENT' },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { children: true }
            }
        }
    });

    return (
        <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Đại Lý</h1>
            {/* Đã xóa nút "Thêm Đại Lý" ở đây */}
            <div className="text-sm text-slate-500">
                Tổng số: <span className="font-bold">{agents.length}</span> đại lý
            </div>
        </div>

        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
            <Table className="min-w-[600px]">
            <TableHeader>
                <TableRow>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Tên hiển thị</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Số Player</TableHead>
                <TableHead>Ngày tham gia</TableHead>
                <TableHead className="text-right w-[100px]">Hành động</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {agents.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                            Chưa có đại lý nào đăng ký.
                        </TableCell>
                    </TableRow>
                ) : (
                    agents.map((agent) => (
                    <TableRow key={agent.id}>
                        <TableCell className="font-medium text-blue-600">{agent.username}</TableCell>
                        <TableCell>{agent.name}</TableCell>
                        <TableCell>
                            {agent.banned ? (
                                <Badge variant="destructive">Đang khóa</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Hoạt động</Badge>
                            )}
                        </TableCell>
                        <TableCell>{agent._count.children}</TableCell>
                        <TableCell>{format(agent.createdAt, "dd/MM/yyyy")}</TableCell>
                        
                        {/* Cột Hành động mới */}
                        <TableCell className="text-right">
                            <AgentActions 
                                userId={agent.id} 
                                username={agent.username} 
                                isBanned={agent.banned} 
                            />
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
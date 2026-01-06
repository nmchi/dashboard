import { db } from "@/lib/prisma";
import { CreateAgentDialog } from "@/components/admin/agents/create-agent-dialog";
import { AgentActions } from "@/components/admin/agents/agent-actions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format, differenceInDays, isPast } from "date-fns";
import { vi } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

// Helper: Format ngày hết hạn và trạng thái
function formatExpiryStatus(expiresAt: Date | null) {
    if (!expiresAt) {
        return { text: "Không giới hạn", color: "bg-slate-100 text-slate-600" };
    }
    
    const now = new Date();
    const daysLeft = differenceInDays(expiresAt, now);
    
    if (isPast(expiresAt)) {
        return { 
            text: `Hết hạn ${format(expiresAt, "dd/MM/yyyy")}`, 
            color: "bg-red-100 text-red-700" 
        };
    }
    
    if (daysLeft <= 3) {
        return { 
            text: `Còn ${daysLeft} ngày`, 
            color: "bg-orange-100 text-orange-700" 
        };
    }
    
    if (daysLeft <= 7) {
        return { 
            text: `Còn ${daysLeft} ngày`, 
            color: "bg-yellow-100 text-yellow-700" 
        };
    }
    
    return { 
        text: format(expiresAt, "dd/MM/yyyy"), 
        color: "bg-green-50 text-green-700" 
    };
}

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
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Đại Lý</h1>
                    <p className="text-sm text-slate-500">
                        Tổng số: <span className="font-bold">{agents.length}</span> đại lý
                    </p>
                </div>
                <CreateAgentDialog />
            </div>

            <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
                <Table className="min-w-[600px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tài khoản</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Hạn sử dụng</TableHead>
                            <TableHead>Số Player</TableHead>
                            <TableHead>Ngày tạo</TableHead>
                            <TableHead className="text-right w-[100px]">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                    Chưa có đại lý nào. Hãy tạo đại lý đầu tiên!
                                </TableCell>
                            </TableRow>
                        ) : (
                            agents.map((agent) => {
                                const expiryStatus = formatExpiryStatus(agent.expiresAt);
                                const isExpired = agent.expiresAt && isPast(agent.expiresAt);
                                
                                return (
                                    <TableRow key={agent.id} className={isExpired ? "bg-red-50/50" : ""}>
                                        <TableCell>
                                            <div>
                                                <span className="font-medium text-blue-600">{agent.username}</span>
                                                {agent.name && (
                                                    <p className="text-xs text-slate-500">{agent.name}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {agent.banned ? (
                                                <Badge variant="destructive">Đang khóa</Badge>
                                            ) : isExpired ? (
                                                <Badge variant="destructive">Hết hạn</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    Hoạt động
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${expiryStatus.color}`}>
                                                {expiryStatus.text}
                                            </span>
                                        </TableCell>
                                        <TableCell>{agent._count.children}</TableCell>
                                        <TableCell className="text-slate-500 text-sm">
                                            {format(agent.createdAt, "dd/MM/yyyy")}
                                        </TableCell>
                                        
                                        <TableCell className="text-right">
                                            <AgentActions 
                                                userId={agent.id} 
                                                username={agent.username} 
                                                isBanned={agent.banned}
                                                expiresAt={agent.expiresAt}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
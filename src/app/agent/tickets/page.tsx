"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { TicketStatus, Region } from "@prisma/client";
import Link from "next/link";
import { RefreshCw, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ReportDialog } from "@/components/agent/tickets/report-dialog";

interface Player {
    id: string;
    username: string;
    name: string | null;
}

interface Bet {
    id: string;
    numbers: string;
    point: string;
    amount: string;
    isWin: boolean;
    winCount: number;
    winAmount: string;
    province: { name: string };
    provinces: string[] | null;
    betType: { name: string };
}

interface Ticket {
    id: string;
    rawContent: string;
    region: Region;
    drawDate: string;
    totalAmount: string;
    status: TicketStatus;
    errorMsg: string | null;
    createdAt: string;
    bets: Bet[];
    user?: { username: string; name: string | null };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function TicketListPage() {
    const { data: session } = useSession();
    
    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
    const [dateFilter, setDateFilter] = useState<string>(() => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    });

    useEffect(() => {
        const fetchPlayers = async () => {
            if (!session?.user?.id) return;
            
            try {
                const res = await fetch(`/api/users?parentId=${session.user.id}&role=PLAYER`);
                const data = await res.json();
                
                if (data.success) {
                    setPlayers(data.data);
                }
            } catch (error) {
                console.error('Fetch players error:', error);
            }
        };
        
        fetchPlayers();
    }, [session?.user?.id]);

    const fetchTickets = useCallback(async () => {
        if (!session?.user?.id) return;
        
        setLoading(true);
        
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            
            if (selectedPlayerId) {
                params.append('userId', selectedPlayerId);
            } else {
                params.append('parentId', session.user.id);
            }
            
            if (statusFilter) {
                params.append('status', statusFilter);
            }
            
            if (dateFilter) {
                params.append('dateFrom', dateFilter);
                params.append('dateTo', dateFilter);
            }
            
            const res = await fetch(`/api/tickets?${params}`);
            const data = await res.json();
            
            if (data.success) {
                setTickets(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Fetch tickets error:', error);
        } finally {
            setLoading(false);
        }
    }, [session?.user?.id, selectedPlayerId, pagination.page, pagination.limit, statusFilter, dateFilter]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleDeleteTicket = async (ticketId: string) => {
        if (!session?.user?.id) return;
        
        const confirmed = window.confirm('Bạn có chắc muốn xóa tin nhắn này?');
        if (!confirmed) return;
        
        setDeletingId(ticketId);
        
        try {
            const res = await fetch(`/api/tickets?ticketId=${ticketId}&userId=${session.user.id}`, {
                method: 'DELETE',
            });
            
            const data = await res.json();
            
            if (data.success) {
                fetchTickets();
            } else {
                alert(data.error || 'Lỗi xóa ticket');
            }
        } catch (error) {
            console.error('Delete ticket error:', error);
            alert('Lỗi kết nối');
        } finally {
            setDeletingId(null);
        }
    };

    const handleProcessTickets = async () => {
        if (!session?.user?.id) return;
        
        setProcessing(true);
        
        try {
            const playerIds = players.map(p => p.id);
            let totalProcessed = 0;
            let totalSuccess = 0;
            
            for (const playerId of playerIds) {
                const res = await fetch('/api/tickets/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: playerId }),
                });
                
                const data = await res.json();
                if (data.success && data.data) {
                    totalProcessed += data.data.processed || 0;
                    totalSuccess += data.data.success || 0;
                }
            }
            
            if (totalProcessed > 0) {
                alert(`Đã dò số: ${totalSuccess}/${totalProcessed} tin nhắn thành công`);
                fetchTickets();
            } else {
                alert('Không có tin nhắn nào cần dò số');
            }
            
        } catch (error) {
            console.error('Process tickets error:', error);
            alert('Lỗi khi dò số');
        } finally {
            setProcessing(false);
        }
    };

    const handleProcessSingleTicket = async (ticketId: string) => {
        try {
            const res = await fetch('/api/tickets/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId }),
            });
            
            const data = await res.json();
            
            if (data.success) {
                if (data.error?.includes('Chưa có kết quả')) {
                    alert('Chưa có kết quả xổ số cho ngày này');
                } else {
                    alert('Đã dò số thành công!');
                    fetchTickets();
                }
            } else {
                alert(data.error || 'Lỗi dò số');
            }
            
        } catch (error) {
            console.error('Process single ticket error:', error);
            alert('Lỗi kết nối');
        }
    };

    const formatMoney = (amount: string | number) => {
        return new Intl.NumberFormat('vi-VN').format(Number(amount));
    };

    const getStatusBadge = (status: TicketStatus) => {
        const styles: Record<TicketStatus, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            COMPLETED: 'bg-green-100 text-green-800',
            ERROR: 'bg-red-100 text-red-800',
        };
        
        const labels: Record<TicketStatus, string> = {
            PENDING: 'Chờ',
            COMPLETED: 'Xong',
            ERROR: 'Lỗi',
        };
        
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const getRegionBadge = (region: Region) => {
        const styles: Record<Region, string> = {
            MN: 'bg-blue-100 text-blue-700',
            MT: 'bg-orange-100 text-orange-700',
            MB: 'bg-red-100 text-red-700',
        };
        
        return (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${styles[region]}`}>
                {region}
            </span>
        );
    };

    const pendingCount = tickets.filter(t => t.status === TicketStatus.PENDING).length;
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    const selectedPlayerName = selectedPlayer?.name || selectedPlayer?.username || '';

    return (
        <div className="space-y-4 w-full overflow-hidden">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold text-slate-900">Lịch Sử Tin</h1>
                    <span className="text-sm text-slate-500">{pagination.total} tin</span>
                </div>
                
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleProcessTickets}
                        disabled={processing || pendingCount === 0}
                        className="flex items-center justify-center gap-1.5 bg-orange-500 text-white px-3 py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                        {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span>Dò số ({pendingCount})</span>
                    </button>
                    
                    <Link 
                        href="/agent/parser"
                        className="flex items-center justify-center bg-blue-600 text-white px-3 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                        + Nhập tin
                    </Link>
                </div>
            </div>
            
            {/* Filters */}
            <div className="bg-white rounded-lg border shadow-sm p-3 space-y-3">
                {/* Row 1: Player + Status */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Khách</label>
                        <select
                            value={selectedPlayerId}
                            onChange={(e) => {
                                setSelectedPlayerId(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="w-full border rounded-lg px-2 py-2 text-sm"
                        >
                            <option value="">Tất cả</option>
                            {players.map(player => (
                                <option key={player.id} value={player.id}>
                                    {player.name || player.username}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Trạng thái</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as TicketStatus | '');
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="w-full border rounded-lg px-2 py-2 text-sm"
                        >
                            <option value="">Tất cả</option>
                            <option value={TicketStatus.PENDING}>Chờ</option>
                            <option value={TicketStatus.COMPLETED}>Xong</option>
                            <option value={TicketStatus.ERROR}>Lỗi</option>
                        </select>
                    </div>
                </div>
                
                {/* Row 2: Date + Report */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Ngày</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="w-full border rounded-lg px-2 py-2 text-sm"
                        />
                    </div>
                    
                    <div className="flex items-end">
                        <ReportDialog
                            playerId={selectedPlayerId}
                            playerName={selectedPlayerName}
                            dateFrom={dateFilter || undefined}
                            dateTo={dateFilter || undefined}
                        />
                    </div>
                </div>
            </div>
            
            {/* Ticket List */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Đang tải...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <p>Chưa có tin nhắn nào</p>
                        <Link href="/agent/parser" className="text-blue-600 hover:underline mt-2 inline-block text-sm">
                            Nhập tin nhắn đầu tiên →
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y">
                        {tickets.map((ticket) => {
                            const totalWin = ticket.bets.reduce((sum, b) => sum + Number(b.winAmount), 0);
                            const totalAmount = Number(ticket.totalAmount);
                            const diff = totalWin - totalAmount;
                            
                            return (
                                <div key={ticket.id}>
                                    {/* Ticket Header */}
                                    <div 
                                        className="p-3 cursor-pointer active:bg-slate-50"
                                        onClick={() => setExpandedId(
                                            expandedId === ticket.id ? null : ticket.id
                                        )}
                                    >
                                        {/* Row 1: Badges + Actions */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                                                {getStatusBadge(ticket.status)}
                                                {getRegionBadge(ticket.region)}
                                                {ticket.user && (
                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs truncate max-w-[60px]">
                                                        {ticket.user.name || ticket.user.username}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                                    {new Date(ticket.drawDate).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                {ticket.status === TicketStatus.PENDING && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleProcessSingleTicket(ticket.id);
                                                        }}
                                                        className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs"
                                                    >
                                                        Dò
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTicket(ticket.id);
                                                    }}
                                                    disabled={deletingId === ticket.id}
                                                    className="p-1.5 bg-red-100 text-red-700 rounded disabled:opacity-50"
                                                >
                                                    {deletingId === ticket.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                                <span className="text-slate-400">
                                                    {expandedId === ticket.id ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Row 2: Raw content */}
                                        <p className="font-mono text-sm bg-slate-100 p-2 rounded break-all line-clamp-2 mb-2">
                                            {ticket.rawContent}
                                        </p>
                                        
                                        {/* Row 3: Summary */}
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                                            <span className="text-slate-500">{ticket.bets.length} cược</span>
                                            <span>
                                                Thu: <strong className="text-blue-600">{formatMoney(totalAmount)}</strong>
                                            </span>
                                            {ticket.status === TicketStatus.COMPLETED && (
                                                <>
                                                    <span>
                                                        Thắng: <strong className="text-green-600">{formatMoney(totalWin)}</strong>
                                                    </span>
                                                    <strong className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                                        {diff > 0 ? `Lỗ ${formatMoney(diff)}` : `Lời ${formatMoney(Math.abs(diff))}`}
                                                    </strong>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Ticket Details (Expanded) */}
                                    {expandedId === ticket.id && (
                                        <div className="px-3 pb-3 border-t bg-slate-50">
                                            <div className="pt-3 space-y-2">
                                                {ticket.bets.map((bet) => (
                                                    <div key={bet.id} className={`p-2.5 rounded-lg border ${bet.isWin ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                                        {/* Bet row 1: Province + Numbers + Win */}
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-medium text-slate-700 text-sm">
                                                                    {bet.provinces?.join(', ') || bet.province.name}
                                                                </span>
                                                                <span className="mx-1 text-slate-300">•</span>
                                                                <span className="font-mono text-sm break-all">{bet.numbers}</span>
                                                            </div>
                                                            {bet.isWin && (
                                                                <span className="text-green-600 text-xs font-medium shrink-0 bg-green-100 px-1.5 py-0.5 rounded">
                                                                    ✓{bet.winCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Bet row 2: Type + Point + Amount */}
                                                        <div className="flex flex-wrap justify-between gap-1 text-xs text-slate-500">
                                                            <span>{bet.betType.name} • {bet.point}đ</span>
                                                            <div className="flex gap-2">
                                                                <span className="text-blue-600">Thu: {formatMoney(bet.amount)}</span>
                                                                {Number(bet.winAmount) > 0 && (
                                                                    <span className="text-green-600 font-medium">
                                                                        Thắng: {formatMoney(bet.winAmount)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                
                                                {/* Summary */}
                                                <div className="p-2.5 bg-slate-200 rounded-lg text-sm space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>Tổng thu:</span>
                                                        <span className="text-blue-600 font-medium">{formatMoney(totalAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Tổng thắng:</span>
                                                        <span className="text-green-600 font-medium">{formatMoney(totalWin)}</span>
                                                    </div>
                                                    <div className={`flex justify-between font-bold pt-1 border-t border-slate-300 ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        <span>{diff > 0 ? 'Lỗ:' : 'Lời:'}</span>
                                                        <span>{formatMoney(Math.abs(diff))}</span>
                                                    </div>
                                                </div>
                                                
                                                {ticket.errorMsg && (
                                                    <div className="p-2 bg-red-50 text-red-600 text-xs rounded">
                                                        {ticket.errorMsg}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-3 border-t flex justify-center items-center gap-3">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
                        >
                            ← Trước
                        </button>
                        
                        <span className="text-sm text-slate-600">
                            {pagination.page}/{pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-3 py-1.5 border rounded text-sm disabled:opacity-50"
                        >
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
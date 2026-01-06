"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { TicketStatus, Region } from "@prisma/client";
import Link from "next/link";
import { RefreshCw, Loader2, Trash2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
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
    
    // Players của Agent
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
    
    // Date filter cho báo sổ - mặc định là ngày hôm nay (theo giờ Việt Nam)
    const [dateFilter, setDateFilter] = useState<string>(() => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    });

    // Lấy danh sách Players của Agent
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

    // Xóa ticket
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

    // Xử lý dò số cho tickets pending
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

    // Xử lý dò số cho 1 ticket cụ thể
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

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
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
            <span className={`px-2 py-0.5 sm:py-1 rounded-full text-sm sm:text-xs font-medium ${styles[status]}`}>
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
            <span className={`px-2 py-0.5 rounded text-sm sm:text-xs font-medium ${styles[region]}`}>
                {region}
            </span>
        );
    };

    // Đếm số pending tickets
    const pendingCount = tickets.filter(t => t.status === TicketStatus.PENDING).length;
    
    // Lấy tên player đã chọn
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    const selectedPlayerName = selectedPlayer?.name || selectedPlayer?.username || '';

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Lịch Sử Tin</h1>
                        <p className="text-slate-500 text-sm hidden sm:block">Danh sách tin nhắn cược đã lưu</p>
                    </div>
                    
                    {/* Desktop buttons */}
                    <div className="hidden sm:flex gap-2">
                        <button
                            onClick={handleProcessTickets}
                            disabled={processing || pendingCount === 0}
                            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                            {processing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            {processing ? 'Đang dò...' : `Dò số (${pendingCount})`}
                        </button>
                        
                        <Link 
                            href="/agent/parser"
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            + Nhập tin
                        </Link>
                    </div>
                </div>
                
                {/* Mobile action buttons */}
                <div className="flex gap-2 sm:hidden">
                    <button
                        onClick={handleProcessTickets}
                        disabled={processing || pendingCount === 0}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        {processing ? 'Đang dò...' : `Dò số (${pendingCount})`}
                    </button>
                    
                    <Link 
                        href="/agent/parser"
                        className="flex-1 flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        + Nhập tin
                    </Link>
                </div>
            </div>
            
            {/* Filters - Always visible */}
            <div className="bg-white rounded-lg border shadow-sm p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
                    {/* Lọc theo Player */}
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-slate-600 mb-1">Khách hàng</label>
                        <select
                            value={selectedPlayerId}
                            onChange={(e) => {
                                setSelectedPlayerId(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm"
                        >
                            <option value="">Tất cả khách</option>
                            {players.map(player => (
                                <option key={player.id} value={player.id}>
                                    {player.name || player.username}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Lọc theo trạng thái */}
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-slate-600 mb-1">Trạng thái</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as TicketStatus | '');
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-base sm:text-sm"
                        >
                            <option value="">Tất cả</option>
                            <option value={TicketStatus.PENDING}>Chờ xử lý</option>
                            <option value={TicketStatus.COMPLETED}>Hoàn thành</option>
                            <option value={TicketStatus.ERROR}>Lỗi</option>
                        </select>
                    </div>
                    
                    {/* Lọc theo ngày */}
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm text-slate-600 mb-1">Ngày</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full border rounded-lg pl-9 pr-3 py-2 text-base sm:text-sm"
                            />
                        </div>
                    </div>
                    
                    {/* Nút Báo sổ */}
                    <ReportDialog
                        playerId={selectedPlayerId}
                        playerName={selectedPlayerName}
                        dateFrom={dateFilter || undefined}
                        dateTo={dateFilter || undefined}
                    />
                    
                    {/* Tổng số */}
                    <div className="sm:ml-auto text-sm text-slate-600">
                        Tổng: <strong>{pagination.total}</strong> tin nhắn
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
                                <div key={ticket.id} className="hover:bg-slate-50">
                                    {/* Ticket Header */}
                                    <div 
                                        className="p-3 sm:p-4 cursor-pointer"
                                        onClick={() => setExpandedId(
                                            expandedId === ticket.id ? null : ticket.id
                                        )}
                                    >
                                        {/* Top row: Status + Meta + Actions */}
                                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                                            {getStatusBadge(ticket.status)}
                                            {getRegionBadge(ticket.region)}
                                            
                                            {ticket.user && (
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-sm sm:text-xs truncate max-w-[100px] sm:max-w-none">
                                                    {ticket.user.name || ticket.user.username}
                                                </span>
                                            )}
                                            
                                            <span className="text-sm sm:text-xs text-slate-500">
                                                📅 {new Date(ticket.drawDate).toLocaleDateString('vi-VN')}
                                            </span>
                                            
                                            <div className="flex items-center gap-1 ml-auto">
                                                {/* Nút dò số cho ticket pending */}
                                                {ticket.status === TicketStatus.PENDING && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleProcessSingleTicket(ticket.id);
                                                        }}
                                                        className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-sm sm:text-xs hover:bg-orange-200 transition-colors"
                                                    >
                                                        🔍 Dò
                                                    </button>
                                                )}

                                                {/* Nút xóa ticket */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTicket(ticket.id);
                                                    }}
                                                    disabled={deletingId === ticket.id}
                                                    className="p-1 sm:px-1.5 sm:py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                                                    title="Xóa"
                                                >
                                                    {deletingId === ticket.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3 w-3" />
                                                    )}
                                                </button>
                                                
                                                {/* Expand icon */}
                                                <span className="text-slate-400 ml-1">
                                                    {expandedId === ticket.id ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Raw content */}
                                        <p className="font-mono text-base sm:text-xs bg-slate-100 p-2 rounded break-all line-clamp-2">
                                            {ticket.rawContent}
                                        </p>
                                        
                                        {/* Summary row */}
                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-sm">
                                            <span className="text-slate-500">{ticket.bets.length} cược</span>
                                            <span className="text-slate-300">•</span>
                                            <span>
                                                Thu: <strong className="text-blue-600">{formatMoney(ticket.totalAmount)}</strong>
                                            </span>
                                            {ticket.status === TicketStatus.COMPLETED && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span>
                                                        Thắng: <strong className="text-green-600">{formatMoney(totalWin)}</strong>
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <strong className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                                        {diff > 0 ? `Lỗ ${formatMoney(diff)}` : `Lời ${formatMoney(Math.abs(diff))}`}
                                                    </strong>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Ticket Details (Expanded) */}
                                    {expandedId === ticket.id && (
                                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t bg-slate-50/50">
                                            <div className="pt-3 sm:pt-4">
                                                {/* Mobile: Card layout */}
                                                <div className="sm:hidden space-y-2">
                                                    {ticket.bets.map((bet) => (
                                                        <div key={bet.id} className={`p-3 rounded-lg border ${bet.isWin ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-medium text-slate-700 text-base">{bet.provinces?.join(', ') || bet.province.name}</span>
                                                                    <span className="mx-1.5 text-slate-300">•</span>
                                                                    <span className="font-mono text-base">{bet.numbers}</span>
                                                                </div>
                                                                {bet.isWin && (
                                                                    <span className="text-green-600 text-sm font-medium shrink-0">✓ {bet.winCount}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-between text-sm text-slate-500 mb-1">
                                                                <span>{bet.betType.name}</span>
                                                                <span>{bet.point}đ</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-blue-600">Thu: {formatMoney(bet.amount)}</span>
                                                                <span className={Number(bet.winAmount) > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}>
                                                                    Thắng: {formatMoney(bet.winAmount)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    
                                                    {/* Mobile Summary */}
                                                    <div className="p-3 bg-slate-100 rounded-lg space-y-1.5 text-base">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Tổng thu:</span>
                                                            <span className="text-blue-600 font-medium">{formatMoney(ticket.totalAmount)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Tổng thắng:</span>
                                                            <span className="text-green-600 font-medium">{formatMoney(totalWin)}</span>
                                                        </div>
                                                        <div className={`flex justify-between font-bold pt-1.5 border-t ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            <span>{diff > 0 ? 'Lỗ:' : 'Lời:'}</span>
                                                            <span>{formatMoney(Math.abs(diff))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Desktop: Table layout */}
                                                <div className="hidden sm:block overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-100">
                                                            <tr>
                                                                <th className="px-2 py-1.5 text-left font-medium text-slate-600">Đài</th>
                                                                <th className="px-2 py-1.5 text-left font-medium text-slate-600">Số</th>
                                                                <th className="px-2 py-1.5 text-left font-medium text-slate-600">Kiểu</th>
                                                                <th className="px-2 py-1.5 text-right font-medium text-slate-600">Điểm</th>
                                                                <th className="px-2 py-1.5 text-right font-medium text-slate-600">Tiền thu</th>
                                                                <th className="px-2 py-1.5 text-center font-medium text-slate-600">Trúng</th>
                                                                <th className="px-2 py-1.5 text-right font-medium text-slate-600">Thắng</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ticket.bets.map((bet) => (
                                                                <tr key={bet.id} className={`border-t ${bet.isWin ? 'bg-green-50' : 'bg-white'}`}>
                                                                    <td className="px-2 py-1.5">{bet.provinces?.join(', ') || bet.province.name}</td>
                                                                    <td className="px-2 py-1.5 font-mono">{bet.numbers}</td>
                                                                    <td className="px-2 py-1.5">{bet.betType.name}</td>
                                                                    <td className="px-2 py-1.5 text-right">{bet.point}</td>
                                                                    <td className="px-2 py-1.5 text-right">{formatMoney(bet.amount)}</td>
                                                                    <td className="px-2 py-1.5 text-center">
                                                                        {bet.isWin ? (
                                                                            <span className="text-green-600">✓ {bet.winCount}</span>
                                                                        ) : (
                                                                            <span className="text-slate-400">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className={`px-2 py-1.5 text-right ${Number(bet.winAmount) > 0 ? 'text-green-600 font-medium' : ''}`}>
                                                                        {formatMoney(bet.winAmount)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="bg-slate-100 font-medium">
                                                            <tr className="border-t-2 border-slate-300">
                                                                <td colSpan={4} className="px-2 py-2">Tổng cộng</td>
                                                                <td className="px-2 py-2 text-right text-blue-600">
                                                                    {formatMoney(ticket.totalAmount)}
                                                                </td>
                                                                <td className="px-2 py-2 text-center">
                                                                    {ticket.bets.filter(b => b.isWin).length}
                                                                </td>
                                                                <td className="px-2 py-2 text-right text-green-600">
                                                                    {formatMoney(totalWin)}
                                                                </td>
                                                            </tr>
                                                            <tr className="border-t">
                                                                <td colSpan={6} className="px-2 py-2 text-right">
                                                                    <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                                                        {diff > 0 ? 'Lỗ:' : 'Lời:'}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-2 py-2 text-right font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                    {formatMoney(Math.abs(diff))}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                                
                                                {ticket.errorMsg && (
                                                    <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs sm:text-sm rounded">
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
                    <div className="p-3 sm:p-4 border-t flex justify-center items-center gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-2 sm:px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                        >
                            ←
                        </button>
                        
                        <span className="px-2 sm:px-3 py-1 text-sm">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-2 sm:px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                        >
                            →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { TicketStatus, Region } from "@prisma/client";
import Link from "next/link";
import { RefreshCw, Loader2, Trash2 } from "lucide-react";
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
            
            // Nếu chọn player cụ thể
            if (selectedPlayerId) {
                params.append('userId', selectedPlayerId);
            } else {
                // Lấy tất cả tickets của các players thuộc agent
                params.append('parentId', session.user.id);
            }
            
            if (statusFilter) {
                params.append('status', statusFilter);
            }
            
            // Filter theo ngày
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
        
        const confirmed = window.confirm('Bạn có chắc muốn xóa tin nhắn này? Hành động này không thể hoàn tác.');
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
            // Lấy tất cả player IDs của agent
            const playerIds = players.map(p => p.id);
            
            // Xử lý từng player
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
                fetchTickets(); // Refresh danh sách
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
            PENDING: 'Chờ xử lý',
            COMPLETED: 'Hoàn thành',
            ERROR: 'Lỗi',
        };
        
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const getRegionName = (region: Region) => {
        const names: Record<Region, string> = {
            MN: 'Miền Nam',
            MT: 'Miền Trung',
            MB: 'Miền Bắc',
        };
        return names[region];
    };

    // Đếm số pending tickets
    const pendingCount = tickets.filter(t => t.status === TicketStatus.PENDING).length;
    
    // Lấy tên player đã chọn
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    const selectedPlayerName = selectedPlayer?.name || selectedPlayer?.username || '';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lịch Sử Tin</h1>
                    <p className="text-slate-500">Danh sách tin nhắn cược đã lưu</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {/* Nút Dò Số */}
                    <button
                        onClick={handleProcessTickets}
                        disabled={processing || pendingCount === 0}
                        className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + Nhập tin nhắn
                    </Link>
                </div>
            </div>
            
            {/* Filters */}
            <div className="bg-white rounded-lg border shadow-sm p-4">
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
                            className="border rounded-lg px-3 py-2 min-w-[150px]"
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
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Trạng thái</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as TicketStatus | '');
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="">Tất cả</option>
                            <option value={TicketStatus.PENDING}>Chờ xử lý</option>
                            <option value={TicketStatus.COMPLETED}>Hoàn thành</option>
                            <option value={TicketStatus.ERROR}>Lỗi</option>
                        </select>
                    </div>
                    
                    {/* Lọc theo ngày */}
                    <div>
                        <label className="block text-sm text-slate-600 mb-1">Ngày</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="border rounded-lg px-3 py-2"
                        />
                    </div>
                    
                    {/* Nút Báo sổ - luôn hiển thị */}
                    <ReportDialog
                        playerId={selectedPlayerId}
                        playerName={selectedPlayerName}
                        dateFrom={dateFilter || undefined}
                        dateTo={dateFilter || undefined}
                    />
                    
                    <div className="ml-auto text-sm text-slate-600">
                        Tổng: <strong>{pagination.total}</strong> tin nhắn
                    </div>
                </div>
            </div>
            
            {/* Ticket List */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        Đang tải...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <p>Chưa có tin nhắn nào</p>
                        <Link href="/agent/parser" className="text-blue-600 hover:underline mt-2 inline-block">
                            Nhập tin nhắn đầu tiên →
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y">
                        {tickets.map((ticket) => {
                            // Tính toán cho từng ticket (góc nhìn Agent/Nhà cái)
                            const totalWin = ticket.bets.reduce((sum, b) => sum + Number(b.winAmount), 0);
                            const totalAmount = Number(ticket.totalAmount);
                            const diff = totalWin - totalAmount; // Thắng - Thu: dương = lỗ, âm = lời
                            
                            return (
                                <div key={ticket.id} className="p-4 hover:bg-slate-50">
                                    {/* Ticket Header */}
                                    <div 
                                        className="flex items-start gap-4 cursor-pointer"
                                        onClick={() => setExpandedId(
                                            expandedId === ticket.id ? null : ticket.id
                                        )}
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap text-xs sm:text-sm">
                                                {getStatusBadge(ticket.status)}
                                                {ticket.user && (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                                        {ticket.user.name || ticket.user.username}
                                                    </span>
                                                )}
                                                <span className="text-sm text-slate-500">
                                                    {getRegionName(ticket.region)}
                                                </span>
                                                <span className="text-sm text-slate-500">
                                                    📅 {new Date(ticket.drawDate).toLocaleDateString('vi-VN')}
                                                </span>
                                                
                                                {/* Nút dò số cho ticket pending */}
                                                {ticket.status === TicketStatus.PENDING && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleProcessSingleTicket(ticket.id);
                                                        }}
                                                        className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 transition-colors"
                                                    >
                                                        🔍 Dò số
                                                    </button>
                                                )}

                                                {/* Nút xóa ticket */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTicket(ticket.id);
                                                    }}
                                                    disabled={deletingId === ticket.id}
                                                    className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors disabled:opacity-50"
                                                    title="Xóa tin nhắn"
                                                >
                                                    {deletingId === ticket.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin inline" />
                                                    ) : (
                                                        <Trash2 className="h-3 w-3 inline" />
                                                    )}
                                                </button>
                                            </div>
                                            <p className="font-mono text-xs sm:text-sm bg-slate-100 p-2 rounded break-all overflow-x-auto">
                                                {ticket.rawContent}
                                            </p>
                                            <div className="mt-2 text-sm text-slate-600">
                                                {ticket.bets.length} cược • 
                                                Tiền thu: <strong className="text-blue-600">{formatMoney(ticket.totalAmount)}</strong>
                                                {ticket.status === TicketStatus.COMPLETED && (
                                                    <>
                                                        {' '}• Tiền thắng: <strong className="text-green-600">
                                                            {formatMoney(totalWin)}
                                                        </strong>
                                                        {' '}• <strong className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                                            {diff > 0 ? `Lỗ ${formatMoney(diff)}` : `Lời ${formatMoney(Math.abs(diff))}`}
                                                        </strong>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="text-right text-xs sm:text-sm text-slate-500 shrink-0">
                                            <span className="hidden sm:inline">{formatDate(ticket.createdAt)}</span>
                                            <span className="sm:hidden">{new Date(ticket.createdAt).toLocaleDateString('vi-VN')}</span>
                                            <div className="mt-1">
                                                {expandedId === ticket.id ? '▲' : '▼'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Ticket Details (Expanded) */}
                                    {expandedId === ticket.id && (
                                        <div className="mt-4 pt-4 border-t">
                                            {/* Mobile: Card layout */}
                                            <div className="block sm:hidden space-y-3">
                                                {ticket.bets.map((bet) => (
                                                    <div key={bet.id} className={`p-3 rounded-lg border ${bet.isWin ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <span className="font-medium text-slate-700">{bet.provinces?.join(', ') || bet.province.name}</span>
                                                                <span className="mx-2 text-slate-400">•</span>
                                                                <span className="font-mono">{bet.numbers}</span>
                                                            </div>
                                                            {bet.isWin && (
                                                                <span className="text-green-600 text-sm">✓ {bet.winCount}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between text-sm text-slate-600">
                                                            <span>{bet.betType.name}</span>
                                                            <span>{bet.point}đ</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm mt-1">
                                                            <span className="text-blue-600">Thu: {formatMoney(bet.amount)}</span>
                                                            <span className={Number(bet.winAmount) > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}>
                                                                Thắng: {formatMoney(bet.winAmount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                
                                                {/* Mobile Summary */}
                                                <div className="p-3 bg-slate-100 rounded-lg space-y-2">
                                                    <div className="flex justify-between font-medium">
                                                        <span>Tổng thu:</span>
                                                        <span className="text-blue-600">{formatMoney(ticket.totalAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between font-medium">
                                                        <span>Tổng thắng:</span>
                                                        <span className="text-green-600">{formatMoney(totalWin)}</span>
                                                    </div>
                                                    <div className={`flex justify-between font-bold pt-2 border-t ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        <span>{diff > 0 ? 'Lỗ:' : 'Lời:'}</span>
                                                        <span>{formatMoney(Math.abs(diff))}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Desktop: Table layout */}
                                            <div className="hidden sm:block overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-2 py-1 text-left">Đài</th>
                                                            <th className="px-2 py-1 text-left">Số</th>
                                                            <th className="px-2 py-1 text-left">Kiểu</th>
                                                            <th className="px-2 py-1 text-right">Điểm</th>
                                                            <th className="px-2 py-1 text-right">Tiền thu</th>
                                                            <th className="px-2 py-1 text-center">Trúng</th>
                                                            <th className="px-2 py-1 text-right">Thắng</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ticket.bets.map((bet) => (
                                                            <tr key={bet.id} className={`border-t ${bet.isWin ? 'bg-green-50' : ''}`}>
                                                                <td className="px-2 py-1">{bet.provinces?.join(', ') || bet.province.name}</td>
                                                                <td className="px-2 py-1 font-mono">{bet.numbers}</td>
                                                                <td className="px-2 py-1">{bet.betType.name}</td>
                                                                <td className="px-2 py-1 text-right">{bet.point}</td>
                                                                <td className="px-2 py-1 text-right">{formatMoney(bet.amount)}</td>
                                                                <td className="px-2 py-1 text-center">
                                                                    {bet.isWin ? (
                                                                        <span className="text-green-600">✓ {bet.winCount}</span>
                                                                    ) : (
                                                                        <span className="text-slate-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className={`px-2 py-1 text-right ${Number(bet.winAmount) > 0 ? 'text-green-600 font-medium' : ''}`}>
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
                                                <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
                                                    {ticket.errorMsg}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t flex justify-center gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
                        >
                            ← Trước
                        </button>
                        
                        <span className="px-3 py-1">
                            Trang {pagination.page} / {pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
                        >
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
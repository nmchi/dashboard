"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { TicketStatus, Region } from "@prisma/client";
import Link from "next/link";

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
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
    }, [session?.user?.id, selectedPlayerId, pagination.page, pagination.limit, statusFilter]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

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

    return (
        <div className="container mx-auto p-4 max-w-6xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Danh sách tin nhắn</h1>
                <Link 
                    href="/agent/tickets/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    + Nhập tin nhắn
                </Link>
            </div>
            
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Lọc theo Player */}
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Khách hàng</label>
                        <select
                            value={selectedPlayerId}
                            onChange={(e) => {
                                setSelectedPlayerId(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="border rounded-lg px-3 py-2"
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
                        <label className="block text-sm text-gray-600 mb-1">Trạng thái</label>
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
                    
                    <div className="ml-auto text-sm text-gray-600">
                        Tổng: <strong>{pagination.total}</strong> tin nhắn
                    </div>
                </div>
            </div>
            
            {/* Ticket List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        Đang tải...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Chưa có tin nhắn nào
                    </div>
                ) : (
                    <div className="divide-y">
                        {tickets.map((ticket) => (
                            <div key={ticket.id} className="p-4">
                                {/* Ticket Header */}
                                <div 
                                    className="flex items-start gap-4 cursor-pointer"
                                    onClick={() => setExpandedId(
                                        expandedId === ticket.id ? null : ticket.id
                                    )}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getStatusBadge(ticket.status)}
                                            {ticket.user && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                                    {ticket.user.name || ticket.user.username}
                                                </span>
                                            )}
                                            <span className="text-sm text-gray-500">
                                                {getRegionName(ticket.region)}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {new Date(ticket.drawDate).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="font-mono text-sm bg-gray-50 p-2 rounded">
                                            {ticket.rawContent}
                                        </p>
                                        <div className="mt-2 text-sm text-gray-600">
                                            {ticket.bets.length} cược • 
                                            Tiền thu: <strong>{formatMoney(ticket.totalAmount)}</strong>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right text-sm text-gray-500">
                                        {formatDate(ticket.createdAt)}
                                        <div className="mt-1">
                                            {expandedId === ticket.id ? '▲' : '▼'}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Ticket Details (Expanded) */}
                                {expandedId === ticket.id && (
                                    <div className="mt-4 pt-4 border-t">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
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
                                                    <tr key={bet.id} className="border-t">
                                                        <td className="px-2 py-1">{bet.province.name}</td>
                                                        <td className="px-2 py-1 font-mono">{bet.numbers}</td>
                                                        <td className="px-2 py-1">{bet.betType.name}</td>
                                                        <td className="px-2 py-1 text-right">{bet.point}</td>
                                                        <td className="px-2 py-1 text-right">{formatMoney(bet.amount)}</td>
                                                        <td className="px-2 py-1 text-center">
                                                            {bet.isWin ? (
                                                                <span className="text-green-600">✓ {bet.winCount}</span>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                        <td className={`px-2 py-1 text-right ${
                                                            Number(bet.winAmount) > 0 ? 'text-green-600 font-medium' : ''
                                                        }`}>
                                                            {formatMoney(bet.winAmount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-medium">
                                                <tr>
                                                    <td colSpan={4} className="px-2 py-2">Tổng</td>
                                                    <td className="px-2 py-2 text-right">
                                                        {formatMoney(ticket.totalAmount)}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        {ticket.bets.filter(b => b.isWin).length}
                                                    </td>
                                                    <td className="px-2 py-2 text-right">
                                                        {formatMoney(
                                                            ticket.bets.reduce((sum, b) => sum + Number(b.winAmount), 0)
                                                        )}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        
                                        {ticket.errorMsg && (
                                            <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
                                                {ticket.errorMsg}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-4 border-t flex justify-center gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            ← Trước
                        </button>
                        
                        <span className="px-3 py-1">
                            Trang {pagination.page} / {pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
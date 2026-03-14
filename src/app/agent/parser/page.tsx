"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { Region } from "@prisma/client";
import { ParseMessageResponse, ParseError } from "@/types/messages";
import ErrorHighlightTextarea from "@/components/error-highlight-textarea";
import { toast } from "sonner";

interface Player {
    id: string;
    username: string;
    name: string | null;
}

// Extended type với xac
// winPoints = số điểm × số lần trúng (để người dùng dễ tính: winPoints × giá trúng = tiền thắng)
interface ExtendedTotalsByType {
    "2c-dd": { xac: number; amount: number; winAmount: number; winPoints: number };
    "2c-b": { xac: number; amount: number; winAmount: number; winPoints: number };
    "3c": { xac: number; amount: number; winAmount: number; winPoints: number };
    "4c": { xac: number; amount: number; winAmount: number; winPoints: number };
    "dat": { xac: number; amount: number; winAmount: number; winPoints: number };
    "dax": { xac: number; amount: number; winAmount: number; winPoints: number };
    "total": { xac: number; amount: number; winAmount: number; winPoints: number };
}

export default function ParserPage() {
    const { data: session } = useSession();

    // Form state
    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState("");
    const [message, setMessage] = useState("");
    const [region, setRegion] = useState<Region>(Region.MN);
    const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]);

    // UI state
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<ParseMessageResponse | null>(null);
    const [totalsByType, setTotalsByType] = useState<ExtendedTotalsByType | null>(null);

    // Lấy danh sách Player của Agent
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!session?.user?.id) return;

            try {
                const res = await fetch(`/api/users?parentId=${session.user.id}&role=PLAYER`);
                const data = await res.json();

                if (data.success) {
                    setPlayers(data.data);
                    if (data.data.length > 0) {
                        setSelectedPlayerId(data.data[0].id);
                    }
                }
            } catch (error) {
                console.error('Fetch players error:', error);
            } finally {
                setLoadingPlayers(false);
            }
        };

        fetchPlayers();
    }, [session?.user?.id]);

    const handleParse = async () => {
        if (!message.trim() || !selectedPlayerId) return;

        setLoading(true);
        setResult(null);
        setTotalsByType(null);

        try {
            const res = await fetch('/api/tickets/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    userId: selectedPlayerId,
                    region,
                    drawDate,
                }),
            });

            const data: ParseMessageResponse = await res.json();
            setResult(data);

            // Chỉ dùng toast cho lỗi nghiêm trọng (không parse được gì)
            // Lỗi validation hiển thị inline (tô đỏ + danh sách dưới textarea)
            if (!data.success && data.error && (!data.parsedResult?.errors || data.parsedResult.errors.length === 0)) {
                toast.error(data.error);
            }

            // Tính toán lại totalsByType với xac
            if (data.parsedResult?.bets && data.parsedResult.bets.length > 0) {
                const totals = calculateTotalsWithXac(data.parsedResult.bets);
                setTotalsByType(totals);
            }
        } catch (error) {
            const errorMsg = 'Lỗi kết nối server';
            setResult({ success: false, error: errorMsg });
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!result?.success || !selectedPlayerId) return;

        // Kiểm tra có lỗi validation không
        if (result.parsedResult?.errors && result.parsedResult.errors.length > 0) {
            const confirm = window.confirm(
                `Có ${result.parsedResult.errors.length} lỗi validation. Bạn vẫn muốn lưu các cược hợp lệ?`
            );
            if (!confirm) return;
        }

        setSaving(true);

        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    userId: selectedPlayerId,
                    region,
                    drawDate,
                }),
            });

            const data = await res.json();

            if (data.success) {
                alert('Đã lưu tin nhắn thành công!');
                setMessage("");
                setResult(null);
                setTotalsByType(null);
            } else {
                alert('Lỗi: ' + data.error);
            }
        } catch (error) {
            alert('Lỗi kết nối server');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Lấy số lô theo miền và số chữ số
     */
    const getLoCount = (numDigits: number, currentRegion: Region): number => {
        if (currentRegion === Region.MB) {
            if (numDigits === 2) return 27;
            if (numDigits === 3) return 23;
            if (numDigits === 4) return 20;
        } else {
            if (numDigits === 2) return 18;
            if (numDigits === 3) return 17;
            if (numDigits === 4) return 16;
        }
        return 1;
    };

    /**
     * Tính toán totals với xac (chưa nhân %) và amount (đã nhân %)
     */
    const calculateTotalsWithXac = (bets: NonNullable<ParseMessageResponse['parsedResult']>['bets']): ExtendedTotalsByType => {
        const emptyTotal = () => ({ xac: 0, amount: 0, winAmount: 0, winPoints: 0 });

        const totals: ExtendedTotalsByType = {
            "2c-dd": emptyTotal(),
            "2c-b": emptyTotal(),
            "3c": emptyTotal(),
            "4c": emptyTotal(),
            "dat": emptyTotal(),
            "dax": emptyTotal(),
            "total": emptyTotal(),
        };

        for (const bet of bets) {
            let category: keyof ExtendedTotalsByType = "total";
            const numCount = Array.isArray(bet.numbers) ? bet.numbers.length : 1;
            const provinceCount = bet.provinces.length;
            const numDigits = (Array.isArray(bet.numbers) ? bet.numbers[0] : bet.numbers).length;

            let loMultiplier = 1;

            if (bet.type === 'Đầu' || bet.type === 'Đuôi' || bet.type === 'Đầu đuôi') {
                category = "2c-dd";
                loMultiplier = 1;
            } else if (bet.type === 'Bao lô' || bet.type === 'Bao đảo') {
                loMultiplier = getLoCount(numDigits, region);

                if (numDigits === 2) category = "2c-b";
                else if (numDigits === 3) category = "3c";
                else if (numDigits === 4) category = "4c";
            } else if (bet.type.includes('Xỉu chủ')) {
                category = "3c";
                loMultiplier = 1;
            } else if (bet.type === 'Đá thẳng') {
                category = "dat";
                loMultiplier = getLoCount(2, region) * 2;
            } else if (bet.type === 'Đá xiên') {
                category = "dax";
                loMultiplier = -1;
            }

            let xac: number;

            if (bet.type === 'Đá xiên') {
                const loCount2 = getLoCount(2, region);
                const combinationFactor = numCount === 2 ? 1 : (numCount * (numCount - 1)) / 2;
                let stationMultiplier = 1;
                if (provinceCount === 3) stationMultiplier = 3;
                else if (provinceCount >= 4) stationMultiplier = 6;

                xac = bet.point * 1000 * (loCount2 * 2) * combinationFactor * stationMultiplier * 2;
            } else if (bet.type === 'Đá' || bet.type === 'Đá thẳng') {
                const combinationFactor = numCount === 2 ? 1 : (numCount * (numCount - 1)) / 2;
                xac = bet.point * 1000 * provinceCount * combinationFactor * loMultiplier;
            } else {
                xac = bet.point * 1000 * provinceCount * numCount * loMultiplier;
            }

            const winPoints = bet.point * (bet.winCount || 0);

            totals[category].xac += xac;
            totals[category].amount += bet.amount;
            totals[category].winAmount += bet.winAmount || 0;
            totals[category].winPoints += winPoints;

            totals.total.xac += xac;
            totals.total.amount += bet.amount;
            totals.total.winAmount += bet.winAmount || 0;
            totals.total.winPoints += winPoints;
        }

        return totals;
    };

    /**
     * Format tiền theo dạng ngắn gọn
     */
    const formatMoney = (amount: number) => {
        if (amount === 0) return '0';
        const isNegative = amount < 0;
        const absAmount = Math.abs(amount);
        const thousands = absAmount / 1000;

        const fixed = thousands.toFixed(1);
        const [intPart, decPart] = fixed.split('.');

        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        return `${isNegative ? '-' : ''}${formattedInt}.${decPart}`;
    };

    const selectedPlayer = players.find(p => p.id === selectedPlayerId);

    const categoryLabels: Record<string, string> = {
        "2c-dd": "2c-dd",
        "2c-b": "2c-b",
        "3c": "3c",
        "4c": "4c",
        "dat": "dat",
        "dax": "dax",
    };

    const validationErrors: ParseError[] = result?.parsedResult?.errors || [];
    const hasValidationErrors = validationErrors.length > 0;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Máy Quét Tin</h1>
                <p className="text-slate-500 text-sm">Nhập tin nhắn cược cho khách hàng</p>
            </div>

            {/* Input Section */}
            <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6">
                {/* Form Grid - Stack on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                    {/* Chọn Player */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium mb-1">
                            Khách hàng <span className="text-red-500">*</span>
                        </label>
                        {loadingPlayers ? (
                            <div className="border rounded-lg px-3 py-2 text-gray-500 bg-slate-50">Đang tải...</div>
                        ) : players.length === 0 ? (
                            <div className="border rounded-lg px-3 py-2 text-red-500 text-sm bg-red-50">
                                Chưa có khách. <a href="/agent/players" className="underline font-medium">Tạo mới</a>
                            </div>
                        ) : (
                            <select
                                value={selectedPlayerId}
                                onChange={(e) => {
                                    setSelectedPlayerId(e.target.value);
                                    setResult(null);
                                    setTotalsByType(null);
                                }}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                            >
                                {players.map(player => (
                                    <option key={player.id} value={player.id}>
                                        {player.name || player.username}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Chọn Miền */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Miền</label>
                        <select
                            value={region}
                            onChange={(e) => {
                                setRegion(e.target.value as Region);
                                setResult(null);
                                setTotalsByType(null);
                            }}
                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                        >
                            <option value={Region.MN}>Miền Nam</option>
                            <option value={Region.MT}>Miền Trung</option>
                            <option value={Region.MB}>Miền Bắc</option>
                        </select>
                    </div>

                    {/* Chọn Ngày */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Ngày xổ</label>
                        <input
                            type="date"
                            value={drawDate}
                            onChange={(e) => {
                                setDrawDate(e.target.value);
                                setResult(null);
                                setTotalsByType(null);
                            }}
                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                        />
                    </div>
                </div>

                {/* Hiển thị Player đang chọn */}
                {selectedPlayer && (
                    <div className="mb-4 p-2.5 sm:p-3 bg-blue-50 rounded-lg text-sm border border-blue-100">
                        <span className="text-blue-600">📝</span> Đang nhập cho: <strong className="text-blue-700">{selectedPlayer.name || selectedPlayer.username}</strong>
                    </div>
                )}

                {/* Tin nhắn */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                        Tin nhắn <span className="text-red-500">*</span>
                    </label>
                    <ErrorHighlightTextarea
                        value={message}
                        onChange={setMessage}
                        errors={validationErrors}
                        placeholder="Ví dụ: vl 12 34 dd 1n&#10;tg bl 56 78 2n&#10;ag bt 11 66 dx 5"
                        className="border rounded-lg h-28 sm:h-32 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                        disabled={!selectedPlayerId}
                    />
                    <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                        Cú pháp: [đài] [số] [kiểu] [điểm] - Ví dụ: vl 12 dd 1n = Vĩnh Long, số 12, đầu đuôi, 1 nghìn
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                        onClick={handleParse}
                        disabled={loading || !message.trim() || !selectedPlayerId}
                        className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                    >
                        {loading ? 'Đang xử lý...' : '🔍 Phân tích'}
                    </button>

                    {result?.success && result.parsedResult?.bets && result.parsedResult.bets.length > 0 && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base ${hasValidationErrors
                                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {saving ? 'Đang lưu...' : hasValidationErrors ? '⚠️ Lưu (có lỗi)' : '💾 Lưu tin nhắn'}
                        </button>
                    )}
                </div>
            </div>

            {/* Result Section - chỉ hiển thị khi thành công */}
            {result && result.success && result.parsedResult?.bets && result.parsedResult.bets.length > 0 && (
                <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-6">

                    {/* Kết quả parse thành công (không có lỗi) */}
                    {result.success && result.parsedResult?.bets && result.parsedResult.bets.length > 0 && (
                        <>
                            {/* Normalized Message */}
                            <div className="mb-4 p-2.5 sm:p-3 bg-slate-100 rounded-lg">
                                <span className="text-xs sm:text-sm text-slate-600 block mb-1">Tin nhắn đã chuẩn hóa:</span>
                                <p className="font-mono text-xs sm:text-sm whitespace-pre-wrap break-all">{result.normalizedMessage}</p>
                            </div>

                            {/* Summary Table */}
                            {totalsByType && (
                                <div className="mb-4 sm:mb-6">
                                    {/* Mobile: Card layout */}
                                    <div className="sm:hidden space-y-2">
                                        {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((key) => {
                                            const data = totalsByType[key as keyof ExtendedTotalsByType];
                                            if (data.xac === 0 && data.amount === 0) return null;
                                            const netWin = data.winAmount - data.amount;
                                            return (
                                                <div key={key} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                                                    <span className="font-medium text-slate-700">{categoryLabels[key]}</span>
                                                    <div className="text-right">
                                                        <div className="text-slate-600">
                                                            <span className="text-slate-400 text-xs">Xác:</span> {formatMoney(data.xac)} |
                                                            <span className="text-slate-400 text-xs ml-1">Thu:</span> {formatMoney(data.amount)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Trúng: {formatMoney(netWin)} ({data.winPoints}n)
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Total Card */}
                                        <div className="flex items-center justify-between p-3 bg-slate-700 text-white rounded-lg">
                                            <span className="font-semibold">Tổng</span>
                                            <div className="text-right">
                                                <div>
                                                    <span className="text-slate-300 text-xs">Xác:</span> {formatMoney(totalsByType.total.xac)} |
                                                    <span className="text-slate-300 text-xs ml-1">Thu:</span> {formatMoney(totalsByType.total.amount)}
                                                </div>
                                                <div className="text-xs text-slate-300">
                                                    Trúng: {formatMoney(totalsByType.total.winAmount - totalsByType.total.amount)} ({totalsByType.total.winPoints}n)
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Desktop: Table layout */}
                                    <div className="hidden sm:block overflow-x-auto border rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-700 text-white">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Kiểu</th>
                                                    <th className="px-4 py-3 text-center font-medium uppercase tracking-wider">Xác</th>
                                                    <th className="px-4 py-3 text-center font-medium uppercase tracking-wider">Thực Thu</th>
                                                    <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Trúng</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((key) => {
                                                    const data = totalsByType[key as keyof ExtendedTotalsByType];
                                                    const netWin = data.winAmount - data.amount;
                                                    return (
                                                        <tr key={key} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3 text-slate-700">{categoryLabels[key]}</td>
                                                            <td className="px-4 py-3 text-center">{formatMoney(data.xac)}</td>
                                                            <td className="px-4 py-3 text-center">{formatMoney(data.amount)}</td>
                                                            <td className="px-4 py-3 text-right text-slate-700">
                                                                {formatMoney(netWin)} ({data.winPoints}n)
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-slate-100 font-semibold">
                                                    <td className="px-4 py-3 text-slate-900">Tổng</td>
                                                    <td className="px-4 py-3 text-center">{formatMoney(totalsByType.total.xac)}</td>
                                                    <td className="px-4 py-3 text-center">{formatMoney(totalsByType.total.amount)}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700">
                                                        {formatMoney(totalsByType.total.winAmount - totalsByType.total.amount)}
                                                        ({totalsByType.total.winPoints}n)
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Thu/Trả */}
                                    <div className="mt-3 text-right">
                                        {(() => {
                                            const thuTra = totalsByType.total.amount - totalsByType.total.winAmount;
                                            const isPositive = thuTra >= 0;
                                            return (
                                                <span className="text-base sm:text-lg">
                                                    <span className="text-blue-600">Thu</span>/
                                                    <span className="text-red-600">Trả</span>:{' '}
                                                    <span className={`font-bold ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {formatMoney(thuTra)}
                                                    </span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Bets Detail */}
                            <h3 className="font-semibold mb-3 text-slate-800 text-sm sm:text-base">
                                📋 Chi tiết ({result.parsedResult.bets.length} cược)
                            </h3>

                            {/* Mobile: Card layout for bets */}
                            <div className="sm:hidden space-y-2">
                                {(() => {
                                    const groupedBets = new Map<string, {
                                        provinces: string;
                                        type: string;
                                        numbers: string[];
                                        totalPoint: number;
                                    }>();

                                    for (const bet of result.parsedResult?.bets || []) {
                                        const key = `${bet.provinces.join(',')}_${bet.type}`;
                                        const nums = Array.isArray(bet.numbers) ? bet.numbers : [bet.numbers];

                                        if (groupedBets.has(key)) {
                                            const existing = groupedBets.get(key)!;
                                            existing.numbers.push(...nums);
                                            existing.totalPoint += bet.point;
                                        } else {
                                            groupedBets.set(key, {
                                                provinces: bet.provinces.join(', '),
                                                type: bet.type,
                                                numbers: [...nums],
                                                totalPoint: bet.point,
                                            });
                                        }
                                    }

                                    return Array.from(groupedBets.values()).map((group, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border text-sm">
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="font-medium text-slate-700">{group.provinces}</span>
                                                <span className="text-blue-600 font-semibold">{group.totalPoint}đ</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mb-1">{group.type}</div>
                                            <div className="font-mono text-xs text-slate-600 break-all">
                                                {group.numbers.join(' ')}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>

                            {/* Desktop: Table layout for bets */}
                            <div className="hidden sm:block overflow-x-auto border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Đài</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Số</th>
                                            <th className="px-3 py-2 text-left font-medium text-slate-600">Kiểu</th>
                                            <th className="px-3 py-2 text-right font-medium text-slate-600">Điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const groupedBets = new Map<string, {
                                                provinces: string;
                                                type: string;
                                                numbers: string[];
                                                totalPoint: number;
                                            }>();

                                            for (const bet of result.parsedResult?.bets || []) {
                                                const key = `${bet.provinces.join(',')}_${bet.type}`;
                                                const nums = Array.isArray(bet.numbers) ? bet.numbers : [bet.numbers];

                                                if (groupedBets.has(key)) {
                                                    const existing = groupedBets.get(key)!;
                                                    existing.numbers.push(...nums);
                                                    existing.totalPoint += bet.point;
                                                } else {
                                                    groupedBets.set(key, {
                                                        provinces: bet.provinces.join(', '),
                                                        type: bet.type,
                                                        numbers: [...nums],
                                                        totalPoint: bet.point,
                                                    });
                                                }
                                            }

                                            return Array.from(groupedBets.values()).map((group, idx) => (
                                                <tr key={idx} className="border-t hover:bg-slate-50">
                                                    <td className="px-3 py-2">{group.provinces}</td>
                                                    <td className="px-3 py-2 font-mono">{group.numbers.join(' ')}</td>
                                                    <td className="px-3 py-2">{group.type}</td>
                                                    <td className="px-3 py-2 text-right">{group.totalPoint}</td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Không có bet hợp lệ */}
                    {result.parsedResult?.bets?.length === 0 && !result.error && (
                        <div className="text-orange-600 p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200 text-sm">
                            ⚠️ Không có cược hợp lệ. Vui lòng kiểm tra lỗi ở trên.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
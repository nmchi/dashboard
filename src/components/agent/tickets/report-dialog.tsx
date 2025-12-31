'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Copy, Check } from 'lucide-react';

interface ReportDialogProps {
    playerId: string;
    playerName: string;
    dateFrom?: string;
    dateTo?: string;
}

interface RegionData {
    '2c': { xac: number; thucthu: number; winAmount: number; winPoints: number };
    '3c-4c': { xac: number; thucthu: number; winAmount: number; winPoints: number };
    'da': { xac: number; thucthu: number; winAmount: number; winPoints: number };
    'dx': { xac: number; thucthu: number; winAmount: number; winPoints: number };
}

interface ReportData {
    mb: RegionData;
    mt: RegionData;
    mn: RegionData;
    total: {
        xac: number;
        thucthu: number;
        winAmount: number;
        winPoints: number;
    };
}

// Tỷ lệ nhận về mặc định
const DEFAULT_NHAN_VE = 0.95;

export function ReportDialog({ playerId, playerName, dateFrom, dateTo }: ReportDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Form state
    const [noCu1, setNoCu1] = useState<string>('');
    const [noCu2, setNoCu2] = useState<string>('');
    const [showXacTotal, setShowXacTotal] = useState(false);
    const [showThucThuTotal, setShowThucThuTotal] = useState(true);
    const [detailMode, setDetailMode] = useState<'off' | 'xac' | 'thucthu'>('off');
    
    // Tỷ lệ nhận về theo miền và loại (dx dùng chung với da)
    const [nhanVe, setNhanVe] = useState<{
        mb: { '2c': number; '3c-4c': number; 'da': number };
        mt: { '2c': number; '3c-4c': number; 'da': number };
        mn: { '2c': number; '3c-4c': number; 'da': number };
    }>({
        mb: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
        mt: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
        mn: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
    });
    
    // Data
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [drawDate, setDrawDate] = useState<string>('');
    const [dayOfWeek, setDayOfWeek] = useState<string>('');

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (playerId) params.append('userId', playerId);
            if (dateFrom) params.append('dateFrom', dateFrom);
            if (dateTo) params.append('dateTo', dateTo);
            
            const res = await fetch(`/api/tickets/report?${params}`);
            const data = await res.json();
            
            if (data.success) {
                setReportData(data.data);
                setDrawDate(data.drawDate || '');
                setDayOfWeek(data.dayOfWeek || '');
            }
        } catch (error) {
            console.error('Fetch report error:', error);
        } finally {
            setLoading(false);
        }
    }, [playerId, dateFrom, dateTo]);

    useEffect(() => {
        if (open) {
            fetchReport();
        }
    }, [open, fetchReport]);

    // Tính toán số liệu cho một miền
    const calculateRegionTotal = (region: 'mb' | 'mt' | 'mn') => {
        if (!reportData) return { 
            xac: 0, thucthu: 0, trung: 0, cailoi: 0, tongCaiLoi: 0,
            trungDetail: { '2c': 0, '3c-4c': 0, 'da': 0, 'dx': 0 }
        };
        
        const data = reportData[region];
        const rates = nhanVe[region];
        
        let xac = 0;
        let thucthu = 0;
        let trung = 0;
        
        // 2C
        xac += data['2c'].xac;
        thucthu += data['2c'].thucthu;
        trung += data['2c'].winAmount;
        
        // 3C-4C
        xac += data['3c-4c'].xac;
        thucthu += data['3c-4c'].thucthu;
        trung += data['3c-4c'].winAmount;
        
        // Đá
        xac += data['da'].xac;
        thucthu += data['da'].thucthu;
        trung += data['da'].winAmount;
        
        // Đá xiên
        xac += data['dx'].xac;
        thucthu += data['dx'].thucthu;
        trung += data['dx'].winAmount;
        
        // Cái lời = Thực thu - Trúng
        const cailoi = thucthu - trung;
        
        // Tổng cái lời sau khi nhân tỷ lệ nhận về (dx dùng chung rate với da)
        const tongCaiLoi = 
            (data['2c'].thucthu - data['2c'].winAmount) * rates['2c'] +
            (data['3c-4c'].thucthu - data['3c-4c'].winAmount) * rates['3c-4c'] +
            (data['da'].thucthu - data['da'].winAmount) * rates['da'] +
            (data['dx'].thucthu - data['dx'].winAmount) * rates['da']; // dx dùng rate của da
        
        // Chi tiết trúng theo loại
        const trungDetail = {
            '2c': data['2c'].winAmount,
            '3c-4c': data['3c-4c'].winAmount,
            'da': data['da'].winAmount,
            'dx': data['dx'].winAmount,
        };
        
        return { xac, thucthu, trung, cailoi, tongCaiLoi, trungDetail };
    };

    // Tính tổng cộng
    const calculateGrandTotal = () => {
        const mb = calculateRegionTotal('mb');
        const mt = calculateRegionTotal('mt');
        const mn = calculateRegionTotal('mn');
        
        const noCu1Val = parseFloat(noCu1) * 1000 || 0;
        const noCu2Val = parseFloat(noCu2) * 1000 || 0;
        
        const tongCaiLoi = mb.tongCaiLoi + mt.tongCaiLoi + mn.tongCaiLoi + noCu1Val + noCu2Val;
        
        return {
            xac: mb.xac + mt.xac + mn.xac,
            thucthu: mb.thucthu + mt.thucthu + mn.thucthu,
            trung: mb.trung + mt.trung + mn.trung,
            cailoi: mb.cailoi + mt.cailoi + mn.cailoi,
            tongCaiLoi,
        };
    };

    // Format số tiền (chia 1000, hiển thị 1 chữ số thập phân)
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

    // Tạo text để copy
    const generateCopyText = () => {
        if (!reportData) return '';
        
        const total = calculateGrandTotal();
        let text = `Báo sổ (Nhận)\n`;
        
        if (noCu1) text += `Nợ cũ 1: ${noCu1}\n`;
        if (noCu2) text += `Nợ cũ 2: ${noCu2}\n`;
        
        text += `\n${drawDate}, ${dayOfWeek}\n\n`;
        
        const regions: Array<{ key: 'mn' | 'mt' | 'mb'; name: string }> = [
            { key: 'mn', name: 'MN' },
            { key: 'mt', name: 'MT' },
            { key: 'mb', name: 'MB' },
        ];
        
        for (const region of regions) {
            const regionTotal = calculateRegionTotal(region.key);
            
            if (regionTotal.xac === 0) continue;
            
            const data = reportData[region.key];
            
            // Dòng 1: MN: 2c:xxx da:xxx dx:xxx (Tiền xác: xxx, Thực thu: xxx)
            text += `${region.name}: `;
            
            // Chi tiết inline nếu bật
            if (detailMode !== 'off') {
                const getValue = (cat: '2c' | '3c-4c' | 'da' | 'dx') => 
                    detailMode === 'xac' ? data[cat].xac : data[cat].thucthu;
                
                const parts: string[] = [];
                if (data['2c'].xac > 0) parts.push(`2c:${formatMoney(getValue('2c'))}`);
                if (data['3c-4c'].xac > 0) parts.push(`3c-4c:${formatMoney(getValue('3c-4c'))}`);
                if (data['da'].xac > 0) parts.push(`da:${formatMoney(getValue('da'))}`);
                if (data['dx'].xac > 0) parts.push(`dx:${formatMoney(getValue('dx'))}`);
                
                if (parts.length > 0) text += `${parts.join('  ')}  `;
            }
            
            // Phần tổng (Tiền xác: xxx, Thực thu: xxx)
            const totalParts: string[] = [];
            if (showXacTotal) totalParts.push(`Tiền xác: ${formatMoney(regionTotal.xac)}`);
            if (showThucThuTotal) totalParts.push(`Thực thu: ${formatMoney(regionTotal.thucthu)}`);
            if (totalParts.length > 0) text += `(${totalParts.join(', ')})`;
            text += `\n`;
            
            // Dòng 2: Trúng: 2c:xxx
            const trungParts: string[] = [];
            if (regionTotal.trungDetail['2c'] > 0) trungParts.push(`2c:${formatMoney(regionTotal.trungDetail['2c'])}`);
            if (regionTotal.trungDetail['3c-4c'] > 0) trungParts.push(`3c-4c:${formatMoney(regionTotal.trungDetail['3c-4c'])}`);
            if (regionTotal.trungDetail['da'] > 0) trungParts.push(`da:${formatMoney(regionTotal.trungDetail['da'])}`);
            if (regionTotal.trungDetail['dx'] > 0) trungParts.push(`dx:${formatMoney(regionTotal.trungDetail['dx'])}`);
            text += `Trúng: ${trungParts.join(' ')}\n`;
            
            // Dòng 3: Cái lời/lỗ
            const loiLabel = regionTotal.cailoi >= 0 ? 'Cái lời' : 'Cái lỗ';
            text += `${loiLabel}: ${formatMoney(Math.abs(regionTotal.cailoi))} (${nhanVe[region.key]['2c']} -> ${formatMoney(regionTotal.tongCaiLoi)})\n\n`;
        }
        
        text += `Tổng: cái lời ${formatMoney(total.tongCaiLoi)}\n`;
        
        return text;
    };

    const handleCopy = async () => {
        const text = generateCopyText();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const updateNhanVe = (region: 'mb' | 'mt' | 'mn', type: '2c' | '3c-4c' | 'da', value: string) => {
        const numValue = parseFloat(value) || DEFAULT_NHAN_VE;
        setNhanVe(prev => ({
            ...prev,
            [region]: {
                ...prev[region],
                [type]: numValue,
            }
        }));
    };

    const grandTotal = calculateGrandTotal();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Báo sổ
                </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-blue-600">
                        Báo sổ <span className="text-slate-500 font-normal">(Nhận)</span>
                        {playerName && <span className="ml-2 text-sm text-slate-600">- {playerName}</span>}
                    </DialogTitle>
                </DialogHeader>
                
                {loading ? (
                    <div className="py-8 text-center text-slate-500">Đang tải...</div>
                ) : (
                    <div className="space-y-4">
                        {/* Nợ cũ */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Label className="w-16 text-sm shrink-0">Nợ cũ 1:</Label>
                                <Input
                                    type="text"
                                    value={noCu1}
                                    onChange={(e) => setNoCu1(e.target.value)}
                                    placeholder="-123 hoặc 123"
                                    className="h-8"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="w-16 text-sm shrink-0">Nợ cũ 2:</Label>
                                <Input
                                    type="text"
                                    value={noCu2}
                                    onChange={(e) => setNoCu2(e.target.value)}
                                    placeholder="-123 hoặc 123"
                                    className="h-8"
                                />
                            </div>
                        </div>
                        
                        {/* Toggle buttons */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <Button
                                variant={showXacTotal ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setShowXacTotal(!showXacTotal)}
                                className="text-xs"
                            >
                                Mở tiền xác(tổng)
                                <span className="ml-1 text-xs opacity-70">{showXacTotal ? 'Bật' : 'Tắt'}</span>
                            </Button>
                            
                            <Button
                                variant={showThucThuTotal ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setShowThucThuTotal(!showThucThuTotal)}
                                className="text-xs"
                            >
                                Mở thực thu(tổng)
                                <span className="ml-1 text-xs opacity-70">{showThucThuTotal ? 'Bật' : 'Tắt'}</span>
                            </Button>
                            
                            <div className="flex border rounded-lg overflow-hidden">
                                <Button
                                    variant={detailMode === 'off' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('off')}
                                    className="rounded-none text-xs"
                                >
                                    Tắt chi tiết
                                </Button>
                                <Button
                                    variant={detailMode === 'xac' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('xac')}
                                    className="rounded-none text-xs border-l"
                                >
                                    Tiền xác
                                </Button>
                                <Button
                                    variant={detailMode === 'thucthu' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('thucthu')}
                                    className="rounded-none text-xs border-l"
                                >
                                    Thực thu
                                </Button>
                            </div>
                        </div>
                        
                        {/* Kết quả */}
                        <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm">
                            <div className="mb-2 font-semibold">{drawDate}, {dayOfWeek}</div>
                            
                            {reportData && (
                                <>
                                    {/* Miền Nam */}
                                    {reportData.mn && calculateRegionTotal('mn').xac > 0 && (
                                        <RegionReport
                                            name="MN"
                                            data={reportData.mn}
                                            rates={nhanVe.mn}
                                            showXacTotal={showXacTotal}
                                            showThucThuTotal={showThucThuTotal}
                                            detailMode={detailMode}
                                            formatMoney={formatMoney}
                                            calculateRegionTotal={() => calculateRegionTotal('mn')}
                                        />
                                    )}
                                    
                                    {/* Miền Trung */}
                                    {reportData.mt && calculateRegionTotal('mt').xac > 0 && (
                                        <RegionReport
                                            name="MT"
                                            data={reportData.mt}
                                            rates={nhanVe.mt}
                                            showXacTotal={showXacTotal}
                                            showThucThuTotal={showThucThuTotal}
                                            detailMode={detailMode}
                                            formatMoney={formatMoney}
                                            calculateRegionTotal={() => calculateRegionTotal('mt')}
                                        />
                                    )}
                                    
                                    {/* Miền Bắc */}
                                    {reportData.mb && calculateRegionTotal('mb').xac > 0 && (
                                        <RegionReport
                                            name="MB"
                                            data={reportData.mb}
                                            rates={nhanVe.mb}
                                            showXacTotal={showXacTotal}
                                            showThucThuTotal={showThucThuTotal}
                                            detailMode={detailMode}
                                            formatMoney={formatMoney}
                                            calculateRegionTotal={() => calculateRegionTotal('mb')}
                                        />
                                    )}
                                    
                                    {/* Không có dữ liệu */}
                                    {calculateRegionTotal('mn').xac === 0 && 
                                     calculateRegionTotal('mt').xac === 0 && 
                                     calculateRegionTotal('mb').xac === 0 && (
                                        <div className="text-slate-500 italic py-4 text-center">
                                            Không có dữ liệu báo cáo
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {/* Tổng cộng */}
                            {grandTotal.xac > 0 && (
                                <div className="border-t border-slate-300 pt-2 mt-2">
                                    <div className="font-bold text-lg">
                                        Tổng: cái lời{' '}
                                        <span className={grandTotal.tongCaiLoi >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                            {formatMoney(grandTotal.tongCaiLoi)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Bảng tỷ lệ nhận về */}
                        <div className="text-xs text-orange-600 mb-2">
                            Lưu ý: không nhận về thì điền 1, mặc định điền 0.95
                        </div>
                        
                        <table className="w-full text-sm border">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border p-2 text-left">( Nhân về )</th>
                                    <th className="border p-2">2C</th>
                                    <th className="border p-2">3C-4C</th>
                                    <th className="border p-2">Đá/ĐX</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(['mb', 'mt', 'mn'] as const).map((region) => (
                                    <tr key={region}>
                                        <td className={`border p-2 font-medium ${
                                            region === 'mb' ? 'bg-red-50 text-red-700' :
                                            region === 'mt' ? 'bg-orange-50 text-orange-700' :
                                            'bg-blue-50 text-blue-700'
                                        }`}>
                                            {region === 'mb' ? 'Miền bắc' : region === 'mt' ? 'Miền trung' : 'Miền nam'}
                                        </td>
                                        {(['2c', '3c-4c', 'da'] as const).map((type) => (
                                            <td key={type} className="border p-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={nhanVe[region][type]}
                                                    onChange={(e) => updateNhanVe(region, type, e.target.value)}
                                                    className="h-7 text-center text-sm"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* Buttons */}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Thoát
                            </Button>
                            <Button onClick={handleCopy} className="gap-2 flex-1">
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Đã copy!' : 'Copy'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Component hiển thị báo cáo theo miền
function RegionReport({
    name,
    data,
    rates,
    showXacTotal,
    showThucThuTotal,
    detailMode,
    formatMoney,
    calculateRegionTotal,
}: {
    name: string;
    data: RegionData;
    rates: { '2c': number; '3c-4c': number; 'da': number };
    showXacTotal: boolean;
    showThucThuTotal: boolean;
    detailMode: 'off' | 'xac' | 'thucthu';
    formatMoney: (n: number) => string;
    calculateRegionTotal: () => { xac: number; thucthu: number; trung: number; cailoi: number; tongCaiLoi: number; trungDetail: { '2c': number; '3c-4c': number; 'da': number; 'dx': number } };
}) {
    const total = calculateRegionTotal();
    
    // Tạo chi tiết inline: 2c:xxx da:xxx dx:xxx
    const buildDetailInline = () => {
        const parts: string[] = [];
        const getValue = (key: '2c' | '3c-4c' | 'da' | 'dx') => {
            return detailMode === 'xac' ? data[key].xac : data[key].thucthu;
        };
        
        if (data['2c'].xac > 0) parts.push(`2c:${formatMoney(getValue('2c'))}`);
        if (data['3c-4c'].xac > 0) parts.push(`3c-4c:${formatMoney(getValue('3c-4c'))}`);
        if (data['da'].xac > 0) parts.push(`da:${formatMoney(getValue('da'))}`);
        if (data['dx'].xac > 0) parts.push(`dx:${formatMoney(getValue('dx'))}`);
        
        return parts.join('  ');
    };
    
    // Tạo chi tiết trúng: 2c:20n
    const buildTrungDetail = () => {
        const parts: string[] = [];
        if (total.trungDetail['2c'] > 0) parts.push(`2c:${formatMoney(total.trungDetail['2c'])}`);
        if (total.trungDetail['3c-4c'] > 0) parts.push(`3c-4c:${formatMoney(total.trungDetail['3c-4c'])}`);
        if (total.trungDetail['da'] > 0) parts.push(`da:${formatMoney(total.trungDetail['da'])}`);
        if (total.trungDetail['dx'] > 0) parts.push(`dx:${formatMoney(total.trungDetail['dx'])}`);
        return parts.join(' ');
    };
    
    // Tổng phần (Tiền xác: xxx, Thực thu: xxx)
    const buildTotalPart = () => {
        const parts: string[] = [];
        if (showXacTotal) parts.push(`Tiền xác: ${formatMoney(total.xac)}`);
        if (showThucThuTotal) parts.push(`Thực thu: ${formatMoney(total.thucthu)}`);
        return parts.length > 0 ? `(${parts.join(', ')})` : '';
    };
    
    return (
        <div className="mb-4 pb-2 border-b border-slate-200">
            {/* Dòng 1: MN: 2c:xxx da:xxx dx:xxx (Tiền xác: xxx, Thực thu: xxx) */}
            <div className="font-bold">
                {name}: {detailMode !== 'off' && <span className="font-normal">{buildDetailInline()}  </span>}
                <span className="font-normal text-slate-600">{buildTotalPart()}</span>
            </div>
            
            {/* Dòng 2: Trúng: 2c:20n */}
            <div className="text-green-600">
                Trúng: {buildTrungDetail() || ''}
            </div>
            
            {/* Dòng 3: Cái lời/lỗ */}
            <div>
                {total.cailoi >= 0 ? 'Cái lời' : 'Cái lỗ'}: {formatMoney(Math.abs(total.cailoi))}{' '}
                <span className="text-slate-500">
                    ({rates['2c']} {'->'} {formatMoney(total.tongCaiLoi)})
                </span>
            </div>
        </div>
    );
}
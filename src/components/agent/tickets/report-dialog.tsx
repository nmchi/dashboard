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

const DEFAULT_NHAN_VE = 0.95;

export function ReportDialog({ playerId, playerName, dateFrom, dateTo }: ReportDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const [noCu1, setNoCu1] = useState<string>('');
    const [noCu2, setNoCu2] = useState<string>('');
    const [showXacTotal, setShowXacTotal] = useState(false);
    const [showThucThuTotal, setShowThucThuTotal] = useState(true);
    const [detailMode, setDetailMode] = useState<'off' | 'xac' | 'thucthu'>('off');
    
    const [nhanVe, setNhanVe] = useState<{
        mb: { '2c': number; '3c-4c': number; 'da': number };
        mt: { '2c': number; '3c-4c': number; 'da': number };
        mn: { '2c': number; '3c-4c': number; 'da': number };
    }>({
        mb: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
        mt: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
        mn: { '2c': DEFAULT_NHAN_VE, '3c-4c': DEFAULT_NHAN_VE, 'da': DEFAULT_NHAN_VE },
    });
    
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
        
        xac += data['2c'].xac;
        thucthu += data['2c'].thucthu;
        trung += data['2c'].winAmount;
        
        xac += data['3c-4c'].xac;
        thucthu += data['3c-4c'].thucthu;
        trung += data['3c-4c'].winAmount;
        
        xac += data['da'].xac;
        thucthu += data['da'].thucthu;
        trung += data['da'].winAmount;
        
        xac += data['dx'].xac;
        thucthu += data['dx'].thucthu;
        trung += data['dx'].winAmount;
        
        const cailoi = thucthu - trung;
        
        const tongCaiLoi = 
            (data['2c'].thucthu - data['2c'].winAmount) * rates['2c'] +
            (data['3c-4c'].thucthu - data['3c-4c'].winAmount) * rates['3c-4c'] +
            (data['da'].thucthu - data['da'].winAmount) * rates['da'] +
            (data['dx'].thucthu - data['dx'].winAmount) * rates['da'];
        
        const trungDetail = {
            '2c': data['2c'].winAmount,
            '3c-4c': data['3c-4c'].winAmount,
            'da': data['da'].winAmount,
            'dx': data['dx'].winAmount,
        };
        
        return { xac, thucthu, trung, cailoi, tongCaiLoi, trungDetail };
    };

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

    const generateCopyText = () => {
        if (!reportData) return '';
        
        const total = calculateGrandTotal();
        let text = `Báo sổ\n`;
        
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
            
            text += `${region.name}: `;
            
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
            
            const totalParts: string[] = [];
            if (showXacTotal) totalParts.push(`Tiền xác: ${formatMoney(regionTotal.xac)}`);
            if (showThucThuTotal) totalParts.push(`Thực thu: ${formatMoney(regionTotal.thucthu)}`);
            if (totalParts.length > 0) text += `(${totalParts.join(', ')})`;
            text += `\n`;
            
            const trungParts: string[] = [];
            if (regionTotal.trungDetail['2c'] > 0) trungParts.push(`2c:${formatMoney(regionTotal.trungDetail['2c'])}`);
            if (regionTotal.trungDetail['3c-4c'] > 0) trungParts.push(`3c-4c:${formatMoney(regionTotal.trungDetail['3c-4c'])}`);
            if (regionTotal.trungDetail['da'] > 0) trungParts.push(`da:${formatMoney(regionTotal.trungDetail['da'])}`);
            if (regionTotal.trungDetail['dx'] > 0) trungParts.push(`dx:${formatMoney(regionTotal.trungDetail['dx'])}`);
            text += `Trúng: ${trungParts.join(' ')}\n`;
            
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
                <Button variant="outline" className="gap-1.5 text-sm w-full sm:w-auto">
                    <FileText className="h-4 w-4" />
                    <span>Báo sổ</span>
                </Button>
            </DialogTrigger>
            
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-blue-600 text-base sm:text-lg">
                        Báo sổ <span className="text-slate-500 font-normal"></span>
                        {playerName && (
                            <span className="block sm:inline sm:ml-2 text-sm text-slate-600 font-normal">
                                - {playerName}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>
                
                {loading ? (
                    <div className="py-8 text-center text-slate-500">Đang tải...</div>
                ) : (
                    <div className="space-y-3 sm:space-y-4">
                        {/* Nợ cũ - Stack on mobile */}
                        {/* <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label className="w-14 text-xs shrink-0">Nợ cũ 1:</Label>
                                <Input
                                    type="text"
                                    value={noCu1}
                                    onChange={(e) => setNoCu1(e.target.value)}
                                    placeholder="-123 hoặc 123"
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="w-14 text-xs shrink-0">Nợ cũ 2:</Label>
                                <Input
                                    type="text"
                                    value={noCu2}
                                    onChange={(e) => setNoCu2(e.target.value)}
                                    placeholder="-123 hoặc 123"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div> */}
                        
                        {/* Toggle buttons - Wrap nicely */}
                        <div className="space-y-2">
                            {/* Row 1: Tổng toggles */}
                            <div className="flex gap-2">
                                <Button
                                    variant={showXacTotal ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setShowXacTotal(!showXacTotal)}
                                    className="text-xs flex-1 h-8"
                                >
                                    Tiền xác {showXacTotal ? '✓' : ''}
                                </Button>
                                
                                <Button
                                    variant={showThucThuTotal ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setShowThucThuTotal(!showThucThuTotal)}
                                    className="text-xs flex-1 h-8"
                                >
                                    Thực thu {showThucThuTotal ? '✓' : ''}
                                </Button>
                            </div>
                            
                            {/* Row 2: Detail mode */}
                            <div className="flex border rounded-lg overflow-hidden">
                                <Button
                                    variant={detailMode === 'off' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('off')}
                                    className="rounded-none text-xs flex-1 h-8"
                                >
                                    Tắt
                                </Button>
                                <Button
                                    variant={detailMode === 'xac' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('xac')}
                                    className="rounded-none text-xs border-l flex-1 h-8"
                                >
                                    Chi tiết xác
                                </Button>
                                <Button
                                    variant={detailMode === 'thucthu' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDetailMode('thucthu')}
                                    className="rounded-none text-xs border-l flex-1 h-8"
                                >
                                    Chi tiết thu
                                </Button>
                            </div>
                        </div>
                        
                        {/* Kết quả */}
                        <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs sm:text-sm overflow-x-auto">
                            <div className="mb-2 font-semibold text-sm">{drawDate}, {dayOfWeek}</div>
                            
                            {reportData && (
                                <>
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
                                    
                                    {calculateRegionTotal('mn').xac === 0 && 
                                     calculateRegionTotal('mt').xac === 0 && 
                                     calculateRegionTotal('mb').xac === 0 && (
                                        <div className="text-slate-500 italic py-4 text-center text-sm">
                                            Không có dữ liệu báo cáo
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {grandTotal.xac > 0 && (
                                <div className="border-t border-slate-300 pt-2 mt-2">
                                    <div className="font-bold text-sm sm:text-base">
                                        Tổng: cái lời{' '}
                                        <span className={grandTotal.tongCaiLoi >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                            {formatMoney(grandTotal.tongCaiLoi)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Bảng tỷ lệ nhận về */}
                        <div>
                            <div className="text-xs text-orange-600 mb-2">
                                Lưu ý: không nhận về thì điền 1, mặc định 0.95
                            </div>
                            
                            <div className="overflow-x-auto -mx-3 px-3">
                                <table className="w-full text-xs border min-w-[300px]">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border p-1.5 text-left">Nhân về</th>
                                            <th className="border p-1.5 text-center">2C</th>
                                            <th className="border p-1.5 text-center">3C-4C</th>
                                            <th className="border p-1.5 text-center">Đá/ĐX</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(['mb', 'mt', 'mn'] as const).map((region) => (
                                            <tr key={region}>
                                                <td className={`border p-1.5 font-medium ${
                                                    region === 'mb' ? 'bg-red-50 text-red-700' :
                                                    region === 'mt' ? 'bg-orange-50 text-orange-700' :
                                                    'bg-blue-50 text-blue-700'
                                                }`}>
                                                    {region === 'mb' ? 'MB' : region === 'mt' ? 'MT' : 'MN'}
                                                </td>
                                                {(['2c', '3c-4c', 'da'] as const).map((type) => (
                                                    <td key={type} className="border p-1">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={nhanVe[region][type]}
                                                            onChange={(e) => updateNhanVe(region, type, e.target.value)}
                                                            className="h-7 text-center text-xs w-full min-w-[50px]"
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* Buttons */}
                        <div className="flex gap-2 pt-2 sticky bottom-0 bg-white -mx-3 px-3 py-2 border-t sm:border-0 sm:static sm:bg-transparent">
                            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
                                Thoát
                            </Button>
                            <Button onClick={handleCopy} className="gap-1.5 flex-1">
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
    
    const buildDetailInline = () => {
        const parts: string[] = [];
        const getValue = (key: '2c' | '3c-4c' | 'da' | 'dx') => {
            return detailMode === 'xac' ? data[key].xac : data[key].thucthu;
        };
        
        if (data['2c'].xac > 0) parts.push(`2c:${formatMoney(getValue('2c'))}`);
        if (data['3c-4c'].xac > 0) parts.push(`3c:${formatMoney(getValue('3c-4c'))}`);
        if (data['da'].xac > 0) parts.push(`da:${formatMoney(getValue('da'))}`);
        if (data['dx'].xac > 0) parts.push(`dx:${formatMoney(getValue('dx'))}`);
        
        return parts.join(' ');
    };
    
    const buildTrungDetail = () => {
        const parts: string[] = [];
        if (total.trungDetail['2c'] > 0) parts.push(`2c:${formatMoney(total.trungDetail['2c'])}`);
        if (total.trungDetail['3c-4c'] > 0) parts.push(`3c:${formatMoney(total.trungDetail['3c-4c'])}`);
        if (total.trungDetail['da'] > 0) parts.push(`da:${formatMoney(total.trungDetail['da'])}`);
        if (total.trungDetail['dx'] > 0) parts.push(`dx:${formatMoney(total.trungDetail['dx'])}`);
        return parts.join(' ');
    };
    
    const buildTotalPart = () => {
        const parts: string[] = [];
        if (showXacTotal) parts.push(`Xác:${formatMoney(total.xac)}`);
        if (showThucThuTotal) parts.push(`Thu:${formatMoney(total.thucthu)}`);
        return parts.length > 0 ? `(${parts.join(' ')})` : '';
    };
    
    return (
        <div className="mb-3 pb-2 border-b border-slate-200">
            {/* Line 1: Region + Detail + Total */}
            <div className="font-bold text-xs sm:text-sm">
                <span className="text-blue-600">{name}:</span>{' '}
                {detailMode !== 'off' && (
                    <span className="font-normal text-slate-700">{buildDetailInline()} </span>
                )}
                <span className="font-normal text-slate-500 text-xs">{buildTotalPart()}</span>
            </div>
            
            {/* Line 2: Trúng */}
            <div className="text-green-600 text-xs">
                Trúng: {buildTrungDetail() || '0'}
            </div>
            
            {/* Line 3: Cái lời/lỗ */}
            <div className="text-xs">
                <span className={total.cailoi >= 0 ? 'text-blue-600' : 'text-red-600'}>
                    {total.cailoi >= 0 ? 'Lời' : 'Lỗ'}: {formatMoney(Math.abs(total.cailoi))}
                </span>
                {' '}
                <span className="text-slate-400">
                    ({rates['2c']}→{formatMoney(total.tongCaiLoi)})
                </span>
            </div>
        </div>
    );
}
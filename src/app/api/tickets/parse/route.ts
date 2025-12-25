import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Region } from "@prisma/client";
import { parseMessage, normalizeMessage } from "@/utils/parser";
import { getProvincesByDay } from "@/utils/province";
import { getLotteryResults, resultsByProvince, getLastNDigits } from "@/utils/result";
import { ParseMessageResponse, ParsedBet, TotalsByType, TypeTotal, BetSettings } from "@/types/messages";
import { BetSettings as FlatBetSettings, DEFAULT_BET_SETTINGS as FLAT_DEFAULT } from "@/types/bet-settings";

/**
 * POST /api/tickets/parse
 * Preview phân tích tin nhắn (không lưu DB)
 * Lấy đài và kết quả theo miền được chọn
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, userId, region = Region.MN, drawDate } = body;
        
        if (!message || !userId) {
            return NextResponse.json({
                success: false,
                error: 'Thiếu message hoặc userId',
            } as ParseMessageResponse, { status: 400 });
        }
        
        // 1. Lấy thông tin Player và betSettings
        const player = await db.user.findUnique({
            where: { id: userId },
            select: { betSettings: true },
        });
        
        // Cast qua unknown để tránh lỗi TypeScript với Prisma JsonValue
        const flatSettings: FlatBetSettings = player?.betSettings 
            ? (player.betSettings as unknown as FlatBetSettings) 
            : FLAT_DEFAULT;
        
        // Chuyển sang nested format cho parser - cast qua unknown
        const betSettings = convertFlatToNested(flatSettings, region) as unknown as BetSettings;
        
        // 2. Lấy danh sách đài và kiểu cược (CHỈ LẤY ĐÀI QUAY HÔM ĐÓ)
        const date = drawDate ? new Date(drawDate) : new Date();
        const [todayProvinces, betTypes] = await Promise.all([
            getProvincesByDay(region, date),  // Đài quay hôm đó, đã sort theo ordering
            db.betType.findMany(),
        ]);
        
        if (todayProvinces.length === 0) {
            return NextResponse.json({
                success: false,
                error: `Không có đài nào mở xổ ngày ${date.toLocaleDateString('vi-VN')} (${getRegionName(region)})`,
            } as ParseMessageResponse);
        }
        
        // 3. Parse tin nhắn (với đài quay hôm đó)
        const parsedResult = parseMessage(
            message,
            todayProvinces,  // ✅ Đài quay hôm đó
            betTypes,
            betSettings,
            region,
            date
        );
        
        // 4. Chuẩn hóa tin nhắn để hiển thị
        const normalizedMessage = normalizeMessage(
            message,
            todayProvinces,
            betTypes,
            todayProvinces  // ✅ priorityProvinces = đài quay hôm đó (đã sort)
        );
        
        // 5. Lấy kết quả xổ số (CHỈ LẤY THEO MIỀN ĐƯỢC CHỌN)
        const lotteryResults = await getLotteryResults(date, region);
        const resultsMap = resultsByProvince(lotteryResults);
        
        // 6. Tính winAmount cho từng bet
        if (Object.keys(resultsMap).length > 0) {
            for (const bet of parsedResult.bets) {
                const { winCount, winAmount } = calculateWin(bet, resultsMap, flatSettings, region);
                bet.winCount = winCount;
                bet.winAmount = winAmount;
            }
        }
        
        // 7. Tổng hợp theo loại
        const totalByType = calculateTotalsByType(parsedResult.bets);
        
        // 8. Kiểm tra nếu có lỗi validation
        const hasErrors = parsedResult.errors && parsedResult.errors.length > 0;
        
        return NextResponse.json({
            success: !hasErrors || parsedResult.bets.length > 0,  // success nếu có ít nhất 1 bet hợp lệ
            parsedResult,
            normalizedMessage,
            totalByType,
            error: hasErrors && parsedResult.bets.length === 0 
                ? parsedResult.errors![0].message  // Hiển thị lỗi đầu tiên nếu không có bet nào
                : undefined,
        } as ParseMessageResponse);
        
    } catch (error) {
        console.error('Parse message error:', error);
        return NextResponse.json({
            success: false,
            error: 'Lỗi phân tích tin nhắn',
        } as ParseMessageResponse, { status: 500 });
    }
}

/**
 * Lấy tên miền
 */
function getRegionName(region: Region): string {
    const names: Record<Region, string> = {
        MN: 'Miền Nam',
        MT: 'Miền Trung', 
        MB: 'Miền Bắc',
    };
    return names[region];
}

/**
 * Lấy suffix cho region (dùng để truy cập betSettings)
 */
function getRegionSuffix(region: Region): string {
    return region.toLowerCase(); // mn, mt, mb
}

/**
 * Chuyển đổi flat betSettings sang nested format
 * Trả về object với đúng key theo region
 */
function convertFlatToNested(flat: FlatBetSettings, region: Region) {
    const suffix = getRegionSuffix(region); // mn, mt, mb
    
    // Helper để lấy giá trị an toàn theo region
    const getPrice = (type: string): number => {
        const key = `price${type}${suffix}` as keyof FlatBetSettings;
        const val = flat[key];
        return typeof val === 'number' ? val : 75;
    };
    
    const getWin = (type: string, defaultVal: number): number => {
        const key = `win${type}${suffix}` as keyof FlatBetSettings;
        const val = flat[key];
        return typeof val === 'number' ? val : defaultVal;
    };
    
    const priceSettings = {
        price2dau: getPrice('2dau'),
        price2duoi: getPrice('2duoi'),
        price2lo: getPrice('2l'),
        price3dau: getPrice('3dau'),
        price3duoi: getPrice('3duoi'),
        price3lo: getPrice('3l'),
        price4duoi: getPrice('4duoi'),
        price4lo: getPrice('4l'),
        priceda: getPrice('da'),
        pricedx: getPrice('dx'),
    };
    
    const winSettings = {
        win2dau: getWin('2dau', 75),
        win2duoi: getWin('2duoi', 75),
        win2lo: getWin('2l', 75),
        win3dau: getWin('3dau', 650),
        win3duoi: getWin('3duoi', 650),
        win3lo: getWin('3l', 650),
        win4duoi: getWin('4duoi', 5500),
        win4lo: getWin('4l', 5500),
        winda: getWin('da', 650),
        windx: getWin('dx', 550),
    };
    
    // Build object với key cố định (mn là required trong type)
    // Nhưng sẽ cast qua unknown ở nơi gọi
    return {
        prices: {
            mn: priceSettings,
            mt: priceSettings,
            mb: priceSettings,
        },
        winRates: {
            mn: winSettings,
            mt: winSettings,
            mb: winSettings,
        },
    };
}

/**
 * Tính số lần trúng và tiền thắng cho một cược
 */
function calculateWin(
    bet: ParsedBet,
    resultsMap: Record<string, Record<string, string[]>>,
    flatSettings: FlatBetSettings,
    region: Region
): { winCount: number; winAmount: number } {
    let winCount = 0;
    let winAmount = 0;
    
    const numbers = Array.isArray(bet.numbers) ? bet.numbers : [bet.numbers];
    const numDigits = numbers[0]?.length || 2;
    
    const suffix = getRegionSuffix(region);
    
    // Helper để lấy giá trị win rate theo region
    const getWinRate = (type: string, defaultVal: number): number => {
        const key = `win${type}${suffix}` as keyof FlatBetSettings;
        const val = flatSettings[key];
        return typeof val === 'number' ? val : defaultVal;
    };
    
    // Xác định win rate dựa trên loại cược
    let winRate = 75;
    
    switch (bet.type) {
        case 'Đầu':
            winRate = getWinRate('2dau', 75);
            break;
        case 'Đuôi':
            winRate = getWinRate('2duoi', 75);
            break;
        case 'Bao lô':
        case 'Bao đảo':
            if (numDigits === 2) winRate = getWinRate('2l', 75);
            else if (numDigits === 3) winRate = getWinRate('3l', 650);
            else if (numDigits === 4) winRate = getWinRate('4l', 5500);
            break;
        case 'Xỉu chủ':
        case 'Xỉu chủ đầu':
            winRate = getWinRate('3dau', 650);
            break;
        case 'Xỉu chủ đuôi':
            winRate = getWinRate('3duoi', 650);
            break;
        case 'Đá':
        case 'Đá thẳng':
            winRate = getWinRate('da', 650);
            break;
        case 'Đá xiên':
            winRate = getWinRate('dx', 550);
            break;
    }
    
    // Dò số trúng
    for (const provinceName of bet.provinces) {
        const prizes = resultsMap[provinceName];
        if (!prizes) continue;
        
        const lastDigits = getLastNDigits(prizes, numDigits);
        
        for (const num of numbers) {
            const count = lastDigits.filter(d => d === num).length;
            winCount += count;
        }
    }
    
    // Tính tiền thắng
    if (winCount > 0) {
        winAmount = winCount * bet.point * 1000 * winRate;
    }
    
    return { winCount, winAmount };
}

/**
 * Tổng hợp theo loại cược
 */
function calculateTotalsByType(bets: ParsedBet[]): TotalsByType {
    const emptyTotal = (): TypeTotal => ({ amount: 0, winAmount: 0, winCount: 0 });
    
    const totals: TotalsByType = {
        "2c-dd": emptyTotal(),
        "2c-b": emptyTotal(),
        "3c": emptyTotal(),
        "4c": emptyTotal(),
        "dat": emptyTotal(),
        "dax": emptyTotal(),
        "total": emptyTotal(),
    };
    
    for (const bet of bets) {
        let category: keyof TotalsByType = "total";
        
        // Phân loại
        if (bet.type === 'Đầu' || bet.type === 'Đuôi' || bet.type === 'Đầu đuôi') {
            category = "2c-dd";
        } else if (bet.type === 'Bao lô' || bet.type === 'Bao đảo') {
            const num = Array.isArray(bet.numbers) ? bet.numbers[0] : bet.numbers;
            if (num.length === 2) category = "2c-b";
            else if (num.length === 3) category = "3c";
            else if (num.length === 4) category = "4c";
        } else if (bet.type.includes('Xỉu chủ')) {
            category = "3c";
        } else if (bet.type === 'Đá' || bet.type === 'Đá thẳng') {
            category = "dat";
        } else if (bet.type === 'Đá xiên') {
            category = "dax";
        }
        
        // Cộng dồn
        totals[category].amount += bet.amount;
        totals[category].winAmount += bet.winAmount || 0;
        totals[category].winCount += bet.winCount || 0;
        
        totals.total.amount += bet.amount;
        totals.total.winAmount += bet.winAmount || 0;
        totals.total.winCount += bet.winCount || 0;
    }
    
    return totals;
}
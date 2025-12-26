import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Region, TicketStatus, Prisma } from "@prisma/client";
import { parseMessage } from "@/utils/parser";
import { 
    getLotteryResults, 
    resultsByProvince, 
    getLastNDigits,
    getHeadPrizeDigits,
    getTailPrizeDigits,
    getXiuChuHeadDigits,
    getXiuChuTailDigits,
    getAllLo2Digits,
    getAllLo3Digits,
    getAllLo4Digits
} from "@/utils/result";
import { BetSettings as FlatBetSettings, DEFAULT_BET_SETTINGS as FLAT_DEFAULT } from "@/types/bet-settings";
import { ParsedBet, BetSettings } from "@/types/messages";
import { getProvincesByDay } from "@/utils/province";

/**
 * GET /api/tickets
 * Lấy danh sách tickets
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const parentId = searchParams.get('parentId');
        const status = searchParams.get('status') as TicketStatus | null;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        
        if (!userId && !parentId) {
            return NextResponse.json({
                success: false,
                error: 'Thiếu userId hoặc parentId',
            }, { status: 400 });
        }
        
        // Build where clause
        const where: Prisma.TicketWhereInput = {};
        
        if (userId) {
            where.userId = userId;
        } else if (parentId) {
            // Lấy tickets của tất cả players thuộc agent
            where.user = { parentId };
        }
        
        if (status) {
            where.status = status;
        }
        
        const [tickets, total] = await Promise.all([
            db.ticket.findMany({
                where,
                include: {
                    user: {
                        select: { username: true, name: true }
                    },
                    bets: {
                        include: {
                            province: { select: { name: true } },
                            betType: { select: { name: true } },
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            db.ticket.count({ where }),
        ]);
        
        return NextResponse.json({
            success: true,
            data: tickets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
        
    } catch (error) {
        console.error('Get tickets error:', error);
        return NextResponse.json({
            success: false,
            error: 'Đã xảy ra lỗi',
        }, { status: 500 });
    }
}

/**
 * POST /api/tickets
 * Parse và lưu ticket với bets
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
            }, { status: 400 });
        }
        
        // 1. Lấy Player và betSettings
        const player = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, betSettings: true, parentId: true },
        });
        
        if (!player) {
            return NextResponse.json({
                success: false,
                error: 'Không tìm thấy player',
            }, { status: 404 });
        }
        
        // Cast qua unknown để tránh lỗi TypeScript với Prisma JsonValue
        const flatSettings: FlatBetSettings = player.betSettings 
            ? (player.betSettings as unknown as FlatBetSettings) 
            : FLAT_DEFAULT;
        
        // Chuyển sang nested format - cast qua unknown
        const betSettings = convertFlatToNested(flatSettings, region) as unknown as BetSettings;
        
        // 2. Lấy provinces và betTypes (CHỈ LẤY THEO MIỀN ĐƯỢC CHỌN)
        const date = drawDate ? new Date(drawDate) : new Date();
        const [todayProvinces, betTypes] = await Promise.all([
            getProvincesByDay(region, date),  // Đài quay hôm đó
            db.betType.findMany(),
        ]);

        if (todayProvinces.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Không có đài nào mở xổ ngày này',
            }, { status: 400 });
        }
        
        // 3. Parse tin nhắn (chỉ với đài của miền được chọn)
        const parsedResult = parseMessage(
            message,
            todayProvinces,
            betTypes,
            betSettings,
            region,
            date
        );
        
        if (parsedResult.bets.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Không tìm thấy cược hợp lệ trong tin nhắn',
            }, { status: 400 });
        }
        
        // 4. Lấy kết quả xổ số (CHỈ LẤY THEO MIỀN ĐƯỢC CHỌN)
        const lotteryResults = await getLotteryResults(date, region);
        const resultsMap = resultsByProvince(lotteryResults);
        const hasResults = Object.keys(resultsMap).length > 0;
        
        // 5. Tính winAmount cho từng bet
        if (hasResults) {
            for (const bet of parsedResult.bets) {
                const { winCount, winAmount } = calculateWin(bet, resultsMap, flatSettings, region);
                bet.winCount = winCount;
                bet.winAmount = winAmount;
            }
        }
        
        // 6. Tính tổng tiền thu
        const totalAmount = parsedResult.bets.reduce((sum, bet) => sum + bet.amount, 0);
        
        // 7. Chuẩn bị dữ liệu bets để lưu
        const betsCreateData = prepareBetsCreateData(parsedResult.bets, todayProvinces, betTypes);
        
        // 8. Lưu ticket + bets trong transaction
        const ticket = await db.$transaction(async (tx) => {
            const newTicket = await tx.ticket.create({
                data: {
                    user: { connect: { id: player.id } },
                    rawContent: message,
                    region: region,
                    drawDate: date,
                    totalAmount: totalAmount,
                    status: hasResults ? TicketStatus.COMPLETED : TicketStatus.PENDING,
                    bets: {
                        create: betsCreateData,
                    },
                },
                include: {
                    bets: {
                        include: {
                            province: { select: { name: true } },
                            betType: { select: { name: true } },
                        }
                    }
                },
            });
            
            return newTicket;
        });
        
        return NextResponse.json({
            success: true,
            data: ticket,
        });
        
    } catch (error) {
        console.error('Save ticket error:', error);
        return NextResponse.json({
            success: false,
            error: 'Lỗi lưu ticket',
        }, { status: 500 });
    }
}

/**
 * Chuẩn bị dữ liệu bets để lưu vào DB (dùng Prisma connect syntax)
 */
function prepareBetsCreateData(
    bets: ParsedBet[],
    allProvinces: { id: string; name: string; aliases: string }[],
    betTypes: { id: string; name: string; aliases: string }[]
): Prisma.BetCreateWithoutTicketInput[] {
    const betsData: Prisma.BetCreateWithoutTicketInput[] = [];
    
    for (const bet of bets) {
        // Tìm province ID
        const provinceName = bet.provinces[0]; // Lấy đài đầu tiên
        const province = allProvinces.find(p => 
            p.name === provinceName || 
            p.aliases.toLowerCase().split(',').map(a => a.trim()).includes(provinceName.toLowerCase())
        );
        
        if (!province) continue;
        
        // Tìm betType ID
        const betType = betTypes.find(bt => bt.name === bet.type);
        if (!betType) continue;
        
        // Chuẩn bị numbers string
        const numbersStr = Array.isArray(bet.numbers) ? bet.numbers.join(',') : bet.numbers;
        
        betsData.push({
            province: { connect: { id: province.id } },
            betType: { connect: { id: betType.id } },
            numbers: numbersStr,
            point: bet.point,
            amount: bet.amount,
            isWin: (bet.winCount || 0) > 0,
            winCount: bet.winCount || 0,
            winAmount: bet.winAmount || 0,
        });
    }
    
    return betsData;
}

/**
 * Lấy suffix cho region (dùng để truy cập betSettings)
 */
function getRegionSuffix(region: Region): string {
    return region.toLowerCase(); // mn, mt, mb
}

/**
 * Chuyển đổi flat betSettings sang nested format
 * Trả về object với đủ 3 keys (mn, mt, mb) để tránh lỗi type
 */
function convertFlatToNested(flat: FlatBetSettings, region: Region) {
    const suffix = getRegionSuffix(region);
    
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
    
    // Trả về object với đủ 3 keys
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
 * ĐÃ SỬA: Logic dò số KHÁC NHAU cho từng loại cược
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
    
    const getWinRate = (type: string, defaultVal: number): number => {
        const key = `win${type}${suffix}` as keyof FlatBetSettings;
        const val = flatSettings[key];
        return typeof val === 'number' ? val : defaultVal;
    };
    
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
        case 'Xỉu chủ đầu':
        case 'Xỉu chủ đảo đầu':
            winRate = getWinRate('3dau', 650);
            break;
        case 'Xỉu chủ đuôi':
        case 'Xỉu chủ đảo đuôi':
            winRate = getWinRate('3duoi', 650);
            break;
        case 'Đá thẳng':
            winRate = getWinRate('da', 650);
            break;
        case 'Đá xiên':
            winRate = getWinRate('dx', 550);
            break;
    }
    
    // Dò số trúng - LOGIC KHÁC NHAU CHO TỪNG LOẠI CƯỢC
    for (const provinceName of bet.provinces) {
        const prizes = resultsMap[provinceName];
        if (!prizes) continue;
        
        // Lấy danh sách số cần dò TÙY THEO LOẠI CƯỢC
        let digitsToCheck: string[] = [];
        
        switch (bet.type) {
            case 'Đầu':
                // Đầu: CHỈ dò giải 8 (2 số cuối)
                digitsToCheck = getHeadPrizeDigits(prizes);
                break;
                
            case 'Đuôi':
                // Đuôi: CHỈ dò giải ĐB (2 số cuối)
                digitsToCheck = getTailPrizeDigits(prizes);
                break;
                
            case 'Xỉu chủ đầu':
            case 'Xỉu chủ đảo đầu':
                // Xỉu chủ đầu: CHỈ dò giải 7 (3 số cuối)
                digitsToCheck = getXiuChuHeadDigits(prizes);
                break;
                
            case 'Xỉu chủ đuôi':
            case 'Xỉu chủ đảo đuôi':
                // Xỉu chủ đuôi: CHỈ dò giải ĐB (3 số cuối)
                digitsToCheck = getXiuChuTailDigits(prizes);
                break;
                
            case 'Bao lô':
            case 'Bao đảo':
                // Bao lô: dò TẤT CẢ các giải (18 lô MN/MT, 27 lô MB)
                if (numDigits === 2) {
                    digitsToCheck = getAllLo2Digits(prizes);
                } else if (numDigits === 3) {
                    digitsToCheck = getAllLo3Digits(prizes);
                } else if (numDigits === 4) {
                    digitsToCheck = getAllLo4Digits(prizes);
                }
                break;
                
            case 'Đá thẳng':
            case 'Đá xiên':
                // Đá: dò TẤT CẢ 18 lô (2 số cuối)
                digitsToCheck = getAllLo2Digits(prizes);
                break;
                
            default:
                // Mặc định: dùng hàm cũ
                digitsToCheck = getLastNDigits(prizes, numDigits);
        }
        
        // Đếm số lần trúng
        for (const num of numbers) {
            const count = digitsToCheck.filter(d => d === num).length;
            winCount += count;
        }
    }
    
    if (winCount > 0) {
        winAmount = winCount * bet.point * 1000 * winRate;
    }
    
    return { winCount, winAmount };
}
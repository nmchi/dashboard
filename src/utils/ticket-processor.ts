import { db } from "@/lib/prisma";
import { Region, TicketStatus, Prisma } from "@prisma/client";
import { 
    getLotteryResults, 
    resultsByProvince, 
    getHeadPrizeDigits,
    getTailPrizeDigits,
    getXiuChuHeadDigits,
    getXiuChuTailDigits,
    getAllLo2Digits,
    getAllLo3Digits,
    getAllLo4Digits
} from "./result";
import { BetSettings as FlatBetSettings, DEFAULT_BET_SETTINGS as FLAT_DEFAULT } from "@/types/bet-settings";

interface ProcessResult {
    ticketId: string;
    success: boolean;
    betsProcessed: number;
    totalWinAmount: number;
    error?: string;
}

interface BatchProcessResult {
    processed: number;
    success: number;
    failed: number;
    totalWinAmount: number;
    results: ProcessResult[];
}

/**
 * Xử lý một ticket pending - dò số và cập nhật kết quả
 */
export async function processTicket(ticketId: string): Promise<ProcessResult> {
    try {
        // Lấy ticket với bets và user settings
        const ticket = await db.ticket.findUnique({
            where: { id: ticketId },
            include: {
                bets: {
                    include: {
                        province: true,
                        betType: true,
                    }
                },
                user: {
                    select: { betSettings: true }
                }
            }
        });

        if (!ticket) {
            return { ticketId, success: false, betsProcessed: 0, totalWinAmount: 0, error: "Ticket không tồn tại" };
        }

        if (ticket.status === TicketStatus.COMPLETED) {
            return { ticketId, success: true, betsProcessed: 0, totalWinAmount: 0, error: "Ticket đã được xử lý" };
        }

        // Lấy kết quả xổ số
        const lotteryResults = await getLotteryResults(ticket.drawDate, ticket.region);
        const resultsMap = resultsByProvince(lotteryResults);

        if (Object.keys(resultsMap).length === 0) {
            return { ticketId, success: false, betsProcessed: 0, totalWinAmount: 0, error: "Chưa có kết quả xổ số" };
        }

        // Lấy bet settings
        const flatSettings: FlatBetSettings = ticket.user.betSettings 
            ? (ticket.user.betSettings as unknown as FlatBetSettings) 
            : FLAT_DEFAULT;

        let totalWinAmount = 0;
        const betUpdates: { id: string; isWin: boolean; winCount: number; winAmount: number }[] = [];

        // Dò số từng bet
        for (const bet of ticket.bets) {
            const { winCount, winAmount } = calculateBetWin(
                bet,
                resultsMap,
                flatSettings,
                ticket.region
            );

            betUpdates.push({
                id: bet.id,
                isWin: winCount > 0,
                winCount,
                winAmount,
            });

            totalWinAmount += winAmount;
        }

        // Cập nhật database trong transaction
        await db.$transaction(async (tx) => {
            // Cập nhật từng bet
            for (const update of betUpdates) {
                await tx.bet.update({
                    where: { id: update.id },
                    data: {
                        isWin: update.isWin,
                        winCount: update.winCount,
                        winAmount: update.winAmount,
                    }
                });
            }

            // Cập nhật ticket status
            await tx.ticket.update({
                where: { id: ticketId },
                data: { status: TicketStatus.COMPLETED }
            });
        });

        return {
            ticketId,
            success: true,
            betsProcessed: betUpdates.length,
            totalWinAmount,
        };

    } catch (error) {
        console.error(`Process ticket ${ticketId} error:`, error);
        return {
            ticketId,
            success: false,
            betsProcessed: 0,
            totalWinAmount: 0,
            error: String(error),
        };
    }
}

/**
 * Xử lý tất cả tickets pending theo ngày và vùng
 */
export async function processPendingTickets(
    date?: Date,
    region?: Region
): Promise<BatchProcessResult> {
    const result: BatchProcessResult = {
        processed: 0,
        success: 0,
        failed: 0,
        totalWinAmount: 0,
        results: [],
    };

    try {
        // Tìm các ticket pending
        const where: Prisma.TicketWhereInput = {
            status: TicketStatus.PENDING,
        };

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            where.drawDate = {
                gte: startDate,
                lte: endDate,
            };
        }

        if (region) {
            where.region = region;
        }

        const pendingTickets = await db.ticket.findMany({
            where,
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });

        console.log(`Found ${pendingTickets.length} pending tickets`);

        // Xử lý từng ticket
        for (const ticket of pendingTickets) {
            const processResult = await processTicket(ticket.id);
            result.results.push(processResult);
            result.processed++;

            if (processResult.success && !processResult.error?.includes("Chưa có kết quả")) {
                result.success++;
                result.totalWinAmount += processResult.totalWinAmount;
            } else {
                result.failed++;
            }
        }

    } catch (error) {
        console.error("Process pending tickets error:", error);
    }

    return result;
}

/**
 * Xử lý tickets pending cho một user cụ thể
 */
export async function processUserPendingTickets(
    userId: string,
    date?: Date
): Promise<BatchProcessResult> {
    const result: BatchProcessResult = {
        processed: 0,
        success: 0,
        failed: 0,
        totalWinAmount: 0,
        results: [],
    };

    try {
        const where: Prisma.TicketWhereInput = {
            userId,
            status: TicketStatus.PENDING,
        };

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            where.drawDate = {
                gte: startDate,
                lte: endDate,
            };
        }

        const pendingTickets = await db.ticket.findMany({
            where,
            select: { id: true },
        });

        for (const ticket of pendingTickets) {
            const processResult = await processTicket(ticket.id);
            result.results.push(processResult);
            result.processed++;

            if (processResult.success && !processResult.error?.includes("Chưa có kết quả")) {
                result.success++;
                result.totalWinAmount += processResult.totalWinAmount;
            } else {
                result.failed++;
            }
        }

    } catch (error) {
        console.error("Process user pending tickets error:", error);
    }

    return result;
}

/**
 * Tính toán win cho một bet
 */
function calculateBetWin(
    bet: {
        numbers: string;
        point: Prisma.Decimal;
        province: { name: string };
        betType: { name: string };
    },
    resultsMap: Record<string, Record<string, string[]>>,
    flatSettings: FlatBetSettings,
    region: Region
): { winCount: number; winAmount: number } {
    let winCount = 0;
    let winAmount = 0;

    const numbers = bet.numbers.split(',').map(n => n.trim());
    const numDigits = numbers[0]?.length || 2;
    const point = Number(bet.point);
    const suffix = region.toLowerCase() as 'mn' | 'mt' | 'mb';
    const provinceName = bet.province.name;
    const betTypeName = bet.betType.name;

    const getWinRate = (type: string, defaultVal: number): number => {
        const key = `win${type}${suffix}` as keyof FlatBetSettings;
        const val = flatSettings[key];
        return typeof val === 'number' ? val : defaultVal;
    };

    let winRate = 75;

    // Xác định win rate theo loại cược
    switch (betTypeName) {
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
        case 'Đá':
            winRate = getWinRate('da', 650);
            break;
        case 'Đá xiên':
            winRate = getWinRate('dx', 550);
            break;
    }

    // Lấy kết quả của đài
    const prizes = resultsMap[provinceName];
    if (!prizes) {
        return { winCount: 0, winAmount: 0 };
    }

    // ============ LOGIC ĐÁ THẲNG ============
    if ((betTypeName === 'Đá thẳng' || betTypeName === 'Đá') && numbers.length >= 2) {
        const digitsFromProvince = getAllLo2Digits(prizes);
        
        let totalAmount = 0;
        let totalCount = 0;

        for (let i = 0; i < numbers.length; i++) {
            for (let j = i + 1; j < numbers.length; j++) {
                const n1 = numbers[i];
                const n2 = numbers[j];

                const count1 = digitsFromProvince.filter(d => d === n1).length;
                const count2 = digitsFromProvince.filter(d => d === n2).length;

                if (count1 > 0 && count2 > 0) {
                    const combinationWinCount = count1 * 0.5 + count2 * 0.5;
                    totalAmount += combinationWinCount * point * 1000 * winRate;
                    totalCount += combinationWinCount;
                }
            }
        }

        return { winCount: totalCount, winAmount: totalAmount };
    }

    // ============ LOGIC ĐÁ XIÊN ============
    if (betTypeName === 'Đá xiên') {
        // Đá xiên cần xử lý nhiều đài - cần refactor nếu cần
        // Hiện tại chỉ xử lý 1 đài
        const digitsFromProvince = getAllLo2Digits(prizes);
        
        const countMap: Record<string, number> = {};
        for (const digit of digitsFromProvince) {
            countMap[digit] = (countMap[digit] || 0) + 1;
        }

        if (numbers.length === 2) {
            const [n1, n2] = numbers;
            const c1 = countMap[n1] || 0;
            const c2 = countMap[n2] || 0;
            const minCount = Math.min(c1, c2);

            if (minCount > 0) {
                return { 
                    winCount: minCount, 
                    winAmount: minCount * point * 1000 * winRate 
                };
            }
        }

        return { winCount: 0, winAmount: 0 };
    }

    // ============ LOGIC CÁC LOẠI CƯỢC KHÁC ============
    let digitsToCheck: string[] = [];

    switch (betTypeName) {
        case 'Đầu':
            digitsToCheck = getHeadPrizeDigits(prizes);
            break;
        case 'Đuôi':
            digitsToCheck = getTailPrizeDigits(prizes);
            break;
        case 'Xỉu chủ đầu':
        case 'Xỉu chủ đảo đầu':
            digitsToCheck = getXiuChuHeadDigits(prizes);
            break;
        case 'Xỉu chủ đuôi':
        case 'Xỉu chủ đảo đuôi':
            digitsToCheck = getXiuChuTailDigits(prizes);
            break;
        case 'Bao lô':
        case 'Bao đảo':
            if (numDigits === 2) {
                digitsToCheck = getAllLo2Digits(prizes);
            } else if (numDigits === 3) {
                digitsToCheck = getAllLo3Digits(prizes);
            } else if (numDigits === 4) {
                digitsToCheck = getAllLo4Digits(prizes);
            }
            break;
        default:
            digitsToCheck = getAllLo2Digits(prizes);
    }

    // Đếm số lần trúng
    for (const num of numbers) {
        const count = digitsToCheck.filter(d => d === num).length;
        winCount += count;
    }

    if (winCount > 0) {
        winAmount = winCount * point * 1000 * winRate;
    }

    return { winCount, winAmount };
}
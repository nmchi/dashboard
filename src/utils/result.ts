import { db } from "@/lib/prisma";
import { Region, LotteryResult } from "@prisma/client";
import { formatDateISO } from "./date";

export type LotteryResultWithProvince = LotteryResult & {
    province: { name: string };
};

/**
 * Lấy kết quả xổ số theo ngày và vùng
 */
export async function getLotteryResults(
    date: Date | string,
    region?: Region
): Promise<LotteryResultWithProvince[]> {
    const dateStr = formatDateISO(date);
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);
    
    return db.lotteryResult.findMany({
        where: {
            drawDate: {
                gte: startDate,
                lte: endDate,
            },
            ...(region ? { region } : {}),
        },
        include: {
            province: {
                select: { name: true }
            }
        }
    });
}

/**
 * Chuyển kết quả thành map theo tên đài
 */
export function resultsByProvince(
    results: LotteryResultWithProvince[]
): Record<string, Record<string, string[]>> {
    const map: Record<string, Record<string, string[]>> = {};
    
    for (const result of results) {
        const provinceName = result.province.name;
        const prizes = result.prizes as Record<string, string[]>;
        map[provinceName] = prizes;
    }
    
    return map;
}

/**
 * Lấy 2 số cuối từ tất cả các giải
 */
export function getLastTwoDigits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    for (const prizeKey in prizes) {
        const values = prizes[prizeKey];
        if (Array.isArray(values)) {
            for (const value of values) {
                result.push(value.slice(-2));
            }
        }
    }
    
    return result;
}

/**
 * Lấy N số cuối từ các giải phù hợp
 */
export function getLastNDigits(
    prizes: Record<string, string[]>, 
    n: number
): string[] {
    const result: string[] = [];
    
    // Với 2 số: tất cả các giải
    // Với 3 số: từ giải 7 trở lên
    // Với 4 số: từ giải 6 trở lên
    const validPrizes: Record<number, string[]> = {
        2: Object.keys(prizes),
        3: ['G.7', 'G.6', 'G.5', 'G.4', 'G.3', 'G.2', 'G.1', 'G.ĐB', 'ĐB'],
        4: ['G.6', 'G.5', 'G.4', 'G.3', 'G.2', 'G.1', 'G.ĐB', 'ĐB'],
    };
    
    const allowedPrizes = validPrizes[n] || validPrizes[2];
    
    for (const prizeKey of allowedPrizes) {
        const values = prizes[prizeKey];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (value.length >= n) {
                    result.push(value.slice(-n));
                }
            }
        }
    }
    
    return result;
}
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

/**
 * Lấy 2 số cuối của GIẢI 8 (dùng cho kiểu "Đầu")
 * Giải 8 là giải có 2 chữ số
 * 
 * Ví dụ: Tây Ninh giải 8 = 94 → trả về ["94"]
 */
export function getHeadPrizeDigits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    // Giải 8 có key "G.8" hoặc "8"
    const g8Values = prizes['G.8'] || prizes['8'] || [];
    
    for (const value of g8Values) {
        // Giải 8 thường có 2 chữ số, lấy nguyên hoặc 2 số cuối
        result.push(value.slice(-2));
    }
    
    return result;
}

/**
 * Lấy 2 số cuối của GIẢI ĐẶC BIỆT (dùng cho kiểu "Đuôi")
 * 
 * Ví dụ: Tây Ninh giải ĐB = 879863 → trả về ["63"]
 */
export function getTailPrizeDigits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    // Giải ĐB có key "G.ĐB", "ĐB", "DB", "G.DB"
    const dbValues = prizes['G.ĐB'] || prizes['ĐB'] || prizes['G.DB'] || prizes['DB'] || [];
    
    for (const value of dbValues) {
        // Lấy 2 số cuối của giải ĐB
        result.push(value.slice(-2));
    }
    
    return result;
}

/**
 * Lấy 3 số cuối của GIẢI 7 (dùng cho Xỉu chủ đầu)
 * Giải 7 là giải có 3 chữ số
 */
export function getXiuChuHeadDigits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    const g7Values = prizes['G.7'] || prizes['7'] || [];
    
    for (const value of g7Values) {
        result.push(value.slice(-3));
    }
    
    return result;
}

/**
 * Lấy 3 số cuối của GIẢI ĐẶC BIỆT (dùng cho Xỉu chủ đuôi)
 */
export function getXiuChuTailDigits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    const dbValues = prizes['G.ĐB'] || prizes['ĐB'] || prizes['G.DB'] || prizes['DB'] || [];
    
    for (const value of dbValues) {
        result.push(value.slice(-3));
    }
    
    return result;
}

/**
 * Lấy tất cả 2 số cuối từ TẤT CẢ các giải (dùng cho Bao lô 2 số, Đá thẳng, Đá xiên)
 * Miền Nam/Trung: 18 lô
 * Miền Bắc: 27 lô
 */
export function getAllLo2Digits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    for (const prizeKey in prizes) {
        const values = prizes[prizeKey];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (value.length >= 2) {
                    result.push(value.slice(-2));
                }
            }
        }
    }
    
    return result;
}

/**
 * Lấy tất cả 3 số cuối từ các giải có >= 3 chữ số (dùng cho Bao lô 3 số)
 * Từ giải 7 trở lên
 */
export function getAllLo3Digits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    // Các giải có >= 3 chữ số
    const validKeys = ['G.7', '7', 'G.6', '6', 'G.5', '5', 'G.4', '4', 'G.3', '3', 'G.2', '2', 'G.1', '1', 'G.ĐB', 'ĐB', 'G.DB', 'DB'];
    
    for (const prizeKey of validKeys) {
        const values = prizes[prizeKey];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (value.length >= 3) {
                    result.push(value.slice(-3));
                }
            }
        }
    }
    
    return result;
}

/**
 * Lấy tất cả 4 số cuối từ các giải có >= 4 chữ số (dùng cho Bao lô 4 số)
 * Từ giải 6 trở lên
 */
export function getAllLo4Digits(prizes: Record<string, string[]>): string[] {
    const result: string[] = [];
    
    // Các giải có >= 4 chữ số
    const validKeys = ['G.6', '6', 'G.5', '5', 'G.4', '4', 'G.3', '3', 'G.2', '2', 'G.1', '1', 'G.ĐB', 'ĐB', 'G.DB', 'DB'];
    
    for (const prizeKey of validKeys) {
        const values = prizes[prizeKey];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (value.length >= 4) {
                    result.push(value.slice(-4));
                }
            }
        }
    }
    
    return result;
}
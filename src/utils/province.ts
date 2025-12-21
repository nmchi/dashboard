import { db } from "@/lib/prisma";
import { Region, LotteryProvince, LotterySchedule } from "@prisma/client";
import { getDayOfWeek } from "./date";
import { BetSettings } from "@/types/messages";

export type ProvinceWithSchedule = LotteryProvince & {
    schedules: LotterySchedule[];
};

/**
 * Lấy danh sách đài theo vùng và ngày
 */
export async function getProvincesByDay(
    region: Region = Region.MN, 
    date?: Date | string
): Promise<ProvinceWithSchedule[]> {
    const dayOfWeek = getDayOfWeek(date);
    
    const provinces = await db.lotteryProvince.findMany({
        where: {
            region: region,
            schedules: {
                some: {
                    dayOfWeek: dayOfWeek,
                    region: region,
                }
            }
        },
        include: {
            schedules: {
                where: {
                    dayOfWeek: dayOfWeek,
                },
                orderBy: {
                    ordering: 'asc',
                }
            }
        },
        orderBy: {
            name: 'asc',
        }
    });
    
    // Sắp xếp theo ordering của schedule
    return provinces.sort((a, b) => {
        const orderA = a.schedules[0]?.ordering || 999;
        const orderB = b.schedules[0]?.ordering || 999;
        return orderA - orderB;
    });
}

/**
 * Tìm đài theo alias/syntax
 */
export function findProvinceByAlias(
    provinces: LotteryProvince[], 
    alias: string
): LotteryProvince | undefined {
    const lowerAlias = alias.toLowerCase().trim();
    
    return provinces.find(p => {
        const aliases = p.aliases.toLowerCase().split(',').map(a => a.trim());
        return aliases.includes(lowerAlias) || p.name.toLowerCase() === lowerAlias;
    });
}

/**
 * Lấy tất cả aliases của các đài
 */
export function getAllProvinceAliases(provinces: LotteryProvince[]): string[] {
    const aliases: string[] = [];
    
    for (const province of provinces) {
        const provinceAliases = province.aliases.split(',').map(a => a.trim().toLowerCase());
        aliases.push(...provinceAliases);
    }
    
    return aliases;
}

/**
 * Lấy đài ưu tiên từ betSettings
 */
export function getPriorityProvinces(
    betSettings: BetSettings | null,
    region: Region,
    dayOfWeek: number,
    allProvinces: LotteryProvince[]
): LotteryProvince[] {
    if (!betSettings?.priorityProvinces?.[region]?.[dayOfWeek]) {
        return [];
    }
    
    const priorities = betSettings.priorityProvinces[region][dayOfWeek];
    const result: LotteryProvince[] = [];
    
    // Sắp xếp theo priority
    const sorted = [...priorities].sort((a, b) => a.priority - b.priority);
    
    for (const item of sorted) {
        const province = allProvinces.find(p => p.id === item.provinceId);
        if (province) {
            result.push(province);
        }
    }
    
    return result;
}
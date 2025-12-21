import { db } from "@/lib/prisma";
import { BetType } from "@prisma/client";

/**
 * Lấy tất cả các loại cược
 */
export async function getBetTypes(): Promise<BetType[]> {
    return db.betType.findMany({
        orderBy: { name: 'asc' }
    });
}

/**
 * Tìm loại cược theo alias
 */
export function findBetTypeByAlias(
    betTypes: BetType[], 
    alias: string
): BetType | undefined {
    const lowerAlias = alias.toLowerCase().trim();
    
    return betTypes.find(bt => {
        const aliases = bt.aliases.toLowerCase().split(',').map(a => a.trim());
        return aliases.includes(lowerAlias);
    });
}

/**
 * Lấy tất cả aliases của các loại cược
 */
export function getAllBetTypeAliases(betTypes: BetType[]): string[] {
    const aliases: string[] = [];
    
    for (const bt of betTypes) {
        const btAliases = bt.aliases.split(',').map(a => a.trim().toLowerCase());
        aliases.push(...btAliases);
    }
    
    return aliases;
}
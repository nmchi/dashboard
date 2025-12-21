import { LotteryProvince, BetType, Region } from "@prisma/client";
import { ParsedBet, ParsedMessage, BetSettings, DEFAULT_BET_SETTINGS, PriceSettings } from "@/types/messages";
import { getDayOfWeek } from "./date";
import { findProvinceByAlias, getPriorityProvinces } from "./province";
import { normalizeMessage } from "./normalizer";
import { findBetTypeByAlias } from "./bet-type";
import { generatePermutations } from "./permutation";

const DEFAULT_PRICE = 1000;

interface ParseContext {
    provinces: LotteryProvince[];
    betTypes: BetType[];
    betSettings: BetSettings;
    region: Region;
}

/**
 * Phân tích tin nhắn cược
 */
export function parseMessage(
    rawMessage: string,
    provinces: LotteryProvince[],
    betTypes: BetType[],
    betSettings: BetSettings | null,
    region: Region = Region.MN,
    date?: Date | string
): ParsedMessage {
    const settings = betSettings || DEFAULT_BET_SETTINGS;
    const dayOfWeek = getDayOfWeek(date);
    
    const priorityProvinces = getPriorityProvinces(
        settings, 
        region, 
        dayOfWeek,
        provinces
    );
    
    // Chuẩn hóa tin nhắn
    const normalizedMessage = normalizeMessage(
        rawMessage, 
        provinces, 
        betTypes, 
        priorityProvinces.length > 0 ? priorityProvinces : provinces
    );
    
    const context: ParseContext = {
        provinces,
        betTypes,
        betSettings: settings,
        region,
    };
    
    return parseNormalizedMessage(normalizedMessage, context);
}

/**
 * Phân tích tin nhắn đã chuẩn hóa
 */
function parseNormalizedMessage(
    normalizedMessage: string, 
    context: ParseContext
): ParsedMessage {
    const result: ParsedMessage = { bets: [] };
    const parts = normalizedMessage.split(' ').filter(p => p.length > 0);
    
    // Tìm tất cả các đài được đề cập
    const mentionedProvinces: LotteryProvince[] = [];
    for (const part of parts) {
        const province = findProvinceByAlias(context.provinces, part);
        if (province && !mentionedProvinces.find(p => p.id === province.id)) {
            mentionedProvinces.push(province);
        }
    }
    
    if (mentionedProvinces.length === 0) {
        return result;
    }
    
    // Parse từng phần
    let currentProvinces: LotteryProvince[] = [...mentionedProvinces];
    let currentNumbers: string[] = [];
    let lastPartType: 'none' | 'province' | 'number' | 'betType' | 'point' = 'none';
    let i = 0;
    
    while (i < parts.length) {
        const part = parts[i];
        
        // Kiểm tra đài
        const province = findProvinceByAlias(context.provinces, part);
        if (province) {
            if (lastPartType === 'betType' || lastPartType === 'point') {
                currentProvinces = [province];
                currentNumbers = [];
            } else if (lastPartType !== 'province') {
                currentProvinces = [province];
            } else {
                if (!currentProvinces.find(p => p.id === province.id)) {
                    currentProvinces.push(province);
                }
            }
            lastPartType = 'province';
            i++;
            continue;
        }
        
        // Kiểm tra số
        if (/^\d+$/.test(part)) {
            if (lastPartType === 'point' || lastPartType === 'betType') {
                currentNumbers = [part];
            } else {
                currentNumbers.push(part);
            }
            lastPartType = 'number';
            i++;
            continue;
        }
        
        // Kiểm tra loại cược
        const betType = findBetTypeByAlias(context.betTypes, part);
        if (betType) {
            i++;
            lastPartType = 'betType';
            
            // Lấy điểm cược
            let point = 1;
            if (i < parts.length && /^\d+$/.test(parts[i])) {
                // Kiểm tra số thập phân (0 5 = 0.5)
                if (i + 1 < parts.length && /^\d$/.test(parts[i + 1])) {
                    if (parts[i] === '0' || parseInt(parts[i]) < 10) {
                        point = parseFloat(`${parts[i]}.${parts[i + 1]}`);
                        i += 2;
                    } else {
                        point = parseInt(parts[i]);
                        i++;
                    }
                } else {
                    point = parseInt(parts[i]);
                    i++;
                }
                lastPartType = 'point';
            }
            
            // Tạo các cược
            const bets = createBets(
                currentNumbers,
                betType,
                point,
                currentProvinces,
                context
            );
            
            result.bets.push(...bets);
            continue;
        }
        
        i++;
        lastPartType = 'none';
    }
    
    return result;
}

/**
 * Tạo các cược từ thông tin đã parse
 */
function createBets(
    numbers: string[],
    betType: BetType,
    point: number,
    provinces: LotteryProvince[],
    context: ParseContext
): ParsedBet[] {
    const bets: ParsedBet[] = [];
    const provinceNames = provinces.map(p => p.name);
    
    const betTypeName = betType.name;
    
    // Xử lý theo loại cược đặc biệt
    if (betTypeName === 'Đá' || betTypeName === 'Đá thẳng') {
        // Đá: gom tất cả số thành 1 cược
        if (numbers.length >= 2) {
            const bet = createSingleBet(numbers, betTypeName, point, provinceNames, context);
            bets.push(bet);
        }
        return bets;
    }
    
    if (betTypeName === 'Đá xiên') {
        if (numbers.length >= 2) {
            const bet = createSingleBet(numbers, betTypeName, point, provinceNames, context);
            bets.push(bet);
        }
        return bets;
    }
    
    if (betTypeName === 'Đầu đuôi') {
        // Tách thành 2 cược: Đầu và Đuôi
        for (const num of numbers) {
            const betDau = createSingleBet(num, 'Đầu', point, provinceNames, context);
            const betDuoi = createSingleBet(num, 'Đuôi', point, provinceNames, context);
            bets.push(betDau, betDuoi);
        }
        return bets;
    }
    
    if (betTypeName === 'Xỉu chủ') {
        // Tách thành Xỉu chủ đầu và Xỉu chủ đuôi
        for (const num of numbers) {
            if (num.length === 3) {
                const betDau = createSingleBet(num, 'Xỉu chủ đầu', point, provinceNames, context);
                const betDuoi = createSingleBet(num, 'Xỉu chủ đuôi', point, provinceNames, context);
                bets.push(betDau, betDuoi);
            }
        }
        return bets;
    }
    
    if (betTypeName === 'Bao đảo' || betTypeName === 'Xỉu chủ đảo') {
        // Tạo hoán vị cho mỗi số
        for (const num of numbers) {
            if (num.length >= 2 && num.length <= 4) {
                const permutations = generatePermutations(num);
                for (const perm of permutations) {
                    const bet = createSingleBet(perm, betTypeName, point, provinceNames, context);
                    bets.push(bet);
                }
            }
        }
        return bets;
    }
    
    // Các loại cược thông thường: tạo 1 cược cho mỗi số
    for (const num of numbers) {
        const bet = createSingleBet(num, betTypeName, point, provinceNames, context);
        bets.push(bet);
    }
    
    return bets;
}

/**
 * Tạo một cược đơn
 */
function createSingleBet(
    numbers: string | string[],
    typeName: string,
    point: number,
    provinces: string[],
    context: ParseContext
): ParsedBet {
    const amount = calculateAmount(
        typeName,
        numbers,
        point,
        provinces.length,
        context.betSettings,
        context.region
    );
    
    return {
        numbers,
        type: typeName,
        point,
        provinces,
        amount,
    };
}

/**
 * Tính tiền thu từ khách (đã × price%)
 */
function calculateAmount(
    betType: string,
    numbers: string | string[],
    point: number,
    provinceCount: number,
    betSettings: BetSettings,
    region: Region
): number {
    // Lấy price từ settings theo vùng
    const regionKey = region.toLowerCase() as 'mn' | 'mt' | 'mb';
    const prices = betSettings.prices[regionKey] || betSettings.prices.mn;
    
    const numArray = Array.isArray(numbers) ? numbers : [numbers];
    const numberOfDigits = numArray[0].length;
    const numberCount = numArray.length;
    
    // Tính tiền gốc (bodyprice)
    let bodyprice = 0;
    
    switch (betType) {
        case 'Đá xiên': {
            const basePrice = DEFAULT_PRICE * 36;
            const combinationFactor = numberCount === 2 ? 1 : (numberCount * (numberCount - 1)) / 2;
            let stationMultiplier = 1;
            if (provinceCount === 3) stationMultiplier = 3;
            else if (provinceCount >= 4) stationMultiplier = 6;
            
            bodyprice = basePrice * combinationFactor * 2 * point * stationMultiplier;
            return Math.round(bodyprice * (prices.pricedx / 100));
        }
            
        case 'Đầu':
            bodyprice = (point * DEFAULT_PRICE) * provinceCount;
            return Math.round(bodyprice * (prices.price2dau / 100));
            
        case 'Đuôi':
            bodyprice = (point * DEFAULT_PRICE) * provinceCount;
            return Math.round(bodyprice * (prices.price2duoi / 100));
            
        case 'Đá':
        case 'Đá thẳng': {
            const basePrice = DEFAULT_PRICE * 36;
            const combinationFactor = numberCount === 2 ? 1 : (numberCount * (numberCount - 1)) / 2;
            bodyprice = (basePrice * combinationFactor * point) * provinceCount;
            return Math.round(bodyprice * (prices.priceda / 100));
        }
            
        case 'Bao lô':
        case 'Bao đảo':
            if (numberOfDigits === 2) {
                bodyprice = (point * DEFAULT_PRICE * 18) * provinceCount;
                return Math.round(bodyprice * (prices.price2lo / 100));
            } else if (numberOfDigits === 3) {
                bodyprice = (point * DEFAULT_PRICE * 17) * provinceCount;
                return Math.round(bodyprice * (prices.price3lo / 100));
            } else if (numberOfDigits === 4) {
                bodyprice = (point * DEFAULT_PRICE * 16) * provinceCount;
                return Math.round(bodyprice * (prices.price4lo / 100));
            }
            break;
            
        case 'Xỉu chủ đầu':
        case 'Xỉu chủ đảo đầu':
            bodyprice = (point * DEFAULT_PRICE) * provinceCount;
            return Math.round(bodyprice * (prices.price3dau / 100));
            
        case 'Xỉu chủ đuôi':
        case 'Xỉu chủ đảo đuôi':
            bodyprice = (point * DEFAULT_PRICE) * provinceCount;
            if (numberOfDigits === 3) {
                return Math.round(bodyprice * (prices.price3duoi / 100));
            } else if (numberOfDigits === 4) {
                return Math.round(bodyprice * (prices.price4duoi / 100));
            }
            break;
    }
    
    return 0;
}

export { normalizeMessage };
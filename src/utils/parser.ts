import { LotteryProvince, BetType, Region } from "@prisma/client";
import { ParsedBet, ParsedMessage, ParseError, BetSettings, DEFAULT_BET_SETTINGS } from "@/types/messages";
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
    errors: ParseError[];  // Collect errors during parsing
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
        errors: [],
    };
    
    const result = parseNormalizedMessage(normalizedMessage, context);
    
    // Attach errors to result
    if (context.errors.length > 0) {
        result.errors = context.errors;
    }
    
    return result;
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
    const provinceCount = provinces.length;
    
    const betTypeName = betType.name;
    
    // ========================================
    // VALIDATION: Đá xiên
    // - Yêu cầu ít nhất 2 đài
    // - Yêu cầu 2-4 số
    // ========================================
    if (betTypeName === 'Đá xiên') {
        // Validate số đài
        if (provinceCount < 2) {
            context.errors.push({
                message: `Đá xiên yêu cầu ít nhất 2 đài (hiện có ${provinceCount} đài: ${provinceNames.join(', ')})`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
            });
            return bets; // Không tạo bet
        }
        
        // Validate số lượng số
        if (numbers.length < 2) {
            context.errors.push({
                message: `Đá xiên yêu cầu ít nhất 2 số (hiện có ${numbers.length} số: ${numbers.join(', ')})`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
            });
            return bets;
        }
        
        if (numbers.length > 4) {
            context.errors.push({
                message: `Đá xiên tối đa 4 số (hiện có ${numbers.length} số: ${numbers.join(', ')})`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
            });
            return bets;
        }
        
        // Validation passed - tạo bet
        const bet = createSingleBet(numbers, betTypeName, point, provinceNames, context);
        bets.push(bet);
        return bets;
    }
    
    // ========================================
    // VALIDATION: Đá thẳng
    // - Yêu cầu ít nhất 2 số
    // ========================================
    if (betTypeName === 'Đá' || betTypeName === 'Đá thẳng') {
        if (numbers.length < 2) {
            context.errors.push({
                message: `Đá thẳng yêu cầu ít nhất 2 số (hiện có ${numbers.length} số)`,
                type: betTypeName,
                numbers: numbers,
                provinces: provinceNames,
            });
            return bets;
        }
        
        const bet = createSingleBet(numbers, betTypeName, point, provinceNames, context);
        bets.push(bet);
        return bets;
    }
    
    // ========================================
    // Các loại cược khác (giữ nguyên logic cũ)
    // ========================================
    
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
            } else {
                context.errors.push({
                    message: `Xỉu chủ yêu cầu số có 3 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Xỉu chủ',
                    numbers: [num],
                    provinces: provinceNames,
                });
            }
        }
        return bets;
    }
    
    if (betTypeName === 'Xỉu chủ đảo') {
        // Xỉu chủ đảo: hoán vị + tách đầu/đuôi
        for (const num of numbers) {
            if (num.length === 3) {
                const permutations = generatePermutations(num);
                for (const perm of permutations) {
                    const betDau = createSingleBet(perm, 'Xỉu chủ đảo đầu', point, provinceNames, context);
                    const betDuoi = createSingleBet(perm, 'Xỉu chủ đảo đuôi', point, provinceNames, context);
                    bets.push(betDau, betDuoi);
                }
            } else {
                context.errors.push({
                    message: `Xỉu chủ đảo yêu cầu số có 3 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Xỉu chủ đảo',
                    numbers: [num],
                    provinces: provinceNames,
                });
            }
        }
        return bets;
    }
    
    if (betTypeName === 'Xỉu chủ đảo đầu') {
        // Xỉu chủ đảo đầu: hoán vị, chỉ dò đầu
        for (const num of numbers) {
            if (num.length === 3) {
                const permutations = generatePermutations(num);
                for (const perm of permutations) {
                    const bet = createSingleBet(perm, 'Xỉu chủ đảo đầu', point, provinceNames, context);
                    bets.push(bet);
                }
            }
        }
        return bets;
    }
    
    if (betTypeName === 'Xỉu chủ đảo đuôi') {
        // Xỉu chủ đảo đuôi: hoán vị, chỉ dò đuôi
        for (const num of numbers) {
            if (num.length === 3) {
                const permutations = generatePermutations(num);
                for (const perm of permutations) {
                    const bet = createSingleBet(perm, 'Xỉu chủ đảo đuôi', point, provinceNames, context);
                    bets.push(bet);
                }
            }
        }
        return bets;
    }
    
    if (betTypeName === 'Bao đảo') {
        // Bao đảo: hoán vị, tính như Bao lô
        for (const num of numbers) {
            if (num.length >= 2 && num.length <= 4) {
                const permutations = generatePermutations(num);
                for (const perm of permutations) {
                    const bet = createSingleBet(perm, 'Bao lô', point, provinceNames, context);
                    bets.push(bet);
                }
            } else {
                context.errors.push({
                    message: `Bao đảo yêu cầu số có 2-4 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Bao đảo',
                    numbers: [num],
                    provinces: provinceNames,
                });
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
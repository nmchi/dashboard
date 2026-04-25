import { LotteryProvince, BetType, Region } from "@prisma/client";
import { ParsedBet, ParsedMessage, ParseError, BetSettings, DEFAULT_BET_SETTINGS } from "@/types/messages";
import { getDayOfWeek } from "./date";
import { findProvinceByAlias, getPriorityProvinces } from "./province";
import { normalizeMessage } from "./normalizer";
import { findBetTypeByAlias } from "./bet-type";
import { generatePermutations } from "./permutation";

const DEFAULT_PRICE = 1000;

interface ParseContext {
    provinces: LotteryProvince[];        // Đài xổ hôm nay
    allProvinces: LotteryProvince[];     // Tất cả đài (dùng để phát hiện đài không xổ hôm nay)
    betTypes: BetType[];
    betSettings: BetSettings;
    region: Region;
    priorityProvinces: LotteryProvince[];  // Đài ưu tiên cho ngày hiện tại
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
    date?: Date | string,
    allProvinces?: LotteryProvince[]
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
        allProvinces: allProvinces || provinces,
        betTypes,
        betSettings: settings,
        region,
        priorityProvinces: priorityProvinces.length > 0 ? priorityProvinces : provinces,
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

    // Kiểm tra xem có phải là cược Đá xiên không
    const hasDaXien = parts.some(part => {
        const betType = findBetTypeByAlias(context.betTypes, part);
        return betType && betType.name === 'Đá xiên';
    });

    // Nếu không có đài được đề cập:
    // - Đá xiên: Cho phép tiếp tục (sẽ auto-assign đài ưu tiên sau)
    // - Các kiểu khác: Yêu cầu phải có đài
    if (mentionedProvinces.length === 0 && !hasDaXien) {
        context.errors.push({
            message: `Không tìm thấy tên đài hợp lệ. Tin nhắn phải bắt đầu bằng tên đài (ví dụ: vl, tg, bt...)`,
            rawFragment: parts.length > 0 ? parts[0] : undefined,
        });
        return result;
    }

    // Parse từng phần
    // Nếu có đài được đề cập → dùng đài đó
    // Nếu không có đài (chỉ với Đá xiên) → dùng mảng rỗng, sẽ auto-assign sau
    let currentProvinces: LotteryProvince[] = mentionedProvinces.length > 0
        ? [...mentionedProvinces]
        : [];
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
            if (lastPartType === 'point') {
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
            const betAlias = part; // Lưu alias gốc để dùng cho rawFragment
            i++;
            lastPartType = 'betType';

            // Lấy điểm cược - BẮT BUỘC phải có
            // Hỗ trợ cả số nguyên (5) và thập phân (5.8, 0.5)
            let point: number | null = null;
            if (i < parts.length && /^\d+(\.\d+)?$/.test(parts[i])) {
                const pointToken = parts[i];
                point = parseFloat(pointToken);
                i++;

                // Nếu point là 1 chữ số và token tiếp theo cũng là 1 chữ số
                // → báo lỗi, yêu cầu dùng dấu "." cho số thập phân
                // Ví dụ: "bl 5 8" → lỗi, yêu cầu nhập "bl 5.8"
                if (/^\d$/.test(pointToken) && i < parts.length && /^\d$/.test(parts[i])) {
                    context.errors.push({
                        message: `Không rõ "${pointToken} ${parts[i]}" — vui lòng dùng dấu chấm nếu muốn nhập thập phân: "${pointToken}.${parts[i]}"`,
                        type: betType.name,
                        numbers: currentNumbers,
                        provinces: currentProvinces.map(p => p.name),
                        rawFragment: `${betAlias} ${pointToken} ${parts[i]}`,
                    });
                    i++; // Bỏ qua token gây nhầm lẫn
                    currentNumbers = [];
                    lastPartType = 'none';
                    continue;
                }

                lastPartType = 'point';
            }

            // Nếu không có điểm cược → bỏ qua và báo lỗi
            if (point === null) {
                context.errors.push({
                    message: `Thiếu điểm cược sau kiểu chơi "${betType.name}". Cú pháp: [số] [kiểu chơi] [điểm]`,
                    type: betType.name,
                    numbers: currentNumbers,
                    provinces: currentProvinces.map(p => p.name),
                    rawFragment: [...currentNumbers, betAlias].join(' '),
                });
                // Reset currentNumbers để tránh số bị tích lũy cho bet type tiếp theo
                currentNumbers = [];
                // Reset lastPartType để số tiếp theo không bị hiểu nhầm là điểm
                lastPartType = 'none';
                continue; // Bỏ qua, không tạo bet
            }

            // Tạo các cược
            const bets = createBets(
                currentNumbers,
                betType,
                betAlias,
                point,
                currentProvinces,
                context
            );

            result.bets.push(...bets);
            continue;
        }

        // Token không nhận diện được → kiểm tra xem có phải đài không xổ hôm nay không
        const notTodayProvince = findProvinceByAlias(context.allProvinces, part);
        if (notTodayProvince) {
            // Đài tồn tại nhưng không xổ vào ngày đã chọn
            context.errors.push({
                message: `Đài "${notTodayProvince.name}" không xổ vào ngày đã chọn`,
                rawFragment: part,
            });
        } else {
            context.errors.push({
                message: `Không nhận diện được "${part}". Kiểm tra lại cú pháp (tên đài, số, hoặc kiểu chơi).`,
                rawFragment: part,
            });
        }
        i++;
        lastPartType = 'none';
    }

    // Kiểm tra số bị bỏ rơi cuối tin nhắn (có số nhưng không có kiểu chơi theo sau)
    if (currentNumbers.length > 0 && lastPartType === 'number') {
        context.errors.push({
            message: `Số "${currentNumbers.join(', ')}" ở cuối tin nhắn chưa có kiểu chơi. Cú pháp: [số] [kiểu chơi] [điểm]`,
            numbers: currentNumbers,
            provinces: currentProvinces.map(p => p.name),
            rawFragment: currentNumbers.join(' '),
        });
    }

    return result;
}

/**
 * Tạo các cược từ thông tin đã parse
 */
function createBets(
    numbers: string[],
    betType: BetType,
    betAlias: string,
    point: number,
    provinces: LotteryProvince[],
    context: ParseContext
): ParsedBet[] {
    const bets: ParsedBet[] = [];
    const provinceNames = provinces.map(p => p.name);
    const provinceCount = provinces.length;

    const betTypeName = betType.name;

    // ========================================
    // VALIDATION: Kiểm tra đài (trừ Đá xiên)
    // Các kiểu chơi khác yêu cầu phải có ít nhất 1 đài
    // ========================================
    if (betTypeName !== 'Đá xiên' && provinceCount === 0) {
        // Không tạo bet nếu không có đài — thông báo lỗi
        context.errors.push({
            message: `Thiếu đài cho kiểu chơi "${betTypeName}". Cú pháp: [đài] [số] [kiểu chơi] [điểm]`,
            type: betTypeName,
            numbers: numbers,
            rawFragment: [...numbers, betAlias].join(' '),
        });
        return bets;
    }

    // ========================================
    // VALIDATION: Kiểm tra có số cược không
    // ========================================
    if (numbers.length === 0) {
        context.errors.push({
            message: `Thiếu số cược trước kiểu chơi "${betTypeName}". Cú pháp: [số] [kiểu chơi] [điểm]`,
            type: betTypeName,
            provinces: provinceNames,
            rawFragment: `${betAlias} ${point}`,
        });
        return bets;
    }

    // ========================================
    // VALIDATION: Đá xiên
    // - Miền Bắc KHÔNG có Đá xiên
    // - Yêu cầu ít nhất 2 đài
    // - Yêu cầu 2-4 số
    // ========================================
    if (betTypeName === 'Đá xiên') {
        // Miền Bắc không có Đá xiên
        if (context.region === Region.MB) {
            context.errors.push({
                message: `Miền Bắc không có kiểu cược Đá xiên`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
                rawFragment: [...numbers, betAlias].join(' '),
            });
            return bets; // Không tạo bet
        }

        // Validate số đài - Nếu < 2 đài, tự động bổ sung từ đài ưu tiên / đài hôm nay
        let finalProvinceNames = provinceNames;

        if (provinceCount < 2) {
            // Giữ lại đài user đã chọn (nếu có), bổ sung thêm đài
            const selectedProvinces: LotteryProvince[] = [...provinces];

            // Bổ sung từ danh sách đài ưu tiên trước
            for (const p of context.priorityProvinces) {
                if (selectedProvinces.length >= 2) break;
                if (!selectedProvinces.find(sp => sp.id === p.id)) {
                    selectedProvinces.push(p);
                }
            }

            // Nếu vẫn chưa đủ, bổ sung từ tất cả đài hôm nay
            if (selectedProvinces.length < 2) {
                for (const p of context.provinces) {
                    if (selectedProvinces.length >= 2) break;
                    if (!selectedProvinces.find(sp => sp.id === p.id)) {
                        selectedProvinces.push(p);
                    }
                }
            }

            // Nếu vẫn không đủ 2 đài, báo lỗi
            if (selectedProvinces.length < 2) {
                context.errors.push({
                    message: `Đá xiên yêu cầu ít nhất 2 đài nhưng không tìm thấy đủ đài`,
                    type: 'Đá xiên',
                    numbers: numbers,
                    provinces: provinceNames,
                    rawFragment: [...numbers, betAlias].join(' '),
                });
                return bets; // Không tạo bet
            }

            finalProvinceNames = selectedProvinces.map(p => p.name);
        }

        // Validate số lượng số
        if (numbers.length < 2) {
            context.errors.push({
                message: `Đá xiên yêu cầu ít nhất 2 số (hiện có ${numbers.length} số: ${numbers.join(', ')})`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
                rawFragment: [...numbers, betAlias].join(' '),
            });
            return bets;
        }

        if (numbers.length > 4) {
            context.errors.push({
                message: `Đá xiên tối đa 4 số (hiện có ${numbers.length} số: ${numbers.join(', ')})`,
                type: 'Đá xiên',
                numbers: numbers,
                provinces: provinceNames,
                rawFragment: [...numbers, betAlias].join(' '),
            });
            return bets;
        }

        // Validation passed - tạo bet với đài đã được xác định (có thể là auto-assigned)
        // Validate tất cả các số phải là 2 chữ số
        const invalidDxNums = numbers.filter(n => n.length !== 2);
        if (invalidDxNums.length > 0) {
            context.errors.push({
                message: `Đá xiên yêu cầu số có 2 chữ số. Số không hợp lệ: ${invalidDxNums.join(', ')}`,
                type: 'Đá xiên',
                numbers: invalidDxNums,
                provinces: finalProvinceNames,
                rawFragment: [...numbers, betAlias].join(' '),
            });
            return bets;
        }
        const bet = createSingleBet(numbers, betTypeName, point, finalProvinceNames, context);
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
                rawFragment: [...numbers, betAlias].join(' '),
            });
            return bets;
        }

        // Validate tất cả các số phải là 2 chữ số
        const invalidDtNums = numbers.filter(n => n.length !== 2);
        if (invalidDtNums.length > 0) {
            context.errors.push({
                message: `Đá thẳng yêu cầu số có 2 chữ số. Số không hợp lệ: ${invalidDtNums.join(', ')}`,
                type: betTypeName,
                numbers: invalidDtNums,
                provinces: provinceNames,
                rawFragment: [...numbers, betAlias].join(' '),
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
            if (num.length !== 2) {
                context.errors.push({
                    message: `Đầu đuôi yêu cầu số có 2 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Đầu đuôi',
                    numbers: [num],
                    provinces: provinceNames,
                    rawFragment: num,
                });
                continue;
            }
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
                    rawFragment: num,
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
                    rawFragment: num,
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
            } else {
                context.errors.push({
                    message: `Xỉu chủ đảo đầu yêu cầu số có 3 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Xỉu chủ đảo đầu',
                    numbers: [num],
                    provinces: provinceNames,
                    rawFragment: num,
                });
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
            } else {
                context.errors.push({
                    message: `Xỉu chủ đảo đuôi yêu cầu số có 3 chữ số (số "${num}" có ${num.length} chữ số)`,
                    type: 'Xỉu chủ đảo đuôi',
                    numbers: [num],
                    provinces: provinceNames,
                    rawFragment: num,
                });
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
                    rawFragment: num,
                });
            }
        }
        return bets;
    }

    // Các loại cược thông thường: tạo 1 cược cho mỗi số
    for (const num of numbers) {
        // Validate số chữ số cho Đầu/Đuôi (2 chữ số)
        if ((betTypeName === 'Đầu' || betTypeName === 'Đuôi') && num.length !== 2) {
            context.errors.push({
                message: `${betTypeName} yêu cầu số có 2 chữ số (số "${num}" có ${num.length} chữ số)`,
                type: betTypeName,
                numbers: [num],
                provinces: provinceNames,
                rawFragment: num,
            });
            continue;
        }
        // Validate số chữ số cho Bao lô (2-4 chữ số)
        if (betTypeName === 'Bao lô' && (num.length < 2 || num.length > 4)) {
            context.errors.push({
                message: `Bao lô yêu cầu số có 2-4 chữ số (số "${num}" có ${num.length} chữ số)`,
                type: betTypeName,
                numbers: [num],
                provinces: provinceNames,
                rawFragment: num,
            });
            continue;
        }
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
 * Lấy số lô theo miền và số chữ số
 * Miền Nam/Trung: 18 lô (2 số), 17 lô (3 số), 16 lô (4 số)
 * Miền Bắc: 27 lô (2 số), 23 lô (3 số), 20 lô (4 số)
 */
function getLoCount(numDigits: number, region: Region): number {
    if (region === Region.MB) {
        if (numDigits === 2) return 27;
        if (numDigits === 3) return 23;
        if (numDigits === 4) return 20;
    } else {
        // MN, MT
        if (numDigits === 2) return 18;
        if (numDigits === 3) return 17;
        if (numDigits === 4) return 16;
    }
    return 1;
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

    // Lấy số lô theo miền
    const loCount = getLoCount(numberOfDigits, region);

    // Tính tiền gốc (bodyprice)
    let bodyprice = 0;

    switch (betType) {
        case 'Đá xiên': {
            // Đá xiên: dùng số lô 2 số × 2 (vì ghép cặp)
            const loCount2 = getLoCount(2, region);
            const basePrice = DEFAULT_PRICE * loCount2 * 2; // 36 cho MN/MT, 54 cho MB
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
            // Đá thẳng: dùng số lô 2 số × 2
            const loCount2 = getLoCount(2, region);
            const basePrice = DEFAULT_PRICE * loCount2 * 2; // 36 cho MN/MT, 54 cho MB
            const combinationFactor = numberCount === 2 ? 1 : (numberCount * (numberCount - 1)) / 2;
            bodyprice = (basePrice * combinationFactor * point) * provinceCount;
            return Math.round(bodyprice * (prices.priceda / 100));
        }

        case 'Bao lô':
            // Bao lô: dùng số lô theo miền
            bodyprice = (point * DEFAULT_PRICE * loCount) * provinceCount;
            if (numberOfDigits === 2) {
                return Math.round(bodyprice * (prices.price2lo / 100));
            } else if (numberOfDigits === 3) {
                return Math.round(bodyprice * (prices.price3lo / 100));
            } else if (numberOfDigits === 4) {
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
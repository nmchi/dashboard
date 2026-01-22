import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Region } from "@prisma/client";
import { parseMessage, normalizeMessage } from "@/utils/parser";
import { getProvincesByDay } from "@/utils/province";
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
import { ParseMessageResponse, ParsedBet, TotalsByType, TypeTotal, BetSettings } from "@/types/messages";
import { BetSettings as FlatBetSettings, DEFAULT_BET_SETTINGS as FLAT_DEFAULT } from "@/types/bet-settings";

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

        const player = await db.user.findUnique({
            where: { id: userId },
            select: { betSettings: true },
        });

        const flatSettings: FlatBetSettings = player?.betSettings
            ? (player.betSettings as unknown as FlatBetSettings)
            : FLAT_DEFAULT;

        const betSettings = convertFlatToNested(flatSettings, region) as unknown as BetSettings;

        const date = drawDate ? new Date(drawDate) : new Date();
        const [todayProvinces, betTypes] = await Promise.all([
            getProvincesByDay(region, date),
            db.betType.findMany(),
        ]);

        if (todayProvinces.length === 0) {
            return NextResponse.json({
                success: false,
                error: `Không có đài nào mở xổ ngày ${date.toLocaleDateString('vi-VN')} (${getRegionName(region)})`,
            } as ParseMessageResponse);
        }

        const parsedResult = parseMessage(
            message,
            todayProvinces,
            betTypes,
            betSettings,
            region,
            date
        );

        const normalizedMessage = normalizeMessage(
            message,
            todayProvinces,
            betTypes,
            todayProvinces
        );

        const lotteryResults = await getLotteryResults(date, region);
        const resultsMap = resultsByProvince(lotteryResults);

        if (Object.keys(resultsMap).length > 0) {
            for (const bet of parsedResult.bets) {
                const { winCount, winAmount } = calculateWin(bet, resultsMap, flatSettings, region);
                bet.winCount = winCount;
                bet.winAmount = winAmount;
            }
        }

        const totalByType = calculateTotalsByType(parsedResult.bets);
        const hasErrors = parsedResult.errors && parsedResult.errors.length > 0;

        return NextResponse.json({
            success: !hasErrors || parsedResult.bets.length > 0,
            parsedResult,
            normalizedMessage,
            totalByType,
            error: hasErrors && parsedResult.bets.length === 0
                ? parsedResult.errors![0].message
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

function getRegionName(region: Region): string {
    const names: Record<Region, string> = {
        MN: 'Miền Nam',
        MT: 'Miền Trung',
        MB: 'Miền Bắc',
    };
    return names[region];
}

function getRegionSuffix(region: Region): string {
    return region.toLowerCase();
}

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

    const getBoolean = (type: string): boolean => {
        const key = `${type}${suffix}` as keyof FlatBetSettings;
        const val = flat[key];
        return typeof val === 'boolean' ? val : false;
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
        kiruoi: getBoolean('kiruoi'),
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
 * ✅ LOGIC ĐÁ XIÊN CHÍNH XÁC
 * - Xiên 2: Tính tất cả tổ hợp 2 số từ min count
 * - Xiên 3: Tính tất cả tổ hợp 3 số từ min count
 * - Xiên 4: Tính tất cả tổ hợp 4 số từ min count
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
            winRate = getWinRate('3dau', 650);
            break;
        case 'Xỉu chủ đảo đầu':
            winRate = getWinRate('3dau', 650);
            break;
        case 'Xỉu chủ đuôi':
            winRate = getWinRate('3duoi', 650);
            break;
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

    // ============ LOGIC RIÊNG CHO ĐÁ THẲNG ============
    if (bet.type === 'Đá thẳng' && numbers.length >= 2) {
        const allDigits: string[] = [];
        const digitsByProvince: Record<string, string[]> = {};

        // Lấy Ki rưỡi setting (chung cho cả Đá thẳng và Đá xiên)
        const kiruoi = flatSettings[`kiruoi${suffix}` as keyof FlatBetSettings];
        const useKiRuoi = kiruoi !== false; // Mặc định true = Ki rưỡi

        // Thu thập số từng đài
        for (const provinceName of bet.provinces) {
            const prizes = resultsMap[provinceName];
            if (!prizes) continue;

            const digitsFromProvince = getAllLo2Digits(prizes);
            digitsByProvince[provinceName] = digitsFromProvince;
            allDigits.push(...digitsFromProvince);
        }

        // Tính tất cả tổ hợp 2 số
        let totalAmount = 0;
        let totalCount = 0;

        for (let i = 0; i < numbers.length; i++) {
            for (let j = i + 1; j < numbers.length; j++) {
                const n1 = numbers[i];
                const n2 = numbers[j];

                // Kiểm tra từng đài xem cả 2 số có ra không
                for (const provinceName of bet.provinces) {
                    const digitsInProvince = digitsByProvince[provinceName] || [];
                    const count1 = digitsInProvince.filter(d => d === n1).length;
                    const count2 = digitsInProvince.filter(d => d === n2).length;

                    // Chỉ tính nếu cả 2 số đều ra
                    if (count1 > 0 && count2 > 0) {
                        let combinationWinCount = 0;

                        if (useKiRuoi) {
                            // KI RƯỠI (true): Tính theo min
                            combinationWinCount = count1 * 0.5 + count2 * 0.5;
                        } else {
                            // KI (false): Chỉ tính khi count1 === count2 (chính xác)
                            if (count1 === count2) {
                                combinationWinCount = count1;
                            }
                        }

                        if (combinationWinCount > 0) {
                            totalAmount += combinationWinCount * bet.point * 1000 * winRate;
                            totalCount += combinationWinCount;
                        }
                    }
                }
            }
        }

        winCount = totalCount;
        winAmount = totalAmount;
    }
    // ============ LOGIC RIÊNG CHO ĐÁ XIÊN ============
    else if (bet.type === 'Đá xiên') {
        const allDigits: string[] = [];

        // Lấy Ki rưỡi setting (chung cho cả Đá thẳng và Đá xiên)
        const kiruoi = flatSettings[`kiruoi${suffix}` as keyof FlatBetSettings];
        const useKiRuoi = kiruoi !== false; // Mặc định true = Ki rưỡi

        for (const provinceName of bet.provinces) {
            const prizes = resultsMap[provinceName];
            if (!prizes) continue;

            const digitsFromProvince = getAllLo2Digits(prizes);
            allDigits.push(...digitsFromProvince);
        }

        const countMap: Record<string, number> = {};
        for (const digit of allDigits) {
            countMap[digit] = (countMap[digit] || 0) + 1;
        }

        if (numbers.length === 2) {
            // ===== XIÊN 2 =====
            const [n1, n2] = numbers;
            const c1 = countMap[n1] || 0;
            const c2 = countMap[n2] || 0;

            if (useKiRuoi) {
                // KI RƯỠI (true): Tính theo min
                const minCount = Math.min(c1, c2);
                winCount = minCount;
                if (winCount > 0) {
                    winAmount = winCount * bet.point * 1000 * winRate;
                }
            } else {
                // KI (false): Chỉ tính khi c1 === c2
                if (c1 === c2 && c1 > 0) {
                    winCount = c1;
                    winAmount = winCount * bet.point * 1000 * winRate;
                }
            }
        }
        else if (numbers.length === 3) {
            // ===== XIÊN 3 + XIÊN 2 =====
            const [n1, n2, n3] = numbers;
            const c1 = countMap[n1] || 0;
            const c2 = countMap[n2] || 0;
            const c3 = countMap[n3] || 0;

            let totalAmount = 0;
            let totalCount = 0;

            if (useKiRuoi) {
                // KI RƯỠI (true): Logic cũ
                // Xiên 3: Giá = winRate × 2
                const minCount3 = Math.min(c1, c2, c3);
                if (minCount3 > 0) {
                    totalAmount += minCount3 * bet.point * 1000 * (winRate * 2);
                    totalCount += minCount3;
                }

                // Xiên 2 - 3 tổ hợp
                const remain1 = Math.max(0, c1 - minCount3);
                const remain2 = Math.max(0, c2 - minCount3);
                const remain3 = Math.max(0, c3 - minCount3);

                if (remain1 > 0 && remain2 > 0) {
                    const minCount2_12 = Math.min(c1, c2);
                    totalAmount += minCount2_12 * bet.point * 1000 * winRate;
                    totalCount += minCount2_12;
                }
                if (remain1 > 0 && remain3 > 0) {
                    const minCount2_13 = Math.min(c1, c3);
                    totalAmount += minCount2_13 * bet.point * 1000 * winRate;
                    totalCount += minCount2_13;
                }
                if (remain2 > 0 && remain3 > 0) {
                    const minCount2_23 = Math.min(c2, c3);
                    totalAmount += minCount2_23 * bet.point * 1000 * winRate;
                    totalCount += minCount2_23;
                }
            } else {
                // KI (false): Xiên 3 chỉ tính khi c1 === c2 === c3
                if (c1 === c2 && c2 === c3 && c1 > 0) {
                    totalAmount += c1 * bet.point * 1000 * (winRate * 2);
                    totalCount += c1;
                }

                // Xiên 2: Chỉ tính các cặp có count bằng nhau
                if (c1 === c2 && c1 > 0) {
                    totalAmount += c1 * bet.point * 1000 * winRate;
                    totalCount += c1;
                }
                if (c1 === c3 && c1 > 0) {
                    totalAmount += c1 * bet.point * 1000 * winRate;
                    totalCount += c1;
                }
                if (c2 === c3 && c2 > 0) {
                    totalAmount += c2 * bet.point * 1000 * winRate;
                    totalCount += c2;
                }
            }

            winCount = totalCount;
            winAmount = totalAmount;
        }
        else if (numbers.length === 4) {
            // ===== XIÊN 4 ===== (SỬA: phân biệt 1 đài vs 2+ đài)
            const [n1, n2, n3, n4] = numbers;
            const c1 = countMap[n1] || 0;
            const c2 = countMap[n2] || 0;
            const c3 = countMap[n3] || 0;
            const c4 = countMap[n4] || 0;

            const provinceCount = bet.provinces.length;

            if (provinceCount === 1) {
                // === 1 ĐÀI: Logic cũ (xiên 4 + xiên 3 + xiên 2) - thay 550 bằng winRate ===
                let totalAmount = 0;
                let totalCount = 0;

                // Xiên 4: Giá = winRate × 4
                const minCount4 = Math.min(c1, c2, c3, c4);
                if (minCount4 > 0) {
                    totalAmount += minCount4 * bet.point * 1000 * (winRate * 4);
                    totalCount += minCount4;
                }

                // Xiên 3 - 4 tổ hợp (chỉ tính nếu có phần thừa sau xiên 4)
                const remain1_4 = Math.max(0, c1 - minCount4);
                const remain2_4 = Math.max(0, c2 - minCount4);
                const remain3_4 = Math.max(0, c3 - minCount4);
                const remain4_4 = Math.max(0, c4 - minCount4);

                if (remain1_4 > 0 && remain2_4 > 0 && remain3_4 > 0) {
                    const minCount3_123 = Math.min(c1, c2, c3);
                    totalAmount += minCount3_123 * bet.point * 1000 * (winRate * 2);
                    totalCount += minCount3_123;
                }
                if (remain1_4 > 0 && remain2_4 > 0 && remain4_4 > 0) {
                    const minCount3_124 = Math.min(c1, c2, c4);
                    totalAmount += minCount3_124 * bet.point * 1000 * (winRate * 2);
                    totalCount += minCount3_124;
                }
                if (remain1_4 > 0 && remain3_4 > 0 && remain4_4 > 0) {
                    const minCount3_134 = Math.min(c1, c3, c4);
                    totalAmount += minCount3_134 * bet.point * 1000 * (winRate * 2);
                    totalCount += minCount3_134;
                }
                if (remain2_4 > 0 && remain3_4 > 0 && remain4_4 > 0) {
                    const minCount3_234 = Math.min(c2, c3, c4);
                    totalAmount += minCount3_234 * bet.point * 1000 * (winRate * 2);
                    totalCount += minCount3_234;
                }

                // Xiên 2 - 6 tổ hợp (chỉ tính nếu cả 2 số có thừa)
                if (remain1_4 > 0 && remain2_4 > 0) {
                    const minCount2_12 = Math.min(c1, c2);
                    totalAmount += minCount2_12 * bet.point * 1000 * winRate;
                    totalCount += minCount2_12;
                }
                if (remain1_4 > 0 && remain3_4 > 0) {
                    const minCount2_13 = Math.min(c1, c3);
                    totalAmount += minCount2_13 * bet.point * 1000 * winRate;
                    totalCount += minCount2_13;
                }
                if (remain1_4 > 0 && remain4_4 > 0) {
                    const minCount2_14 = Math.min(c1, c4);
                    totalAmount += minCount2_14 * bet.point * 1000 * winRate;
                    totalCount += minCount2_14;
                }
                if (remain2_4 > 0 && remain3_4 > 0) {
                    const minCount2_23 = Math.min(c2, c3);
                    totalAmount += minCount2_23 * bet.point * 1000 * winRate;
                    totalCount += minCount2_23;
                }
                if (remain2_4 > 0 && remain4_4 > 0) {
                    const minCount2_24 = Math.min(c2, c4);
                    totalAmount += minCount2_24 * bet.point * 1000 * winRate;
                    totalCount += minCount2_24;
                }
                if (remain3_4 > 0 && remain4_4 > 0) {
                    const minCount2_34 = Math.min(c3, c4);
                    totalAmount += minCount2_34 * bet.point * 1000 * winRate;
                    totalCount += minCount2_34;
                }

                winCount = totalCount;
                winAmount = totalAmount;
            } else {
                // === 2+ ĐÀI: Logic mới - chỉ tính cặp QUA ĐÀI ===

                // Thu thập số từng đài RIÊNG BIỆT
                const countByProvince: Record<string, Record<string, number>> = {};

                for (const provinceName of bet.provinces) {
                    const prizes = resultsMap[provinceName];
                    if (!prizes) continue;

                    const digitsFromProvince = getAllLo2Digits(prizes);
                    countByProvince[provinceName] = {};

                    for (const num of numbers) {
                        countByProvince[provinceName][num] = digitsFromProvince.filter(d => d === num).length;
                    }
                }

                // Tính tổng count mỗi số (gộp tất cả các đài)
                const totalCountPerNumber: Record<string, number> = {};
                for (const num of numbers) {
                    totalCountPerNumber[num] = 0;
                    for (const provinceName of bet.provinces) {
                        totalCountPerNumber[num] += countByProvince[provinceName]?.[num] || 0;
                    }
                }

                // Tính tổng vòng = Σ min(count_A, count_B) cho mỗi cặp
                let totalVong = 0;

                for (let i = 0; i < numbers.length; i++) {
                    for (let j = i + 1; j < numbers.length; j++) {
                        const numA = numbers[i];
                        const numB = numbers[j];

                        const countA = totalCountPerNumber[numA] || 0;
                        const countB = totalCountPerNumber[numB] || 0;

                        if (countA > 0 && countB > 0) {
                            totalVong += Math.min(countA, countB);
                        }
                    }
                }

                if (totalVong > 0) {
                    // Tiền trúng = tổng vòng × winRate × điểm × 1000
                    winAmount = totalVong * winRate * bet.point * 1000;
                    winCount = totalVong;
                }
            }
        }
    }
    // ============ LOGIC CHO CÁC LOẠI CƯỢC KHÁC ============
    else {
        for (const provinceName of bet.provinces) {
            const prizes = resultsMap[provinceName];
            if (!prizes) continue;

            let digitsToCheck: string[] = [];

            switch (bet.type) {
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
                case 'Đá thẳng':
                    digitsToCheck = getAllLo2Digits(prizes);
                    break;
                default:
                    digitsToCheck = getLastNDigits(prizes, numDigits);
            }

            // Cược khác (không phải đá thẳng)
            for (const num of numbers) {
                const count = digitsToCheck.filter(d => d === num).length;
                winCount += count;
            }
        }

        if (winCount > 0) {
            winAmount = winCount * bet.point * 1000 * winRate;
        }
    }

    return { winCount, winAmount };
}

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

        if (bet.type === 'Đầu' || bet.type === 'Đuôi' || bet.type === 'Đầu đuôi') {
            category = "2c-dd";
        } else if (bet.type === 'Bao lô' || bet.type === 'Bao đảo') {
            const num = Array.isArray(bet.numbers) ? bet.numbers[0] : bet.numbers;
            if (num.length === 2) category = "2c-b";
            else if (num.length === 3) category = "3c";
            else if (num.length === 4) category = "4c";
        } else if (bet.type.includes('Xỉu chủ')) {
            category = "3c";
        } else if (bet.type === 'Đá thẳng') {
            category = "dat";
        } else if (bet.type === 'Đá xiên') {
            category = "dax";
        }

        totals[category].amount += bet.amount;
        totals[category].winAmount += bet.winAmount || 0;
        totals[category].winCount += bet.winCount || 0;

        totals.total.amount += bet.amount;
        totals.total.winAmount += bet.winAmount || 0;
        totals.total.winCount += bet.winCount || 0;
    }

    return totals;
}
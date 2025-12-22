import { BetSettings } from "@/types/bet-settings";

const CALCULATION_FACTORS = {
    DEFAULT_PRICE: 1000,
    COMBINATION_FACTOR: (n: number) => (n * (n - 1)) / 2
};

export function calculateBetAmount(
    betTypeName: string, 
    numberLength: number, // Số lượng con số trong vé
    numberOfDigits: number, // Độ dài số (2, 3)
    point: number,
    stationCount: number,
    settings: BetSettings
) {
    let customerAmount = 0;
    const type = betTypeName.toLowerCase();

    // Helper nhân giá config
    const calc = (base: number, rate: number) => {
        return Number((base * rate * 1000).toFixed(2));
    };

    if (type === "đầu") {
        customerAmount = calc(point * stationCount, settings.price2daumn);
    } 
    else if (type === "đuôi") {
        customerAmount = calc(point * stationCount, settings.price2duoimn);
    }
    // Note: Đầu Đuôi đã được Parser tách thành 2 vé riêng (Đầu + Đuôi), nên không cần case "đầu đuôi" ở đây nữa
    
    else if (type === "bao lô" || type === "bao") {
        if (numberOfDigits === 2) customerAmount = calc(point * stationCount, settings.price2lmn);
        else if (numberOfDigits === 3) customerAmount = calc(point * stationCount, settings.price3lmn);
        else if (numberOfDigits === 4) customerAmount = calc(point * stationCount, settings.price4lmn);
    }
    
    else if (type === "xỉu chủ đầu") {
        customerAmount = calc(point * stationCount, settings.price3daumn);
    }
    else if (type === "xỉu chủ đuôi") {
        customerAmount = calc(point * stationCount, settings.price3duoimn);
    }
    else if (type === "xỉu chủ đảo đầu") {
        // Parser đã tách đảo thành nhiều vé đơn, nên tính như thường
        customerAmount = calc(point * stationCount, settings.price3daumn);
    }
    else if (type === "xỉu chủ đảo đuôi") {
        customerAmount = calc(point * stationCount, settings.price3duoimn);
    }

    else if (type.includes("đá")) {
        // Đá: Tính số cặp
        let pairsCount = 1;
        // Nếu đá vòng (nhiều số), số cặp = tổ hợp chập 2
        if (numberLength > 2) {
            pairsCount = CALCULATION_FACTORS.COMBINATION_FACTOR(numberLength);
        }

        if (type.includes("xiên")) {
            // Đá xiên (Chéo đài): Không nhân số đài (thường giá đã tính hoặc logic riêng)
            // Logic cũ: customerAmount = combinationFactor * point * settings.pricedxmn * 1000
            customerAmount = calc(point * pairsCount, settings.pricedxmn);
        } else {
            // Đá thẳng (Cùng đài): Nhân số đài
            customerAmount = calc(point * pairsCount * stationCount, settings.pricedamn);
        }
    }

    return { customerAmount };
}
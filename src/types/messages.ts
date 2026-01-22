import { Region } from "@prisma/client";

// Cấu trúc betSettings trong User.betSettings (Json)
export interface BetSettings {
    // Giá cược (% khách đóng)
    prices: {
        mn: PriceSettings;
        mt?: PriceSettings;
        mb?: PriceSettings;
    };

    // Tỷ lệ thắng (x lần)
    winRates: {
        mn: WinSettings;
        mt?: WinSettings;
        mb?: WinSettings;
    };

    // Đài ưu tiên theo ngày
    priorityProvinces?: {
        [region: string]: {
            [dayOfWeek: number]: {
                provinceId: string;
                priority: number;
            }[];
        };
    };
}

export interface PriceSettings {
    price2dau: number;    // Giá 2 số đầu
    price2duoi: number;   // Giá 2 số đuôi  
    price2lo: number;     // Giá bao lô 2 số
    price3dau: number;    // Giá 3 số đầu (xỉu chủ)
    price3duoi: number;   // Giá 3 số đuôi
    price3lo: number;     // Giá bao lô 3 số
    price4duoi: number;   // Giá 4 số đuôi
    price4lo: number;     // Giá bao lô 4 số
    priceda: number;      // Giá đá thẳng
    pricedx: number;      // Giá đá xiên

    // Ki rưỡi (áp dụng cho cả Đá thẳng và Đá xiên)
    // true = Tính Ki rưỡi (min count)
    // false = Tính Ki (exact count equality)
    kiruoi?: boolean;
}

export interface WinSettings {
    win2dau: number;
    win2duoi: number;
    win2lo: number;
    win3dau: number;
    win3duoi: number;
    win3lo: number;
    win4duoi: number;
    win4lo: number;
    winda: number;
    windx: number;
}

// Default bet settings cho player mới
export const DEFAULT_BET_SETTINGS: BetSettings = {
    prices: {
        mn: {
            price2dau: 75,
            price2duoi: 75,
            price2lo: 75,
            price3dau: 75,
            price3duoi: 75,
            price3lo: 75,
            price4duoi: 75,
            price4lo: 75,
            priceda: 75,
            pricedx: 75,
            kiruoi: true,
        },
    },
    winRates: {
        mn: {
            win2dau: 75,
            win2duoi: 75,
            win2lo: 75,
            win3dau: 650,
            win3duoi: 650,
            win3lo: 650,
            win4duoi: 5500,
            win4lo: 5500,
            winda: 650,
            windx: 550,
        },
    },
};

// Parsed bet từ tin nhắn (chưa lưu DB)
export interface ParsedBet {
    numbers: string | string[];  // Số cược
    type: string;                // Tên kiểu cược
    point: number;               // Điểm cược
    provinces: string[];         // Danh sách đài
    amount: number;              // Tiền thu (đã × price%)
    winAmount?: number;          // Tiền thắng (sau khi dò số)
    winCount?: number;           // Số lần trúng
}

export interface ParseError {
    message: string;             // Mô tả lỗi
    type?: string;               // Loại cược gây lỗi
    numbers?: string[];          // Số liên quan
    provinces?: string[];        // Đài liên quan
}

// Kết quả phân tích tin nhắn
export interface ParsedMessage {
    bets: ParsedBet[];
    errors?: ParseError[];
}

// Tổng hợp theo loại cược
export interface TotalsByType {
    "2c-dd": TypeTotal;
    "2c-b": TypeTotal;
    "3c": TypeTotal;
    "4c": TypeTotal;
    "dat": TypeTotal;
    "dax": TypeTotal;
    "total": TypeTotal;
}

export interface TypeTotal {
    amount: number;      // Tiền thu
    winAmount: number;   // Tiền thắng
    winCount: number;    // Số lần trúng
}

// Request body cho API parse message
export interface ParseMessageRequest {
    message: string;
    userId: string;       // Player ID
    region?: Region;
    drawDate?: string;    // ISO date string
}

// Response từ API parse message
export interface ParseMessageResponse {
    success: boolean;
    parsedResult?: ParsedMessage;
    normalizedMessage?: string;
    totalByType?: TotalsByType;
    error?: string;
}
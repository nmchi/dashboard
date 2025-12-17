export interface BetSettings {
    // --- MIỀN NAM (MN) ---
    price2daumn: number; win2daumn: number;
    price2duoimn: number; win2duoimn: number;
    price2lmn: number; win2lmn: number;
    price3daumn: number; win3daumn: number;
    price3duoimn: number; win3duoimn: number;
    price3lmn: number; win3lmn: number;
    price4duoimn: number; win4duoimn: number;
    price4lmn: number; win4lmn: number;
    pricedamn: number; windamn: number;
    pricedxmn: number; windxmn: number;

    // --- MIỀN BẮC (MB) ---
    price2daumb: number; win2daumb: number;
    price2duoimb: number; win2duoimb: number;
    price2lmb: number; win2lmb: number;
    price3daumb: number; win3daumb: number;
    price3duoimb: number; win3duoimb: number;
    price3lmb: number; win3lmb: number;
    price4duoimb: number; win4duoimb: number;
    price4lmb: number; win4lmb: number;
    pricedamb: number; windamb: number;

    // --- MIỀN TRUNG (MT) ---
    price2daumt: number; win2daumt: number;
    price2duoimt: number; win2duoimt: number;
    price2lmt: number; win2lmt: number;
    price3daumt: number; win3daumt: number;
    price3duoimt: number; win3duoimt: number;
    price3lmt: number; win3lmt: number;
    price4lmt: number; win4lmt: number;
    pricedamt: number; windamt: number;
    pricedxmt: number; windxmt: number;
}

// Cấu hình mặc định (Template) - Dùng khi Agent chưa có cấu hình riêng hoặc khi tạo mới
export const DEFAULT_BET_SETTINGS: BetSettings = {
    // MN
    price2daumn: 0.75, win2daumn: 75,
    price2duoimn: 0.75, win2duoimn: 75,
    price2lmn: 14.4, win2lmn: 750,
    price3daumn: 0.75, win3daumn: 600,
    price3duoimn: 0.75, win3duoimn: 600,
    price3lmn: 14.4, win3lmn: 600,
    price4duoimn: 0.75, win4duoimn: 5500,
    price4lmn: 14.4, win4lmn: 5500,
    pricedamn: 28.8, windamn: 650,
    pricedxmn: 28.8, windxmn: 650,

    // MB
    price2daumb: 0.75, win2daumb: 75,
    price2duoimb: 0.75, win2duoimb: 75,
    price2lmb: 21.6, win2lmb: 80,
    price3daumb: 0.75, win3daumb: 600,
    price3duoimb: 0.75, win3duoimb: 600,
    price3lmb: 21.6, win3lmb: 600,
    price4duoimb: 0.75, win4duoimb: 5500,
    price4lmb: 21.6, win4lmb: 5500,
    pricedamb: 43.2, windamb: 650,

    // MT
    price2daumt: 0.75, win2daumt: 75,
    price2duoimt: 0.75, win2duoimt: 75,
    price2lmt: 14.4, win2lmt: 750,
    price3daumt: 0.75, win3daumt: 600,
    price3duoimt: 0.75, win3duoimt: 600,
    price3lmt: 14.4, win3lmt: 600,
    price4lmt: 14.4, win4lmt: 5500,
    pricedamt: 28.8, windamt: 650,
    pricedxmt: 28.8, windxmt: 650,
};
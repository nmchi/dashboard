import { LotteryProvince, BetType } from "@prisma/client";

/**
 * Chuẩn hóa tin nhắn cược
 * - Chuyển về lowercase
 * - Loại bỏ dấu tiếng Việt  
 * - Tách các phần tử
 * - Thay thế cú pháp đặc biệt (2d, 3d...)
 */
export function normalizeMessage(
    message: string, 
    provinces: LotteryProvince[], 
    betTypes: BetType[], 
    priorityProvinces: LotteryProvince[]
): string {
    // Bước 1: Lowercase và trim
    let normalized = message.toLowerCase().trim();
    
    // Bước 2: Chuẩn hóa tiếng Việt
    normalized = normalized
        .replace(/đ/g, 'd')
        .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, 'a')
        .replace(/[èéẻẽẹêềếểễệ]/g, 'e')
        .replace(/[ìíỉĩị]/g, 'i')
        .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, 'o')
        .replace(/[ùúủũụưừứửữự]/g, 'u')
        .replace(/[ỳýỷỹỵ]/g, 'y');
    
    // Bước 3: Loại bỏ đơn vị tiền (ngàn, nghìn, n, ng)
    normalized = normalized.replace(/(\d+)(n\b|ng\b|ngan\b|nghin\b|ngh\b)/gi, '$1');
    
    // Bước 4: Xử lý cú pháp đặc biệt (2d, 3d, 4d = 2 đài, 3 đài, 4 đài)
    const specStationPatterns = [
        { pattern: /\b2d\b|\b2dai\b/gi, count: 2 },
        { pattern: /\b3d\b|\b3dai\b/gi, count: 3 },
        { pattern: /\b4d\b|\b4dai\b/gi, count: 4 },
    ];
    
    for (const { pattern, count } of specStationPatterns) {
        if (pattern.test(normalized)) {
            // Lấy N đài ưu tiên đầu tiên
            const selectedProvinces = priorityProvinces.slice(0, count);
            if (selectedProvinces.length > 0) {
                const aliases = selectedProvinces.map(p => {
                    const firstAlias = p.aliases.split(',')[0].trim().toLowerCase();
                    return firstAlias;
                });
                // Reset lastIndex vì đã test
                pattern.lastIndex = 0;
                normalized = normalized.replace(pattern, ' ' + aliases.join(' ') + ' ');
            }
        }
    }
    
    // Bước 5: Tách số có dấu phân cách (12.34, 12/34, 12-34)
    normalized = normalized.replace(/(\d+)[.\/\-](\d+)/g, '$1 $2');
    // Lặp lại để xử lý chuỗi dài như 12.34.56
    while (/(\d+)[.\/\-](\d+)/.test(normalized)) {
        normalized = normalized.replace(/(\d+)[.\/\-](\d+)/g, '$1 $2');
    }
    
    // Bước 6: Tách đài viết liền (vlbl -> vl bl)
    const provinceAliases = provinces.flatMap(p => 
        p.aliases.split(',').map(a => a.trim().toLowerCase())
    ).sort((a, b) => b.length - a.length); // Dài trước
    
    // Thêm khoảng trắng sau mỗi alias đài
    for (const alias of provinceAliases) {
        const regex = new RegExp(`(${alias})(?=[a-z0-9])`, 'gi');
        normalized = normalized.replace(regex, '$1 ');
    }
    
    // Bước 7: Tách số và chữ
    normalized = normalized.replace(/(\d)([a-z])/g, '$1 $2');
    normalized = normalized.replace(/([a-z])(\d)/g, '$1 $2');
    
    // Bước 8: Thay dấu phẩy giữa số bằng khoảng trắng
    normalized = normalized.replace(/(\d),(\d)/g, '$1 $2');
    
    // Bước 9: Loại bỏ dấu câu còn lại
    normalized = normalized.replace(/[.,;:!?]/g, ' ');
    
    // Bước 10: Loại bỏ khoảng trắng thừa
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
}
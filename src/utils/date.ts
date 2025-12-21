const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam
 */
export function getVietnamDate(date?: Date | string): Date {
    const inputDate = date ? new Date(date) : new Date();
    
    // Chuyển sang chuỗi theo múi giờ VN rồi parse lại
    const vnDateStr = inputDate.toLocaleString('en-CA', { 
        timeZone: VIETNAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    
    return new Date(vnDateStr);
}

/**
 * Lấy thứ trong tuần (0=CN, 1=T2...6=T7)
 */
export function getDayOfWeek(date?: Date | string): number {
    const inputDate = date ? new Date(date) : new Date();
    
    // Lấy thứ theo múi giờ VN
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VIETNAM_TZ,
        weekday: 'short',
    });
    
    const dayMap: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 
        'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    
    const dayStr = formatter.format(inputDate);
    return dayMap[dayStr] ?? 0;
}

/**
 * Format ngày theo định dạng YYYY-MM-DD
 */
export function formatDateISO(date?: Date | string): string {
    const inputDate = date ? new Date(date) : new Date();
    
    return inputDate.toLocaleDateString('en-CA', {
        timeZone: VIETNAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

/**
 * Format ngày theo định dạng DD/MM/YYYY
 */
export function formatDateVN(date?: Date | string): string {
    const inputDate = date ? new Date(date) : new Date();
    
    return inputDate.toLocaleDateString('vi-VN', {
        timeZone: VIETNAM_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

/**
 * Lấy tên thứ tiếng Việt
 */
export function getDayNameVN(dayOfWeek: number): string {
    const names = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return names[dayOfWeek] || '';
}

/**
 * Parse ngày từ chuỗi YYYY-MM-DD thành Date
 */
export function parseDateISO(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}
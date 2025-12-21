/**
 * Tạo tất cả các hoán vị của một số
 * Ví dụ: "123" -> ["123", "132", "213", "231", "312", "321"]
 */
export function generatePermutations(number: string): string[] {
    if (number.length <= 1) {
        return [number];
    }
    
    const result: string[] = [];

    for (let i = 0; i < number.length; i++) {
        const currentChar = number[i];
        const remainingChars = number.slice(0, i) + number.slice(i + 1);
        const remainingPermutations = generatePermutations(remainingChars);
        
        for (const perm of remainingPermutations) {
            const newPerm = currentChar + perm;
            if (!result.includes(newPerm)) {
                result.push(newPerm);
            }
        }
    }
    return result;
}

/**
 * Tạo tất cả các cặp từ một mảng
 * Ví dụ: ["10", "20", "30"] -> [["10","20"], ["10","30"], ["20","30"]]
 */
export function generatePairs<T>(arr: T[]): T[][] {
    const pairs: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            pairs.push([arr[i], arr[j]]);
        }
    }
    return pairs;
}

/**
 * Tạo tổ hợp 3 phần tử từ một mảng
 */
export function generateTriples<T>(arr: T[]): T[][] {
    const result: T[][] = [];
    const n = arr.length;
    
    if (n < 3) return [arr];
    
    for (let i = 0; i < n - 2; i++) {
        for (let j = i + 1; j < n - 1; j++) {
            for (let k = j + 1; k < n; k++) {
                result.push([arr[i], arr[j], arr[k]]);
            }
        }
    }
    
    return result;
}

/**
 * Tạo tổ hợp 4 phần tử từ một mảng
 */
export function generateQuads<T>(arr: T[]): T[][] {
    const result: T[][] = [];
    const n = arr.length;
    
    if (n < 4) return [arr];
    
    for (let i = 0; i < n - 3; i++) {
        for (let j = i + 1; j < n - 2; j++) {
            for (let k = j + 1; k < n - 1; k++) {
                for (let l = k + 1; l < n; l++) {
                    result.push([arr[i], arr[j], arr[k], arr[l]]);
                }
            }
        }
    }
    
    return result;
}
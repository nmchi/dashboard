/**
 * Lottery Result Crawler
 * Crawl kết quả xổ số từ xosodaiphat.com
 * 
 * URLs:
 * - MN: https://xosodaiphat.com/xsmn-{DD}-{MM}-{YYYY}.html
 * - MT: https://xosodaiphat.com/xsmt-{DD}-{MM}-{YYYY}.html
 * - MB: https://xosodaiphat.com/xsmb-{DD}-{MM}-{YYYY}.html
 * 
 * ✅ TỰ ĐỘNG DÒ SỐ sau khi crawl thành công VÀ có đầy đủ kết quả
 */

import { PrismaClient, Region, LotteryProvince } from "@prisma/client";

const prisma = new PrismaClient();

interface CrawlResult {
  province: LotteryProvince;
  prizes: Record<string, string[]>;
  isComplete: boolean; // Đã có đầy đủ giải chưa
}

/**
 * Các giải bắt buộc phải có cho từng miền
 */
const REQUIRED_PRIZES = {
  // Miền Nam/Trung: G.8, G.7, G.6, G.5, G.4, G.3, G.2, G.1, G.ĐB
  MN: ["G.8", "G.7", "G.6", "G.5", "G.4", "G.3", "G.2", "G.1", "G.ĐB"],
  MT: ["G.8", "G.7", "G.6", "G.5", "G.4", "G.3", "G.2", "G.1", "G.ĐB"],
  // Miền Bắc: G.ĐB, G.1, G.2, G.3, G.4, G.5, G.6, G.7 (không có G.8)
  MB: ["G.7", "G.6", "G.5", "G.4", "G.3", "G.2", "G.1", "G.ĐB"],
};

/**
 * Số lượng số tối thiểu cho mỗi giải (MN/MT)
 */
const MIN_NUMBERS_PER_PRIZE_MNMT: Record<string, number> = {
  "G.8": 1,
  "G.7": 1,
  "G.6": 3,
  "G.5": 1,
  "G.4": 7,
  "G.3": 2,
  "G.2": 1,
  "G.1": 1,
  "G.ĐB": 1,
};

/**
 * Số lượng số tối thiểu cho mỗi giải (MB)
 */
const MIN_NUMBERS_PER_PRIZE_MB: Record<string, number> = {
  "G.7": 4,
  "G.6": 3,
  "G.5": 6,
  "G.4": 4,
  "G.3": 6,
  "G.2": 2,
  "G.1": 1,
  "G.ĐB": 1,
};

/**
 * Kiểm tra kết quả xổ số có đầy đủ chưa
 */
function isResultComplete(prizes: Record<string, string[]>, region: Region): boolean {
  const requiredPrizes = REQUIRED_PRIZES[region];
  const minNumbers = region === Region.MB ? MIN_NUMBERS_PER_PRIZE_MB : MIN_NUMBERS_PER_PRIZE_MNMT;
  
  for (const prizeName of requiredPrizes) {
    const prizeNumbers = prizes[prizeName];
    
    // Kiểm tra giải có tồn tại không
    if (!prizeNumbers || !Array.isArray(prizeNumbers)) {
      console.log(`    ⚠ Thiếu giải: ${prizeName}`);
      return false;
    }
    
    // Kiểm tra số lượng số
    const minCount = minNumbers[prizeName] || 1;
    if (prizeNumbers.length < minCount) {
      console.log(`    ⚠ Giải ${prizeName} chưa đủ số: ${prizeNumbers.length}/${minCount}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Lấy danh sách giải còn thiếu
 */
function getMissingPrizes(prizes: Record<string, string[]>, region: Region): string[] {
  const requiredPrizes = REQUIRED_PRIZES[region];
  const missing: string[] = [];
  
  for (const prizeName of requiredPrizes) {
    if (!prizes[prizeName] || prizes[prizeName].length === 0) {
      missing.push(prizeName);
    }
  }
  
  return missing;
}

interface ProcessResult {
  processed: number;
  success: number;
  failed: number;
  totalWinAmount: number;
}

/**
 * Format ngày cho URL: DD-MM-YYYY
 */
function formatDateForUrl(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Normalize string để so sánh (bỏ dấu, lowercase, bỏ ký tự đặc biệt)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Tìm province dựa vào tên hoặc aliases từ database
 */
function findProvinceByName(
  crawledName: string,
  region: Region,
  provincesCache: LotteryProvince[]
): LotteryProvince | null {
  const normalizedCrawled = normalizeString(crawledName);

  for (const province of provincesCache) {
    if (province.region !== region) continue;

    // Check tên chính
    if (normalizeString(province.name) === normalizedCrawled) {
      return province;
    }

    // Check aliases
    if (province.aliases) {
      const aliasStr = typeof province.aliases === 'string' 
        ? province.aliases 
        : JSON.stringify(province.aliases);
      
      const aliases = aliasStr.split(",").map((a) => a.trim().toLowerCase().replace(/[\[\]"]/g, ''));
      for (const alias of aliases) {
        if (normalizeString(alias) === normalizedCrawled) {
          return province;
        }
      }
    }
  }

  return null;
}

/**
 * Lấy tất cả số từ một chuỗi HTML (từ các thẻ span hoặc trực tiếp)
 */
function extractNumbers(html: string): string[] {
  const numbers: string[] = [];
  
  // Pattern 1: Số trong thẻ span
  const spanRegex = /<span[^>]*>[\s]*(\d+)[\s]*<\/span>/gi;
  let match;
  while ((match = spanRegex.exec(html)) !== null) {
    numbers.push(match[1].trim());
  }
  
  // Pattern 2: Nếu không có span, tìm số trực tiếp (2-6 chữ số)
  if (numbers.length === 0) {
    const directRegex = />\s*(\d{2,6})\s*</g;
    while ((match = directRegex.exec(html)) !== null) {
      numbers.push(match[1].trim());
    }
  }
  
  return numbers;
}

/**
 * Parse HTML cho Miền Nam và Miền Trung
 * Cấu trúc: Nhiều cột, mỗi cột là 1 tỉnh
 */
function parseMNMT(
  html: string,
  region: Region,
  provincesCache: LotteryProvince[]
): CrawlResult[] {
  const results: CrawlResult[] = [];

  // Tìm bảng kết quả - class table-xsmn hoặc table-xsmt
  const tableClass = region === Region.MT ? "table-xsmt" : "table-xsmn";
  
  // Thử nhiều pattern
  let tableHtml: string | null = null;
  
  // Pattern 1: class chứa table-xsmn/xsmt
  const regex1 = new RegExp(`<table[^>]*class="[^"]*${tableClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/table>`, "i");
  const match1 = html.match(regex1);
  if (match1) tableHtml = match1[1];
  
  // Pattern 2: class table-bordered table-striped table-xsmn
  if (!tableHtml) {
    const regex2 = new RegExp(`<table[^>]*class="[^"]*table-bordered[^"]*${tableClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/table>`, "i");
    const match2 = html.match(regex2);
    if (match2) tableHtml = match2[1];
  }
  
  // Pattern 3: Tìm bảng có livetn trong class
  if (!tableHtml) {
    const regex3 = /<table[^>]*class="[^"]*livetn[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
    const match3 = html.match(regex3);
    if (match3) tableHtml = match3[1];
  }

  if (!tableHtml) {
    console.log("  ⚠ Không tìm thấy bảng kết quả");
    return results;
  }

  // === Parse header để lấy tên tỉnh ===
  const provinces: (LotteryProvince | null)[] = [];
  
  // Tìm thead hoặc phần đầu bảng
  const theadMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)(<\/thead>|<tbody)/i);
  const headerHtml = theadMatch ? theadMatch[1] : tableHtml.split(/<tbody/i)[0];
  
  // Tìm các link trong header (tên tỉnh)
  const linkRegex = /<a[^>]*title="[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let linkMatch;
  
  while ((linkMatch = linkRegex.exec(headerHtml)) !== null) {
    const provinceName = linkMatch[1].trim();
    if (provinceName.toLowerCase() === "giải") continue;
    
    const province = findProvinceByName(provinceName, region, provincesCache);
    
    if (province) {
      provinces.push(province);
      console.log(`  ✓ Tìm thấy: ${provinceName} -> ${province.name}`);
    } else {
      provinces.push(null);
      console.log(`  ⚠ Không match DB: ${provinceName}`);
    }
  }
  
  // Thử pattern khác nếu không tìm thấy
  if (provinces.length === 0) {
    const linkRegex2 = /<th[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi;
    while ((linkMatch = linkRegex2.exec(headerHtml)) !== null) {
      const provinceName = linkMatch[1].trim();
      if (provinceName.toLowerCase() === "giải") continue;
      
      const province = findProvinceByName(provinceName, region, provincesCache);
      
      if (province) {
        provinces.push(province);
        console.log(`  ✓ Tìm thấy: ${provinceName} -> ${province.name}`);
      } else {
        provinces.push(null);
        console.log(`  ⚠ Không match DB: ${provinceName}`);
      }
    }
  }

  if (provinces.length === 0) {
    console.log("  ⚠ Không tìm thấy tỉnh nào trong header");
    return results;
  }

  // === Khởi tạo prizes ===
  const prizesMap: Map<LotteryProvince, Record<string, string[]>> = new Map();
  for (const province of provinces) {
    if (province) {
      prizesMap.set(province, {});
    }
  }

  // === Parse tbody ===
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)(<\/tbody>|$)/i);
  if (!tbodyMatch) {
    console.log("  ⚠ Không tìm thấy tbody");
    return results;
  }
  
  const tbodyHtml = tbodyMatch[1];
  
  // Tách các hàng bằng <tr
  const rowParts = tbodyHtml.split(/<tr[^>]*>/i);
  
  for (const rowHtml of rowParts) {
    if (!rowHtml.trim()) continue;
    
    // Lấy tên giải từ td/th đầu tiên
    const prizeMatch = rowHtml.match(/<t[dh][^>]*>([^<]*(?:G\.)?(?:\d|ĐB|DB)[^<]*)/i);
    if (!prizeMatch) continue;
    
    let prizeName = prizeMatch[1].trim();
    
    // Normalize tên giải
    if (prizeName === "ĐB" || prizeName === "DB") {
      prizeName = "G.ĐB";
    } else if (/^\d$/.test(prizeName)) {
      prizeName = `G.${prizeName}`;
    } else if (!prizeName.startsWith("G.")) {
      continue;
    }
    
    // Tách các td có class tn_prize
    const tdParts = rowHtml.split(/<td[^>]*class=['"]*tn_prize['"]*[^>]*>/i);
    
    // Bỏ phần đầu (trước td đầu tiên)
    for (let i = 1; i < tdParts.length && i - 1 < provinces.length; i++) {
      const tdContent = tdParts[i].split(/<td|<\/tr|<tr/i)[0];
      const province = provinces[i - 1];
      
      if (province) {
        const numbers = extractNumbers(tdContent);
        
        if (numbers.length > 0) {
          const prizes = prizesMap.get(province)!;
          if (prizes[prizeName]) {
            prizes[prizeName] = [...prizes[prizeName], ...numbers];
          } else {
            prizes[prizeName] = numbers;
          }
        }
      }
    }
  }

  // === Chuyển Map thành array ===
  for (const [province, prizes] of prizesMap) {
    if (Object.keys(prizes).length > 0) {
      const isComplete = isResultComplete(prizes, region);
      results.push({ province, prizes, isComplete });
      
      if (!isComplete) {
        const missing = getMissingPrizes(prizes, region);
        console.log(`    ⚠ ${province.name}: Chưa đủ kết quả (thiếu: ${missing.join(', ')})`);
      }
    }
  }

  return results;
}

/**
 * Parse HTML cho Miền Bắc
 * Cấu trúc: Chỉ 1 đài, bảng dọc với tên giải và số
 */
function parseMB(
  html: string,
  provincesCache: LotteryProvince[]
): CrawlResult[] {
  const results: CrawlResult[] = [];

  // Tìm province "Miền Bắc" trong database
  const mbProvince = provincesCache.find(
    p => p.region === Region.MB && 
    (normalizeString(p.name) === "mienbac" || 
     normalizeString(p.name) === "hanoi" ||
     p.name === "Miền Bắc" ||
     p.name === "Hà Nội")
  );
  
  if (!mbProvince) {
    console.log("  ⚠ Không tìm thấy province Miền Bắc trong DB");
    return results;
  }
  
  console.log(`  ✓ Tìm thấy: Miền Bắc -> ${mbProvince.name}`);

  // Tìm bảng kết quả MB - table có class table-xsmb
  const tableRegex = /<table[^>]*class="[^"]*table-xsmb[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch) {
    console.log("  ⚠ Không tìm thấy bảng table-xsmb");
    return results;
  }

  const tableHtml = tableMatch[1];
  const prizes: Record<string, string[]> = {};

  // Parse từng hàng để lấy giải và số
  const rowParts = tableHtml.split(/<tr[^>]*>/i);
  
  for (const rowHtml of rowParts) {
    if (!rowHtml.trim()) continue;
    
    // Bỏ qua hàng Mã ĐB
    if (rowHtml.includes("Mã ĐB") || rowHtml.includes("prizeCode")) continue;
    
    // Tìm tên giải trong td đầu tiên
    const prizeMatch = rowHtml.match(/<td[^>]*>\s*(G\.(?:\d|ĐB))\s*(?:<\/td>|<td)/i);
    if (!prizeMatch) continue;
    
    const prizeName = prizeMatch[1].trim();
    
    // Lấy tất cả số từ các span trong hàng
    const spanRegex = /<span[^>]*>\s*(\d{2,6})\s*<\/span>/gi;
    const numbers: string[] = [];
    let spanMatch;
    
    while ((spanMatch = spanRegex.exec(rowHtml)) !== null) {
      numbers.push(spanMatch[1].trim());
    }
    
    if (numbers.length > 0) {
      prizes[prizeName] = numbers;
      console.log(`  📊 ${prizeName}: ${numbers.join(", ")}`);
    }
  }

  if (Object.keys(prizes).length > 0) {
    const totalNumbers = Object.values(prizes).flat().length;
    console.log(`  📋 Tổng: ${Object.keys(prizes).length} giải, ${totalNumbers} số`);
    
    const isComplete = isResultComplete(prizes, Region.MB);
    results.push({ province: mbProvince, prizes, isComplete });
    
    if (!isComplete) {
      const missing = getMissingPrizes(prizes, Region.MB);
      console.log(`    ⚠ ${mbProvince.name}: Chưa đủ kết quả (thiếu: ${missing.join(', ')})`);
    }
  }

  return results;
}

/**
 * Xử lý tickets pending cho một region và ngày cụ thể
 * (Import động để tránh circular dependency)
 */
async function processTicketsForRegion(
  date: Date,
  region: Region
): Promise<ProcessResult> {
  try {
    // Dynamic import để tránh circular dependency
    const { processPendingTickets } = await import("./ticket-processor");
    return await processPendingTickets(date, region);
  } catch (error) {
    console.error(`  ⚠ Lỗi dò số ${region}:`, error);
    return { processed: 0, success: 0, failed: 0, totalWinAmount: 0 };
  }
}

/**
 * Crawl kết quả xổ số từ xosodaiphat.com
 * ✅ TỰ ĐỘNG DÒ SỐ sau khi crawl thành công VÀ có đầy đủ kết quả
 */
export async function crawlLotteryResults(
  date: Date = new Date(),
  regions: Region[] = [Region.MN, Region.MT, Region.MB],
  autoProcessTickets: boolean = true // Mặc định TỰ ĐỘNG dò số
): Promise<{
  success: boolean;
  date: string;
  results: { region: Region; saved: number; complete: number; incomplete: number; errors: string[] }[];
  ticketProcessing?: { region: Region; processed: number; success: number; totalWinAmount: number }[];
}> {
  const dateStr = formatDateForUrl(date);
  const dateDisplay = date.toISOString().split("T")[0];

  console.log(`\n🎰 Crawl kết quả xổ số ngày ${dateDisplay}`);

  const provincesCache = await prisma.lotteryProvince.findMany();
  const allResults: { region: Region; saved: number; complete: number; incomplete: number; errors: string[] }[] = [];
  const ticketResults: { region: Region; processed: number; success: number; totalWinAmount: number }[] = [];

  for (const region of regions) {
    console.log(`\n📍 ${region}`);
    console.log("─".repeat(40));

    const regionResult = { region, saved: 0, complete: 0, incomplete: 0, errors: [] as string[] };

    const regionCode = region === Region.MB ? "xsmb" : region === Region.MT ? "xsmt" : "xsmn";
    const url = `https://xosodaiphat.com/${regionCode}-${dateStr}.html`;

    console.log(`URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "vi-VN,vi;q=0.9",
        },
      });

      if (!response.ok) {
        const msg = `HTTP ${response.status}`;
        console.log(`  ✗ ${msg}`);
        regionResult.errors.push(msg);
        allResults.push(regionResult);
        continue;
      }

      const html = await response.text();
      
      // Parse theo region
      const crawlResults = region === Region.MB 
        ? parseMB(html, provincesCache)
        : parseMNMT(html, region, provincesCache);
        
      console.log(`  Tổng: ${crawlResults.length} tỉnh có kết quả`);

      // Đếm số tỉnh có kết quả đầy đủ
      let completeCount = 0;
      let incompleteCount = 0;

      for (const result of crawlResults) {
        try {
          // Tạo date với UTC để tránh timezone shift
          const drawDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

          await prisma.lotteryResult.upsert({
            where: {
              provinceId_drawDate: {
                provinceId: result.province.id,
                drawDate,
              },
            },
            update: {
              prizes: result.prizes,
            },
            create: {
              provinceId: result.province.id,
              drawDate,
              region,
              prizes: result.prizes,
            },
          });

          const prizeCount = Object.keys(result.prizes).length;
          const totalNumbers = Object.values(result.prizes).flat().length;
          const statusIcon = result.isComplete ? "✅" : "⏳";
          console.log(`  ${statusIcon} Lưu: ${result.province.name} (${prizeCount} giải, ${totalNumbers} số)`);
          
          regionResult.saved++;
          if (result.isComplete) {
            completeCount++;
          } else {
            incompleteCount++;
          }
        } catch (error) {
          const msg = `Lỗi lưu ${result.province.name}: ${error}`;
          console.log(`  ✗ ${msg}`);
          regionResult.errors.push(msg);
        }
      }

      regionResult.complete = completeCount;
      regionResult.incomplete = incompleteCount;

      // ✅ CHỈ DÒ SỐ KHI TẤT CẢ CÁC TỈNH ĐỀU CÓ KẾT QUẢ ĐẦY ĐỦ
      if (autoProcessTickets && regionResult.saved > 0) {
        if (incompleteCount === 0) {
          console.log(`\n  🔍 Đang dò số cho tickets ${region}...`);
          const processResult = await processTicketsForRegion(date, region);
          
          ticketResults.push({
            region,
            processed: processResult.processed,
            success: processResult.success,
            totalWinAmount: processResult.totalWinAmount,
          });
          
          if (processResult.processed > 0) {
            console.log(`  ✅ Dò số: ${processResult.success}/${processResult.processed} tickets`);
            if (processResult.totalWinAmount > 0) {
              console.log(`  💰 Tổng thắng: ${processResult.totalWinAmount.toLocaleString('vi-VN')}đ`);
            }
          } else {
            console.log(`  ℹ Không có ticket pending cho ${region}`);
          }
        } else {
          console.log(`\n  ⏳ Chưa dò số ${region}: ${incompleteCount}/${regionResult.saved} tỉnh chưa đủ kết quả`);
          console.log(`  ℹ Sẽ dò số ở lần crawl tiếp theo khi có đầy đủ kết quả`);
        }
      }

    } catch (error) {
      const msg = `Lỗi fetch: ${error}`;
      console.log(`  ✗ ${msg}`);
      regionResult.errors.push(msg);
    }

    allResults.push(regionResult);
  }

  const totalSaved = allResults.reduce((sum, r) => sum + r.saved, 0);
  const totalComplete = allResults.reduce((sum, r) => sum + r.complete, 0);
  const totalIncomplete = allResults.reduce((sum, r) => sum + r.incomplete, 0);
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalTicketsProcessed = ticketResults.reduce((sum, r) => sum + r.processed, 0);
  const totalTicketsSuccess = ticketResults.reduce((sum, r) => sum + r.success, 0);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`✅ Crawl: ${totalSaved} tỉnh (${totalComplete} đầy đủ, ${totalIncomplete} chưa đủ), ${totalErrors} lỗi`);
  if (autoProcessTickets) {
    if (totalTicketsProcessed > 0) {
      console.log(`✅ Dò số: ${totalTicketsSuccess}/${totalTicketsProcessed} tickets`);
    } else if (totalIncomplete > 0) {
      console.log(`⏳ Chưa dò số: Đang chờ kết quả đầy đủ`);
    }
  }
  console.log("");

  await prisma.$disconnect();

  return {
    success: totalErrors === 0,
    date: dateDisplay,
    results: allResults,
    ...(autoProcessTickets && ticketResults.length > 0 ? { ticketProcessing: ticketResults } : {}),
  };
}

export { formatDateForUrl, normalizeString, findProvinceByName, isResultComplete, getMissingPrizes };
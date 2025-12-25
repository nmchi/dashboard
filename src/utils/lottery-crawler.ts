/**
 * Lottery Result Crawler
 * Crawl kết quả xổ số từ xosodaiphat.com
 * 
 * URLs:
 * - MN: https://xosodaiphat.com/xsmn-{DD}-{MM}-{YYYY}.html
 * - MT: https://xosodaiphat.com/xsmt-{DD}-{MM}-{YYYY}.html
 * - MB: https://xosodaiphat.com/xsmb-{DD}-{MM}-{YYYY}.html
 */

import { PrismaClient, Region, LotteryProvince } from "@prisma/client";

const prisma = new PrismaClient();

interface CrawlResult {
  province: LotteryProvince;
  prizes: Record<string, string[]>;
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
      results.push({ province, prizes });
    }
  }

  return results;
}

/**
 * Parse HTML cho Miền Bắc
 * Cấu trúc: Chỉ 1 đài, bảng dọc với tên giải và số
 * 
 * HTML structure:
 * <table class="table table-bordered table-striped table-xsmb">
 *   <tbody>
 *     <tr><td>G.ĐB</td><td><span id=mb_prize_DB_item_0>75199</span></td></tr>
 *     <tr><td>G.1</td><td><span>30479</span></td></tr>
 *     ...
 *   </tbody>
 * </table>
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
  // Split by <tr để tách từng hàng
  const rowParts = tableHtml.split(/<tr[^>]*>/i);
  
  for (const rowHtml of rowParts) {
    if (!rowHtml.trim()) continue;
    
    // Bỏ qua hàng Mã ĐB
    if (rowHtml.includes("Mã ĐB") || rowHtml.includes("prizeCode")) continue;
    
    // Tìm tên giải trong td đầu tiên
    // Pattern: <td>G.ĐB</td> hoặc <td>G.1</td>
    const prizeMatch = rowHtml.match(/<td[^>]*>\s*(G\.(?:\d|ĐB))\s*(?:<\/td>|<td)/i);
    if (!prizeMatch) continue;
    
    const prizeName = prizeMatch[1].trim();
    
    // Lấy tất cả số từ các span trong hàng
    // Pattern: <span id=mb_prize_X_item_Y class="...">số</span>
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
    results.push({ province: mbProvince, prizes });
  }

  return results;
}

/**
 * Crawl kết quả xổ số từ xosodaiphat.com
 */
export async function crawlLotteryResults(
  date: Date = new Date(),
  regions: Region[] = [Region.MN, Region.MT, Region.MB]
): Promise<{
  success: boolean;
  date: string;
  results: { region: Region; saved: number; errors: string[] }[];
}> {
  const dateStr = formatDateForUrl(date);
  const dateDisplay = date.toISOString().split("T")[0];

  console.log(`\n🎰 Crawl kết quả xổ số ngày ${dateDisplay}`);

  const provincesCache = await prisma.lotteryProvince.findMany();
  const allResults: { region: Region; saved: number; errors: string[] }[] = [];

  for (const region of regions) {
    console.log(`\n📍 ${region}`);
    console.log("─".repeat(40));

    const regionResult = { region, saved: 0, errors: [] as string[] };

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
          console.log(`  💾 Lưu: ${result.province.name} (${prizeCount} giải, ${totalNumbers} số)`);
          regionResult.saved++;
        } catch (error) {
          const msg = `Lỗi lưu ${result.province.name}: ${error}`;
          console.log(`  ✗ ${msg}`);
          regionResult.errors.push(msg);
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
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\n✅ Tổng: ${totalSaved} tỉnh, ${totalErrors} lỗi\n`);

  await prisma.$disconnect();

  return {
    success: totalErrors === 0,
    date: dateDisplay,
    results: allResults,
  };
}

export { formatDateForUrl, normalizeString, findProvinceByName };
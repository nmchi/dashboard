#!/usr/bin/env npx ts-node

/**
 * Script crawl kết quả xổ số từ xosodaiphat.com
 * 
 * Sử dụng:
 *   npx tsx scripts/crawl-lottery.ts                  # Crawl hôm nay
 *   npx tsx scripts/crawl-lottery.ts 2024-12-23       # Crawl ngày cụ thể
 *   npx tsx scripts/crawl-lottery.ts 2024-12-23 MN   # Crawl Miền Nam ngày cụ thể
 */

import { crawlLotteryResults } from "../src/utils/lottery-crawler";
import { Region } from "@prisma/client";

/**
 * Parse date string (YYYY-MM-DD) hoặc lấy ngày hiện tại
 * Trả về Date object với local year/month/day để crawler xử lý
 */
function parseDate(dateStr?: string): Date {
  if (dateStr) {
    // Parse YYYY-MM-DD format
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS month is 0-indexed
      const day = parseInt(parts[2]);
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        // Tạo date với local timezone để getFullYear/Month/Date hoạt động đúng
        return new Date(year, month, day);
      }
    }
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }
  
  // Ngày hiện tại
  return new Date();
}

async function main() {
  const args = process.argv.slice(2);

  // Parse date
  let date: Date;
  try {
    date = parseDate(args[0]?.startsWith("--") ? undefined : args[0]);
  } catch (error) {
    console.error(`❌ ${error}`);
    process.exit(1);
  }

  // Parse region
  let regions: Region[];
  if (args[1] && ["MN", "MT", "MB"].includes(args[1].toUpperCase())) {
    regions = [args[1].toUpperCase() as Region];
  } else {
    regions = [Region.MN, Region.MT, Region.MB];
  }

  // Run crawl
  const result = await crawlLotteryResults(date, regions);

  // Exit with error code if failed
  if (!result.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
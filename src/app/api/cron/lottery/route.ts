import { NextRequest, NextResponse } from "next/server";
import { Region } from "@prisma/client";
import { crawlLotteryResults } from "@/utils/lottery-crawler";
import { processPendingTickets } from "@/utils/ticket-processor";

/**
 * GET /api/cron/lottery
 * 
 * Cron job chạy hàng ngày sau giờ xổ số:
 * 1. Crawl kết quả xổ số
 * 2. Dò số cho tất cả tickets pending
 * 
 * Query params:
 * - date: string (YYYY-MM-DD) - Ngày cần xử lý (default: hôm nay)
 * - region: "MN" | "MT" | "MB" - Chỉ xử lý 1 miền
 * 
 * Lịch chạy đề xuất:
 * - 16:45 - Crawl MN (xổ 16:10)
 * - 17:45 - Crawl MT (xổ 17:10)
 * - 18:45 - Crawl MB (xổ 18:10)
 * - 19:00 - Crawl ALL + Process ALL (đảm bảo đầy đủ)
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse date
    const dateStr = searchParams.get("date");
    let date: Date;
    if (dateStr) {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return NextResponse.json(
                { success: false, error: "Invalid date format" },
                { status: 400 }
            );
        }
    } else {
        date = new Date();
    }

    // Parse region
    let regions: Region[];
    const regionStr = searchParams.get("region");
    if (regionStr) {
        const upperRegion = regionStr.toUpperCase();
        if (!["MN", "MT", "MB"].includes(upperRegion)) {
            return NextResponse.json(
                { success: false, error: "Invalid region" },
                { status: 400 }
            );
        }
        regions = [upperRegion as Region];
    } else {
        regions = [Region.MN, Region.MT, Region.MB];
    }

    const dateDisplay = date.toISOString().split('T')[0];
    console.log(`\n🚀 CRON JOB START: ${dateDisplay} | Regions: ${regions.join(', ')}`);
    console.log("═".repeat(60));

    const results: {
        crawl: Awaited<ReturnType<typeof crawlLotteryResults>> | null;
        process: Awaited<ReturnType<typeof processPendingTickets>> | null;
        duration: number;
    } = {
        crawl: null,
        process: null,
        duration: 0,
    };

    try {
        // STEP 1: Crawl kết quả xổ số
        console.log("\n📥 STEP 1: Crawling lottery results...");
        results.crawl = await crawlLotteryResults(date, regions);
        
        const totalSaved = results.crawl.results.reduce((sum, r) => sum + r.saved, 0);
        console.log(`   ✅ Crawled: ${totalSaved} provinces`);

        // STEP 2: Dò số cho tickets pending
        console.log("\n🔍 STEP 2: Processing pending tickets...");
        
        // Xử lý từng region
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        let totalWin = 0;

        for (const region of regions) {
            const regionResult = await processPendingTickets(date, region);
            totalProcessed += regionResult.processed;
            totalSuccess += regionResult.success;
            totalFailed += regionResult.failed;
            totalWin += regionResult.totalWinAmount;
            
            console.log(`   ${region}: ${regionResult.processed} tickets, ${regionResult.success} success`);
        }

        results.process = {
            processed: totalProcessed,
            success: totalSuccess,
            failed: totalFailed,
            totalWinAmount: totalWin,
            results: [],
        };

        console.log(`   ✅ Processed: ${totalProcessed} tickets, ${totalSuccess} success, ${totalFailed} failed`);

    } catch (error) {
        console.error("❌ CRON ERROR:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: String(error),
                results,
            },
            { status: 500 }
        );
    }

    results.duration = Date.now() - startTime;

    console.log("\n" + "═".repeat(60));
    console.log(`✅ CRON JOB COMPLETE: ${results.duration}ms`);
    console.log("");

    return NextResponse.json({
        success: true,
        date: dateDisplay,
        regions,
        crawl: {
            success: results.crawl?.success,
            saved: results.crawl?.results.reduce((sum, r) => sum + r.saved, 0) || 0,
        },
        process: {
            processed: results.process?.processed || 0,
            success: results.process?.success || 0,
            failed: results.process?.failed || 0,
            totalWinAmount: results.process?.totalWinAmount || 0,
        },
        duration: `${results.duration}ms`,
    });
}
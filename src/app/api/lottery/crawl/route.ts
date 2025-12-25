import { NextRequest, NextResponse } from "next/server";
import { Region } from "@prisma/client";
import { crawlLotteryResults } from "@/utils/lottery-crawler";

/**
 * POST /api/lottery/crawl
 * Body: { date?: string, region?: "MN" | "MT" | "MB" }
 * 
 * GET /api/lottery/crawl?date=2024-01-15&region=MN
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Parse date
    let date: Date;
    if (body.date) {
      date = new Date(body.date);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
    } else {
      date = new Date();
    }

    // Parse regions
    let regions: Region[];
    if (body.region) {
      const region = body.region.toUpperCase();
      if (!["MN", "MT", "MB"].includes(region)) {
        return NextResponse.json(
          { success: false, error: "Invalid region. Use MN, MT, or MB" },
          { status: 400 }
        );
      }
      regions = [region as Region];
    } else {
      regions = [Region.MN, Region.MT, Region.MB];
    }

    // Crawl
    const result = await crawlLotteryResults(date, regions);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint cho cron job
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const body: Record<string, string> = {};
  
  const dateStr = searchParams.get("date");
  if (dateStr) body.date = dateStr;
  
  const regionStr = searchParams.get("region");
  if (regionStr) body.region = regionStr;

  // Redirect to POST handler
  const postRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  return POST(postRequest);
}
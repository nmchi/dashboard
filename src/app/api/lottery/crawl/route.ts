import { NextRequest, NextResponse } from "next/server";
import { Region } from "@prisma/client";
import { crawlLotteryResults } from "@/utils/lottery-crawler";

// Secret key để bảo vệ API - chỉ cron job mới có thể gọi
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Kiểm tra authorization
 * Hỗ trợ 2 cách:
 * 1. Header: Authorization: Bearer <secret>
 * 2. Query param: ?secret=<secret>
 */
function isAuthorized(request: NextRequest): boolean {
  // Nếu không set CRON_SECRET trong env, cho phép tất cả (dev mode)
  if (!CRON_SECRET) {
    console.warn("⚠️ CRON_SECRET not set - API is unprotected!");
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token === CRON_SECRET) {
      return true;
    }
  }

  // Check query param (fallback cho một số cron services)
  const secretParam = request.nextUrl.searchParams.get("secret");
  if (secretParam === CRON_SECRET) {
    return true;
  }

  return false;
}

/**
 * POST /api/lottery/crawl
 * Body: { 
 *   date?: string, 
 *   region?: "MN" | "MT" | "MB",
 *   autoProcess?: boolean  // Mặc định true - tự động dò số
 * }
 * 
 * GET /api/lottery/crawl?date=2024-01-15&region=MN&autoProcess=true
 * 
 * ⚠️ YÊU CẦU: Authorization header hoặc secret query param
 * ✅ TỰ ĐỘNG DÒ SỐ cho tickets pending sau khi crawl thành công
 */
export async function POST(request: NextRequest) {
  // Kiểm tra authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Invalid or missing secret" },
      { status: 401 }
    );
  }

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

    // Parse autoProcess (mặc định = true)
    const autoProcess = body.autoProcess !== false;

    // Crawl + Tự động dò số
    const result = await crawlLotteryResults(date, regions, autoProcess);

    return NextResponse.json({
      ...result,
      message: autoProcess 
        ? "Crawl và dò số hoàn tất" 
        : "Crawl hoàn tất (không dò số)",
    });
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
 * ⚠️ YÊU CẦU: Authorization header hoặc secret query param
 */
export async function GET(request: NextRequest) {
  // Kiểm tra authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Invalid or missing secret" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const body: Record<string, string | boolean> = {};
  
  const dateStr = searchParams.get("date");
  if (dateStr) body.date = dateStr;
  
  const regionStr = searchParams.get("region");
  if (regionStr) body.region = regionStr;

  // autoProcess mặc định = true
  const autoProcessStr = searchParams.get("autoProcess");
  body.autoProcess = autoProcessStr !== "false";

  // Xử lý trực tiếp thay vì redirect (để giữ auth context)
  try {
    // Parse date
    let date: Date;
    if (body.date) {
      date = new Date(body.date as string);
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
      const region = (body.region as string).toUpperCase();
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

    // Parse autoProcess (mặc định = true)
    const autoProcess = body.autoProcess !== false;

    // Crawl + Tự động dò số
    const result = await crawlLotteryResults(date, regions, autoProcess);

    return NextResponse.json({
      ...result,
      message: autoProcess 
        ? "Crawl và dò số hoàn tất" 
        : "Crawl hoàn tất (không dò số)",
    });
  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
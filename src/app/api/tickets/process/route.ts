import { NextRequest, NextResponse } from "next/server";
import { Region } from "@prisma/client";
import { 
    processTicket, 
    processPendingTickets, 
    processUserPendingTickets 
} from "@/utils/ticket-processor";

/**
 * POST /api/tickets/process
 * 
 * Xử lý tickets pending - dò số và cập nhật kết quả
 * 
 * Body options:
 * - ticketId: string         - Xử lý 1 ticket cụ thể
 * - userId: string           - Xử lý tất cả pending tickets của user
 * - date: string (YYYY-MM-DD) - Lọc theo ngày
 * - region: "MN" | "MT" | "MB" - Lọc theo miền
 * 
 * Nếu không có params → xử lý tất cả pending tickets
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { ticketId, userId, date, region } = body;

        // Parse date nếu có
        let parsedDate: Date | undefined;
        if (date) {
            parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                return NextResponse.json(
                    { success: false, error: "Invalid date format. Use YYYY-MM-DD" },
                    { status: 400 }
                );
            }
        }

        // Parse region nếu có
        let parsedRegion: Region | undefined;
        if (region) {
            const upperRegion = region.toUpperCase();
            if (!["MN", "MT", "MB"].includes(upperRegion)) {
                return NextResponse.json(
                    { success: false, error: "Invalid region. Use MN, MT, or MB" },
                    { status: 400 }
                );
            }
            parsedRegion = upperRegion as Region;
        }

        // Xử lý 1 ticket cụ thể
        if (ticketId) {
            console.log(`Processing single ticket: ${ticketId}`);
            const result = await processTicket(ticketId);
            
            return NextResponse.json({
                success: result.success,
                data: result,
                error: result.error,
            });
        }

        // Xử lý tickets của 1 user
        if (userId) {
            console.log(`Processing tickets for user: ${userId}`);
            const result = await processUserPendingTickets(userId, parsedDate);
            
            return NextResponse.json({
                success: true,
                data: {
                    ...result,
                    message: `Processed ${result.processed} tickets, ${result.success} success, ${result.failed} failed`,
                },
            });
        }

        // Xử lý tất cả pending tickets
        console.log(`Processing all pending tickets${parsedDate ? ` for ${date}` : ''}${parsedRegion ? ` in ${parsedRegion}` : ''}`);
        const result = await processPendingTickets(parsedDate, parsedRegion);

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                message: `Processed ${result.processed} tickets, ${result.success} success, ${result.failed} failed`,
            },
        });

    } catch (error) {
        console.error("Process tickets error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/tickets/process
 * 
 * Dùng cho cron job - xử lý tất cả pending tickets của ngày hôm nay
 * 
 * Query params:
 * - date: string (YYYY-MM-DD) - Ngày cần xử lý (default: hôm nay)
 * - region: "MN" | "MT" | "MB" - Lọc theo miền
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    
    const body: Record<string, string> = {};
    
    const dateStr = searchParams.get("date");
    if (dateStr) {
        body.date = dateStr;
    } else {
        // Default: ngày hôm nay
        body.date = new Date().toISOString().split('T')[0];
    }
    
    const regionStr = searchParams.get("region");
    if (regionStr) {
        body.region = regionStr;
    }

    // Chuyển sang POST handler
    const postRequest = new NextRequest(request.url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

    return POST(postRequest);
}
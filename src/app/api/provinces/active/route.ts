import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Region } from "@prisma/client";

/**
 * GET /api/provinces/active?date=YYYY-MM-DD&region=MN|MT|MB
 *
 * Trả về danh sách đài mở xổ theo ngày và miền,
 * kèm ordering (1 = chính, 2 = phụ 1, ...).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get("date");
        const regionStr = searchParams.get("region");

        // Validate region
        const region = (regionStr?.toUpperCase() ?? "MN") as Region;
        if (!["MN", "MT", "MB"].includes(region)) {
            return NextResponse.json({ success: false, error: "Invalid region" }, { status: 400 });
        }

        // Parse date → lấy dayOfWeek
        let dayOfWeek: number;
        if (dateStr) {
            const [year, month, day] = dateStr.split("-").map(Number);
            // Tạo date local để tránh timezone shift
            const d = new Date(year, month - 1, day);
            dayOfWeek = d.getDay(); // 0=CN, 1=T2...
        } else {
            dayOfWeek = new Date().getDay();
        }

        const provinces = await db.lotteryProvince.findMany({
            where: {
                region,
                schedules: {
                    some: { dayOfWeek, region },
                },
            },
            include: {
                schedules: {
                    where: { dayOfWeek },
                    select: { ordering: true },
                },
            },
        });

        // Flatten + sort theo ordering
        const result = provinces
            .map((p) => ({
                id: p.id,
                name: p.name,
                aliases: p.aliases,
                ordering: p.schedules[0]?.ordering ?? 99,
            }))
            .sort((a, b) => a.ordering - b.ordering);

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Get active provinces error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
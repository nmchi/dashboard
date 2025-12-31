import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { Region, TicketStatus, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/tickets/report
 * 
 * Lấy báo cáo tổng hợp tickets của một player hoặc tất cả players của agent
 * 
 * Query params:
 * - userId: ID của player (tuỳ chọn, nếu không có sẽ lấy tất cả players của agent)
 * - dateFrom: Ngày bắt đầu (YYYY-MM-DD)
 * - dateTo: Ngày kết thúc (YYYY-MM-DD)
 * 
 * Response: Tổng hợp theo miền (MN, MT, MB) và loại cược (2c, 3c-4c, da, dx)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                error: 'Chưa đăng nhập',
            }, { status: 401 });
        }
        
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        
        // Build where clause
        const where: Prisma.TicketWhereInput = {
            status: TicketStatus.COMPLETED,
        };
        
        // Nếu có userId cụ thể thì lọc theo user đó
        // Nếu không thì lấy tất cả players thuộc agent hiện tại
        if (userId) {
            where.userId = userId;
        } else {
            // Lấy tất cả players thuộc agent
            const players = await db.user.findMany({
                where: { parentId: session.user.id },
                select: { id: true },
            });
            where.userId = { in: players.map(p => p.id) };
        }
        
        // Parse dates
        let targetDate = new Date();
        
        if (dateFrom || dateTo) {
            where.drawDate = {};
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                where.drawDate.gte = fromDate;
                targetDate = fromDate;
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                where.drawDate.lte = toDate;
            }
        } else {
            // Mặc định: ngày hôm nay
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            where.drawDate = {
                gte: today,
                lte: tomorrow,
            };
            targetDate = today;
        }
        
        // Lấy tất cả tickets với bets
        const tickets = await db.ticket.findMany({
            where,
            include: {
                bets: {
                    include: {
                        betType: { select: { name: true } },
                        province: { select: { name: true } },
                    }
                }
            }
        });
        
        // Khởi tạo data structure
        const initRegionData = () => ({
            '2c': { xac: 0, thucthu: 0, winAmount: 0, winPoints: 0 },
            '3c-4c': { xac: 0, thucthu: 0, winAmount: 0, winPoints: 0 },
            'da': { xac: 0, thucthu: 0, winAmount: 0, winPoints: 0 },
            'dx': { xac: 0, thucthu: 0, winAmount: 0, winPoints: 0 },
        });
        
        const reportData = {
            mb: initRegionData(),
            mt: initRegionData(),
            mn: initRegionData(),
            total: { xac: 0, thucthu: 0, winAmount: 0, winPoints: 0 },
        };
        
        // Hàm lấy số lô theo miền
        const getLoCount = (numDigits: number, region: Region): number => {
            if (region === Region.MB) {
                if (numDigits === 2) return 27;
                if (numDigits === 3) return 23;
                if (numDigits === 4) return 20;
            } else {
                if (numDigits === 2) return 18;
                if (numDigits === 3) return 17;
                if (numDigits === 4) return 16;
            }
            return 1;
        };
        
        // Phân loại bet vào category
        const categorize = (betTypeName: string, numDigits: number): '2c' | '3c-4c' | 'da' | 'dx' => {
            // Đá xiên tách riêng
            if (betTypeName === 'Đá xiên') {
                return 'dx';
            }
            
            // Đá thẳng
            if (betTypeName === 'Đá' || betTypeName === 'Đá thẳng') {
                return 'da';
            }
            
            if (betTypeName === 'Đầu' || betTypeName === 'Đuôi' || betTypeName === 'Đầu đuôi') {
                return '2c';
            }
            
            if (betTypeName === 'Bao lô' || betTypeName === 'Bao đảo') {
                if (numDigits === 2) return '2c';
                return '3c-4c';
            }
            
            if (betTypeName.includes('Xỉu chủ')) {
                return '3c-4c';
            }
            
            return '2c';
        };
        
        // Tính toán
        for (const ticket of tickets) {
            const regionKey = ticket.region.toLowerCase() as 'mb' | 'mt' | 'mn';
            
            for (const bet of ticket.bets) {
                const numbers = bet.numbers.split(',');
                const numDigits = numbers[0]?.length || 2;
                const numCount = numbers.length;
                const point = Number(bet.point);
                const amount = Number(bet.amount);
                const winAmount = Number(bet.winAmount);
                const winCount = bet.winCount || 0;
                
                const category = categorize(bet.betType.name, numDigits);
                
                // Tính XÁC (tiền gốc chưa nhân %)
                let xac = 0;
                const loCount = getLoCount(numDigits, ticket.region);
                
                if (bet.betType.name === 'Đá xiên') {
                    const loCount2 = getLoCount(2, ticket.region);
                    const combinationFactor = numCount === 2 ? 1 : (numCount * (numCount - 1)) / 2;
                    const stationMultiplier = 1;
                    xac = point * 1000 * (loCount2 * 2) * combinationFactor * stationMultiplier * 2;
                } else if (bet.betType.name === 'Đá' || bet.betType.name === 'Đá thẳng') {
                    const loCount2 = getLoCount(2, ticket.region);
                    const combinationFactor = numCount === 2 ? 1 : (numCount * (numCount - 1)) / 2;
                    xac = point * 1000 * combinationFactor * (loCount2 * 2);
                } else if (bet.betType.name === 'Bao lô' || bet.betType.name === 'Bao đảo') {
                    xac = point * 1000 * numCount * loCount;
                } else {
                    // Đầu, Đuôi, Xỉu chủ
                    xac = point * 1000 * numCount;
                }
                
                // Cập nhật report
                reportData[regionKey][category].xac += xac;
                reportData[regionKey][category].thucthu += amount;
                reportData[regionKey][category].winAmount += winAmount;
                reportData[regionKey][category].winPoints += point * winCount;
                
                // Cập nhật total
                reportData.total.xac += xac;
                reportData.total.thucthu += amount;
                reportData.total.winAmount += winAmount;
                reportData.total.winPoints += point * winCount;
            }
        }
        
        // Format ngày và thứ
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const drawDate = targetDate.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
        });
        const dayOfWeek = dayNames[targetDate.getDay()];
        
        return NextResponse.json({
            success: true,
            data: reportData,
            drawDate,
            dayOfWeek,
            ticketCount: tickets.length,
        });
        
    } catch (error) {
        console.error('Get report error:', error);
        return NextResponse.json({
            success: false,
            error: 'Lỗi lấy báo cáo',
        }, { status: 500 });
    }
}
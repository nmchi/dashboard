import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Cấu hình giá mẫu (để nạp vào cột betSettings JSON)
const MOCK_BET_SETTINGS = {
    // --- MIỀN NAM ---
    price2daumn: 0.75, win2daumn: 75,
    price2duoimn: 0.75, win2duoimn: 75,
    price2lmn: 14.4, win2lmn: 750,
    price3daumn: 0.75, win3daumn: 600,
    price3duoimn: 0.75, win3duoimn: 600,
    price3lmn: 14.4, win3lmn: 600,
    price4duoimn: 0.75, win4duoimn: 5500,
    price4lmn: 14.4, win4lmn: 5500,
    pricedamn: 28.8, windamn: 650,
    pricedxmn: 28.8, windxmn: 650,

    // --- MIỀN BẮC (Ví dụ vài trường) ---
    price2daumb: 0.75, win2daumb: 75,
    price2duoimb: 0.75, win2duoimb: 75,
    price2lmb: 21.6, win2lmb: 80,
    price3daumb: 0.75, win3daumb: 600,
    price3duoimb: 0.75, win3duoimb: 600,
    price3lmb: 21.6, win3lmb: 600,
    price4duoimb: 0.75, win4duoimb: 5500,
    price4lmb: 21.6, win4lmb: 5500,
    pricedamb: 43.2, windamb: 650,

    // --- MIỀN TRUNG ---
    price2daumt: 0.75, win2daumt: 75,
    price2duoimt: 0.75, win2duoimt: 75,
    price2lmt: 14.4, win2lmt: 750,
    price3daumt: 0.75, win3daumt: 600,
    price3duoimt: 0.75, win3duoimt: 600,
    price3lmt: 14.4, win3lmt: 600,
    price4lmt: 14.4, win4lmt: 5500,
    pricedamt: 28.8, windamt: 650,
    pricedxmt: 28.8, windxmt: 650,
};

async function main() {
    console.log('🌱 Bắt đầu khởi tạo dữ liệu (Seeding)...')

    // 1. DỌN DẸP DỮ LIỆU CŨ
    // Xóa theo thứ tự để tránh lỗi ràng buộc khóa ngoại
    await prisma.account.deleteMany()
    await prisma.session.deleteMany()
    // Nếu sau này có bảng Ticket/Bet thì nhớ xóa ở đây nữa:
    // await prisma.bet.deleteMany()
    // await prisma.ticket.deleteMany()
    
    // Xóa User cuối cùng
    await prisma.user.deleteMany()
    await prisma.subscriptionPackage.deleteMany()
    
    console.log('🧹 Đã dọn dẹp dữ liệu cũ.')

    // --------------------------------------------------------
    // 2. TẠO ADMIN
    // --------------------------------------------------------
    const adminPass = await hash('admin123', 12)
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            email: 'admin@xsnhanh.com',
            password: adminPass, // Admin vẫn cần pass
            name: 'Super Admin',
            role: Role.ADMIN,
            // Admin cũng cần Account để login qua Better Auth
            accounts: {
                create: { providerId: 'credential', accountId: 'admin', password: adminPass }
            }
        },
    })
    console.log(`✅ Admin: ${admin.username} / admin123`)

    // --------------------------------------------------------
    // 3. TẠO AGENT (Đại Lý) [CẦN CHO BẠN TEST]
    // --------------------------------------------------------
    const agentPass = await hash('agent123', 12)
    const agent = await prisma.user.create({
        data: {
            username: 'agent01',
            email: 'agent01@test.com',
            password: agentPass, // Agent cần pass để login quản lý
            name: 'Đại Lý Miền Nam',
            role: Role.AGENT,
            
            // Nạp cấu hình giá mẫu cho Agent (để sau này kế thừa cho khách)
            betSettings: MOCK_BET_SETTINGS,

            // Tạo Account để login
            accounts: {
                create: { providerId: 'credential', accountId: 'agent01', password: agentPass }
            }
        }
    })
    console.log(`✅ Agent: ${agent.username} / agent123`)

    // --------------------------------------------------------
    // 4. TẠO PLAYER (Khách chơi) - Thuộc về Agent01
    // --------------------------------------------------------
    // Lưu ý: Player KHÔNG có password, KHÔNG có account
    const player = await prisma.user.create({
        data: {
            username: 'khach01',
            name: 'Khách Vip Sài Gòn',
            role: Role.PLAYER,
            
            // Quan trọng: Gán cha là Agent01
            parentId: agent.id,

            // Kế thừa cấu hình giá từ Agent
            betSettings: MOCK_BET_SETTINGS,
            
            // Password để null
            // Account: Không tạo
        }
    })
    console.log(`✅ Player: ${player.username} (Không pass, Con của Agent01)`)

    // --------------------------------------------------------
    // 5. TẠO GÓI CƯỚC (SaaS)
    // --------------------------------------------------------
    const packages = [
        { name: 'Gói Tuần', price: 100000, durationDay: 7, isActive: true },
        { name: 'Gói Tháng', price: 300000, durationDay: 30, isActive: true },
    ]
    for (const pkg of packages) {
        await prisma.subscriptionPackage.create({ data: pkg })
    }
    console.log(`✅ Đã tạo ${packages.length} gói cước mẫu.`)

    console.log('🚀 Seeding hoàn tất!')
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error('❌ Lỗi Seeding:', e)
        await prisma.$disconnect()
        process.exit(1)
    })
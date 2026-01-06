import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Cấu hình giá mẫu (để nạp vào cột betSettings JSON)
const MOCK_BET_SETTINGS = {
    // --- MIỀN NAM ---
    price2daumn: 75, win2daumn: 75,
    price2duoimn: 75, win2duoimn: 75,
    price2lmn: 75, win2lmn: 75,
    price3daumn: 75, win3daumn: 650,
    price3duoimn: 75, win3duoimn: 650,
    price3lmn: 75, win3lmn: 650,
    price4duoimn: 75, win4duoimn: 5500,
    price4lmn: 75, win4lmn: 5500,
    pricedamn: 75, windamn: 750,
    pricedxmn: 92.2, windxmn: 650,

    // --- MIỀN BẮC ---
    price2daumb: 75, win2daumb: 75,
    price2duoimb: 75, win2duoimb: 75,
    price2lmb: 75, win2lmb: 75,
    price3daumb: 75, win3daumb: 650,
    price3duoimb: 75, win3duoimb: 650,
    price3lmb: 75, win3lmb: 650,
    price4duoimb: 75, win4duoimb: 5500,
    price4lmb: 75, win4lmb: 5500,
    pricedamb: 92.6, windamb: 750,

    // --- MIỀN TRUNG ---
    price2daumt: 75, win2daumt: 75,
    price2duoimt: 75, win2duoimt: 75,
    price2lmt: 75, win2lmt: 75,
    price3daumt: 75, win3daumt: 650,
    price3duoimt: 75, win3duoimt: 650,
    price3lmt: 75, win3lmt: 650,
    price4duoimt: 75, win4duoimt: 5500,
    price4lmt: 75, win4lmt: 5500,
    pricedamt: 75, windamt: 750,
    pricedxmt: 75, windxmt: 650,
};

// Helper: Xóa an toàn (bỏ qua nếu bảng chưa tồn tại)
async function safeDeleteMany(model: { deleteMany: () => Promise<unknown> }, name: string) {
    try {
        await model.deleteMany();
        console.log(`  ✓ Đã xóa ${name}`);
    } catch (error) {
        console.log(`  ⚠ Bỏ qua ${name} (chưa tồn tại)`);
    }
}

async function main() {
    console.log('🌱 Bắt đầu khởi tạo dữ liệu (Seeding)...')

    // 1. DỌN DẸP DỮ LIỆU CŨ (theo thứ tự đúng)
    console.log('\n📦 Dọn dẹp dữ liệu cũ...');
    await safeDeleteMany(prisma.bet, 'Bet');
    await safeDeleteMany(prisma.ticket, 'Ticket');
    await safeDeleteMany(prisma.session, 'Session');
    await safeDeleteMany(prisma.account, 'Account');
    await safeDeleteMany(prisma.user, 'User');
    await safeDeleteMany(prisma.lotterySchedule, 'LotterySchedule');
    await safeDeleteMany(prisma.lotteryProvince, 'LotteryProvince');
    await safeDeleteMany(prisma.betType, 'BetType');
    
    console.log('🧹 Đã dọn dẹp xong.\n');

    // --------------------------------------------------------
    // 2. TẠO ADMIN
    // --------------------------------------------------------
    const adminPass = await hash('admin123', 12)
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            email: 'admin@xsnhanh.com',
            password: adminPass,
            name: 'Super Admin',
            role: Role.ADMIN,
            mustChangePassword: false,
            accounts: {
                create: { providerId: 'credential', accountId: 'admin', password: adminPass }
            }
        },
    })
    console.log(`✅ Admin: ${admin.username} / admin123`)

    // --------------------------------------------------------
    // 3. TẠO AGENT (Đại Lý)
    // --------------------------------------------------------
    const agentPass = await hash('agent123', 12)
    const agent = await prisma.user.create({
        data: {
            username: 'agent01',
            email: 'agent01@test.com',
            password: agentPass,
            name: 'Đại Lý Miền Nam',
            role: Role.AGENT,
            mustChangePassword: false,
            betSettings: MOCK_BET_SETTINGS,
            accounts: {
                create: { providerId: 'credential', accountId: 'agent01', password: agentPass }
            }
        }
    })
    console.log(`✅ Agent: ${agent.username} / agent123`)

    // --------------------------------------------------------
    // 4. TẠO PLAYER (Khách chơi) - Thuộc về Agent01
    // --------------------------------------------------------
    const player = await prisma.user.create({
        data: {
            username: 'khach01',
            name: 'Khách Vip Sài Gòn',
            role: Role.PLAYER,
            parentId: agent.id,
            betSettings: MOCK_BET_SETTINGS,
        }
    })
    console.log(`✅ Player: ${player.username} (Con của ${agent.username})`)

    console.log('\n🚀 Seeding hoàn tất!')
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error('❌ Lỗi Seeding:', e)
        await prisma.$disconnect()
        process.exit(1)
    })
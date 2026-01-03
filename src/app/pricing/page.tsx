import { db } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

// format tiền tệ VNĐ
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default async function PricingPage() {
    const packages = await db.subscriptionPackage.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' }
    });

    return (
        <div className="min-h-screen bg-slate-50 p-4">
        <div className="container mx-auto py-10">
            <div className="mb-8">
                <Link href="/" className="flex items-center text-slate-500 hover:text-slate-900 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại đăng nhập
                </Link>
            </div>

            <div className="text-center mb-12">
            <h1 className="text-3xl font-bold mb-4 text-slate-900">Chọn Gói Dịch Vụ</h1>
            <p className="text-slate-600">Đăng ký ngay để nhận tài khoản quản trị hệ thống</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {packages.map((pkg) => (
                <Card key={pkg.id} className="flex flex-col hover:shadow-lg transition-shadow border-slate-200">
                <CardHeader>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="text-3xl font-bold mb-6 text-blue-600">
                    {formatCurrency(Number(pkg.price))}
                    </div>
                    <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Thời hạn: {pkg.durationDay} ngày</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Full tính năng SaaS</span>
                    </li>
                    </ul>
                </CardContent>
                <CardFooter>
                    {/* Nút này sau sẽ gắn Server Action tạo Order */}
                    <Button className="w-full" size="lg">Mua Ngay</Button>
                </CardFooter>
                </Card>
            ))}
            </div>
        </div>
        </div>
    );
}
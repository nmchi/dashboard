import { db } from "@/lib/prisma";
import { PackageDialog } from "@/components/admin/packages/package-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowUpDown } from "lucide-react";
import { deletePackage } from "@/server/admin/package-actions";
import { SearchInput } from "@/components/ui/search-input";
import Link from "next/link";
import { Prisma } from "@prisma/client";

interface SortLinkProps {
    col: string;
    label: string;
    sort: string;
    order: string;
    query: string;
}

function SortLink({ col, label, sort, order, query }: SortLinkProps) {
    const isActive = sort === col;
    const nextOrder = isActive && order === "asc" ? "desc" : "asc";
    
    return (
        <Link href={`?q=${query}&sort=${col}&order=${nextOrder}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            {label}
            <ArrowUpDown className={`h-3 w-3 ${isActive ? "text-blue-600" : "text-slate-300"}`} />
        </Link>
    );
}

interface PageProps {
    searchParams: Promise<{
        q?: string;
        sort?: string;
        order?: string;
    }>;
}

export default async function AdminPackagesPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || "";
    const sort = searchParams.sort || "price";
    const order = searchParams.order === "desc" ? "desc" : "asc";

    const where: Prisma.SubscriptionPackageWhereInput = query
        ? { name: { contains: query, mode: "insensitive" } }
        : {};

    const packages = await db.subscriptionPackage.findMany({
        where,
        orderBy: {
            [sort]: order,
        },
        include: {
            _count: { select: { orders: true } }
        }
    });

    const formatCurrency = (amount: number | string | Prisma.Decimal) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Gói Cước</h1>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput placeholder="Tìm tên gói..." />
                    <PackageDialog />
                </div>
            </div>

            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>
                                <SortLink col="name" label="Tên gói" sort={sort} order={order} query={query} />
                            </TableHead>
                            <TableHead>
                                <SortLink col="price" label="Giá" sort={sort} order={order} query={query} />
                            </TableHead>
                            <TableHead>
                                <SortLink col="durationDay" label="Thời hạn" sort={sort} order={order} query={query} />
                            </TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Đã bán</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {packages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                    {query ? `Không tìm thấy gói nào khớp với "${query}"` : "Chưa có dữ liệu gói cước"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            packages.map((pkg) => (
                                <TableRow key={pkg.id} className="hover:bg-slate-50">
                                    <TableCell className="font-bold text-slate-800">{pkg.name}</TableCell>
                                    <TableCell className="text-green-600 font-semibold">{formatCurrency(pkg.price)}</TableCell>
                                    <TableCell>{pkg.durationDay} ngày</TableCell>
                                    <TableCell>
                                        {pkg.isActive ? (
                                            <Badge className="bg-green-600 hover:bg-green-700">Hoạt động</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-slate-500">Đã ẩn</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-slate-600 pl-6">{pkg._count.orders}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <PackageDialog pkg={{
                                            ...pkg,
                                            price: Number(pkg.price),
                                            isActive: pkg.isActive
                                        }} />
                                        
                                        <form action={async () => {
                                            'use server'
                                            await deletePackage(pkg.id)
                                        }}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" title="Xóa vĩnh viễn">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
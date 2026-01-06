import { db } from "@/lib/prisma";
import { ProvinceDialog } from "@/components/admin/provinces/province-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowUpDown, MapPin, Calendar } from "lucide-react";
import { deleteProvince } from "@/server/admin/province-actions";
import { SearchInput } from "@/components/ui/search-input";
import Link from "next/link";
import { Prisma } from "@prisma/client";

interface SortLinkProps { col: string; label: string; sort: string; order: string; query: string; }
function SortLink({ col, label, sort, order, query }: SortLinkProps) {
    const isActive = sort === col;
    const nextOrder = isActive && order === "asc" ? "desc" : "asc";
    return (
        <Link href={`?q=${query}&sort=${col}&order=${nextOrder}`} className="flex items-center gap-1 hover:text-blue-600">
            {label}
            <ArrowUpDown className={`h-3 w-3 ${isActive ? "text-blue-600" : "text-slate-300"}`} />
        </Link>
    );
}

// Helper: Lấy màu theo miền
function getRegionStyle(region: string) {
    switch (region) {
        case 'MN': return 'bg-blue-600';
        case 'MT': return 'bg-orange-500';
        default: return 'bg-red-600';
    }
}

interface PageProps { searchParams: Promise<{ q?: string; sort?: string; order?: string; }>; }

export default async function AdminProvincesPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || "";
    const sort = searchParams.sort || "name";
    const order = searchParams.order === "desc" ? "desc" : "asc";

    const where: Prisma.LotteryProvinceWhereInput = query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { aliases: { contains: query, mode: "insensitive" } }] }
        : {};

    const provinces = await db.lotteryProvince.findMany({
        where,
        orderBy: { [sort]: order },
        include: { schedules: true }
    });

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Quản lý Đài / Tỉnh</h1>
                <div className="flex items-center gap-2">
                    <SearchInput />
                    <ProvinceDialog />
                </div>
            </div>

            {/* Desktop Table - Hidden on mobile */}
            <div className="hidden md:block rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead><SortLink col="name" label="Tên đài" sort={sort} order={order} query={query} /></TableHead>
                            <TableHead><SortLink col="aliases" label="Cú pháp" sort={sort} order={order} query={query} /></TableHead>
                            <TableHead><SortLink col="region" label="Miền" sort={sort} order={order} query={query} /></TableHead>
                            <TableHead>Lịch quay (Thứ - Vị trí)</TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {provinces.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                    Chưa có dữ liệu
                                </TableCell>
                            </TableRow>
                        ) : provinces.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-bold">{p.name}</TableCell>
                                <TableCell className="text-xs font-mono text-slate-500">{p.aliases}</TableCell>
                                <TableCell>
                                    <Badge className={getRegionStyle(p.region)}>{p.region}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {p.schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(s => (
                                            <span 
                                                key={s.id} 
                                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                    s.ordering === 1 
                                                        ? 'bg-red-50 border-red-200 text-red-700 font-bold' 
                                                        : 'bg-slate-100 border-slate-200 text-slate-600'
                                                }`}
                                            >
                                                T{s.dayOfWeek === 0 ? 'CN' : s.dayOfWeek + 1}
                                                <span className="ml-1 text-[9px] opacity-70">#{s.ordering}</span>
                                            </span>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <ProvinceDialog province={p} />
                                        <form action={async () => { 'use server'; await deleteProvince(p.id) }}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards - Hidden on desktop */}
            <div className="md:hidden space-y-3">
                {provinces.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-white rounded-lg border">
                        Chưa có dữ liệu
                    </div>
                ) : (
                    provinces.map((p) => (
                        <div key={p.id} className="bg-white rounded-lg border shadow-sm p-4">
                            {/* Header: Tên đài + Actions */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">{p.name}</span>
                                    <Badge className={getRegionStyle(p.region)}>{p.region}</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                    <ProvinceDialog province={p} />
                                    <form action={async () => { 'use server'; await deleteProvince(p.id) }}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </div>
                            </div>

                            {/* Cú pháp */}
                            <div className="flex items-center gap-1.5 mb-3 text-sm">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-slate-500">Cú pháp:</span>
                                <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                    {p.aliases}
                                </code>
                            </div>

                            {/* Lịch quay */}
                            <div className="text-sm">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-slate-500">Lịch quay:</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pl-5">
                                    {p.schedules.length === 0 ? (
                                        <span className="text-slate-400 text-xs">Chưa có lịch</span>
                                    ) : (
                                        p.schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(s => (
                                            <span 
                                                key={s.id} 
                                                className={`text-xs px-2 py-1 rounded border ${
                                                    s.ordering === 1 
                                                        ? 'bg-red-50 border-red-200 text-red-700 font-bold' 
                                                        : 'bg-slate-100 border-slate-200 text-slate-600'
                                                }`}
                                            >
                                                T{s.dayOfWeek === 0 ? 'CN' : s.dayOfWeek + 1}
                                                <span className="ml-1 text-[10px] opacity-70">#{s.ordering}</span>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
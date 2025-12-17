import { db } from "@/lib/prisma";
import { BetTypeDialog } from "@/components/admin/bet-types/bet-type-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, ArrowUpDown } from "lucide-react";
import { deleteBetType } from "@/server/admin/bet-type-actions";
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
        <Link href={`?q=${query}&sort=${col}&order=${nextOrder}`} className="flex items-center gap-1 hover:text-blue-600">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
        </Link>
    );
}
// ------------------------------------------

interface PageProps {
    searchParams: Promise<{
        q?: string;
        sort?: string;
        order?: string;
    }>;
}

export default async function AdminBetTypesPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || "";
    const sort = searchParams.sort || "name";
    const order = searchParams.order === "desc" ? "desc" : "asc";

    const where: Prisma.BetTypeWhereInput = query
        ? {
            OR: [
            { name: { contains: query, mode: "insensitive" } },
            { aliases: { contains: query, mode: "insensitive" } },
            ],
        }
        : {};

    const betTypes = await db.betType.findMany({
        where,
        orderBy: {
            [sort]: order,
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Kiểu Chơi</h1>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput placeholder="Tìm kiểu chơi hoặc mã..." />
                    <BetTypeDialog />
                </div>
            </div>

            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <SortLink col="name" label="Tên hiển thị" sort={sort} order={order} query={query} />
                            </TableHead>
                            <TableHead>
                                <SortLink col="aliases" label="Cú pháp nhận diện" sort={sort} order={order} query={query} />
                            </TableHead>
                            <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {betTypes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-10 text-slate-500">
                                    {query ? `Không tìm thấy kiểu chơi nào khớp với "${query}"` : "Chưa có dữ liệu"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            betTypes.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell className="font-bold">{t.name}</TableCell>
                                <TableCell className="text-slate-500 font-mono text-xs">{t.aliases}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <BetTypeDialog betType={t} />
                                    <form action={async () => {
                                        'use server'
                                        await deleteBetType(t.id)
                                    }}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
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
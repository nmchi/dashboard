import { db } from "@/lib/prisma";
import { SearchInput } from "@/components/ui/search-input";
import { Code, List } from "lucide-react";
import { Prisma } from "@prisma/client";

interface PageProps { 
    searchParams: Promise<{ q?: string }> 
}

export default async function AgentBetTypeSyntaxPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || "";

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
        orderBy: { name: 'asc' },
    });

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Cú pháp Kiểu chơi</h1>
                    <p className="text-slate-500 text-sm">Danh sách cú pháp các kiểu cược</p>
                </div>
                <div className="w-full sm:w-auto">
                    <SearchInput placeholder="Tìm kiểu chơi hoặc cú pháp..." />
                </div>
            </div>

            {/* Tổng số */}
            <div className="text-sm text-slate-500">
                Tổng: <span className="font-semibold text-slate-700">{betTypes.length}</span> kiểu chơi
            </div>

            {betTypes.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-white rounded-lg border">
                    {query ? `Không tìm thấy kiểu chơi nào khớp với "${query}"` : "Chưa có dữ liệu"}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {betTypes.map((bt) => (
                        <BetTypeCard key={bt.id} betType={bt} />
                    ))}
                </div>
            )}
        </div>
    );
}

function BetTypeCard({ betType }: { betType: { id: string; name: string; aliases: string } }) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-3 sm:p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
                <List className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-slate-800">{betType.name}</span>
            </div>
            
            <div className="flex items-start gap-1.5">
                <Code className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 break-all">
                    {betType.aliases}
                </code>
            </div>
        </div>
    );
}
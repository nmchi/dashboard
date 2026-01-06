import { db } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { MapPin, Code } from "lucide-react";
import { Prisma } from "@prisma/client";

// Helper: Lấy màu theo miền
function getRegionStyle(region: string) {
    switch (region) {
        case 'MN': return 'bg-blue-600';
        case 'MT': return 'bg-orange-500';
        default: return 'bg-red-600';
    }
}

interface PageProps { 
    searchParams: Promise<{ q?: string }> 
}

export default async function AgentProvinceSyntaxPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams.q || "";

    const where: Prisma.LotteryProvinceWhereInput = query
        ? { 
            OR: [
                { name: { contains: query, mode: "insensitive" } }, 
                { aliases: { contains: query, mode: "insensitive" } }
            ] 
        }
        : {};

    const provinces = await db.lotteryProvince.findMany({
        where,
        orderBy: [
            { region: 'asc' },
            { name: 'asc' }
        ],
    });

    // Group by region
    const grouped = {
        MN: provinces.filter(p => p.region === 'MN'),
        MT: provinces.filter(p => p.region === 'MT'),
        MB: provinces.filter(p => p.region === 'MB'),
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Cú pháp Đài</h1>
                    <p className="text-slate-500 text-sm">Danh sách cú pháp các đài xổ số</p>
                </div>
                <div className="w-full sm:w-auto">
                    <SearchInput placeholder="Tìm đài hoặc cú pháp..." />
                </div>
            </div>

            {/* Tổng số */}
            <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    MN: {grouped.MN.length}
                </Badge>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    MT: {grouped.MT.length}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    MB: {grouped.MB.length}
                </Badge>
            </div>

            {provinces.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-white rounded-lg border">
                    {query ? `Không tìm thấy đài nào khớp với "${query}"` : "Chưa có dữ liệu"}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Miền Nam */}
                    {grouped.MN.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
                                Miền Nam ({grouped.MN.length})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grouped.MN.map((p) => (
                                    <ProvinceCard key={p.id} province={p} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Miền Trung */}
                    {grouped.MT.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-orange-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                                Miền Trung ({grouped.MT.length})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grouped.MT.map((p) => (
                                    <ProvinceCard key={p.id} province={p} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Miền Bắc */}
                    {grouped.MB.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-600 rounded-full"></span>
                                Miền Bắc ({grouped.MB.length})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grouped.MB.map((p) => (
                                    <ProvinceCard key={p.id} province={p} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ProvinceCard({ province }: { province: { id: string; name: string; aliases: string; region: string } }) {
    return (
        <div className="bg-white rounded-lg border shadow-sm p-3 sm:p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800">{province.name}</span>
                </div>
                <Badge className={getRegionStyle(province.region)}>
                    {province.region}
                </Badge>
            </div>
            
            <div className="flex items-start gap-1.5">
                <Code className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 break-all">
                    {province.aliases}
                </code>
            </div>
        </div>
    );
}
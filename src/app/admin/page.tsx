import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function AdminDashboard() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    return (
        <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-4">Tổng quan</h1>
        <div className="bg-white p-6 rounded-lg shadow">
            <p>Xin chào, <span className="font-bold text-blue-600">{session?.user.name}</span>!</p>
            <p className="text-slate-500 mt-2">Hệ thống XSNHANH đang hoạt động.</p>
        </div>
        </div>
    )
}
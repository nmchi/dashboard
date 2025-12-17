'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import Link from "next/link"

export function LoginForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const handleLogin = async () => {
        setLoading(true)
        setError("")

        await signIn.username({ 
            username: username,
            password: password,
        }, {
            onRequest: () => setLoading(true),
            
            // --- CẬP NHẬT LOGIC: Chuyển hướng theo Role ---
            onSuccess: async (ctx) => {
                const role = ctx.data?.user?.role; // Lấy role từ phản hồi đăng nhập

                if (role === "ADMIN") {
                    router.push("/admin");
                } else if (role === "AGENT") {
                    router.push("/agent");
                } else if (role === "PLAYER") {
                    // Nếu muốn chặn Player đăng nhập
                    setError("Tài khoản người chơi không có quyền truy cập.");
                    setLoading(false);
                    return; 
                } else {
                    router.push("/");
                }
                
                router.refresh();
            },
            
            onError: (ctx) => {
                setError(ctx.error.message || "Đăng nhập thất bại")
                setLoading(false)
            }
        })
    }

    // ... (Phần return JSX giữ nguyên)
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
            <Card className="w-full max-w-[400px] shadow-lg">
                <CardHeader className="text-center space-y-1">
                    <CardTitle className="text-2xl font-bold text-primary">XSNHANH</CardTitle>
                    <CardDescription>Đăng nhập hệ thống quản lý</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Tên đăng nhập</Label>
                        <Input 
                            id="username" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    
                    {error && <div className="text-sm text-red-500 text-center font-medium">{error}</div>}

                    <Button className="w-full" onClick={handleLogin} disabled={loading}>
                        {loading ? "Đang xác thực..." : "Đăng nhập"}
                    </Button>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2 border-t pt-4 bg-slate-50/50">
                    <div className="text-sm text-center text-slate-600">Bạn chưa có tài khoản?</div>
                    <Link href="/pricing" className="w-full">
                        <Button variant="outline" className="w-full">Đăng ký mua gói ngay</Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
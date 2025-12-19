'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { AlertCircle, Ban, Loader2 } from "lucide-react"
import Link from "next/link"

export function LoginForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isBannedError, setIsBannedError] = useState(false)

    const handleLogin = async () => {
        if (!username || !password) {
            setError("Vui lòng nhập đầy đủ thông tin")
            return
        }

        setLoading(true)
        setError("")
        setIsBannedError(false)

        try {
            // Check banned trước
            const checkResponse = await fetch("/api/check-banned", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            })

            const checkData = await checkResponse.json()

            if (checkData.banned) {
                setError("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.")
                setIsBannedError(true)
                setLoading(false)
                return
            }

            // Login - Better Auth sẽ tự động set cookie cache
            await signIn.username({ 
                username: username,
                password: password,
            }, {
                onSuccess: async (ctx) => {
                    const user = ctx.data?.user as { role?: string; banned?: boolean } | undefined

                    if (user?.banned) {
                        setError("Tài khoản của bạn đã bị khóa")
                        setIsBannedError(true)
                        setLoading(false)
                        return
                    }

                    const role = user?.role

                    if (role === "ADMIN") {
                        router.push("/admin")
                    } else if (role === "AGENT") {
                        router.push("/agent")
                    } else if (role === "PLAYER") {
                        setError("Tài khoản người chơi không có quyền truy cập.")
                        setLoading(false)
                        return
                    } else {
                        router.push("/")
                    }
                    
                    router.refresh()
                },
                
                onError: (ctx) => {
                    setError(ctx.error.message || "Đăng nhập thất bại")
                    setLoading(false)
                }
            })
        } catch (err) {
            console.error("Login error:", err)
            setError("Có lỗi xảy ra. Vui lòng thử lại.")
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !loading) {
            handleLogin()
        }
    }

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
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            placeholder="Nhập tên đăng nhập"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            placeholder="Nhập mật khẩu"
                        />
                    </div>
                    
                    {error && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                            isBannedError 
                                ? 'bg-red-50 border border-red-200 text-red-700' 
                                : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                        }`}>
                            {isBannedError ? (
                                <Ban className="w-5 h-5 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            )}
                            <div>
                                <p className="font-medium">{error}</p>
                                {isBannedError && (
                                    <p className="text-xs mt-1 opacity-80">
                                        Liên hệ: 0123 456 789 hoặc support@xsnhanh.com
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <Button 
                        className="w-full" 
                        onClick={handleLogin} 
                        disabled={loading || !username || !password}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Đang xác thực...
                            </>
                        ) : (
                            "Đăng nhập"
                        )}
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
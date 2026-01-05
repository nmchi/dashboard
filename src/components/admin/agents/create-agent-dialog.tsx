'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAgent } from "@/server/admin/agent-actions"
import { toast } from "sonner"
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react"

const formSchema = z.object({
    username: z.string()
        .min(3, "Tên đăng nhập tối thiểu 3 ký tự")
        .max(50, "Tên đăng nhập tối đa 50 ký tự")
        .regex(/^[a-zA-Z0-9_]+$/, "Chỉ cho phép chữ cái, số và dấu gạch dưới"),
    name: z.string().min(1, "Vui lòng nhập tên hiển thị"),
    email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
    phoneNumber: z.string().optional(),
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
});

type FormValues = z.infer<typeof formSchema>;

export function CreateAgentDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            name: "",
            email: "",
            phoneNumber: "",
            password: "",
            confirmPassword: "",
        }
    });

    const onSubmit = async (data: FormValues) => {
        setLoading(true);
        
        const res = await createAgent({
            username: data.username,
            name: data.name,
            email: data.email || undefined,
            phoneNumber: data.phoneNumber || undefined,
            password: data.password,
        });
        
        setLoading(false);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(res.message || "Tạo máy thành công");
            setOpen(false);
            reset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Thêm máy
                </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Tạo Máy Mới</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    {/* Username */}
                    <div className="space-y-2">
                        <Label>Tên đăng nhập <span className="text-red-500">*</span></Label>
                        <Input 
                            {...register("username")} 
                            placeholder="Ví dụ: dailymiennam01"
                            autoComplete="off"
                        />
                        {errors.username && (
                            <p className="text-xs text-red-500">{errors.username.message}</p>
                        )}
                    </div>

                    {/* Tên hiển thị */}
                    <div className="space-y-2">
                        <Label>Tên hiển thị <span className="text-red-500">*</span></Label>
                        <Input 
                            {...register("name")} 
                            placeholder="Ví dụ: Máy Miền Nam"
                        />
                        {errors.name && (
                            <p className="text-xs text-red-500">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Email & SĐT */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input 
                                {...register("email")} 
                                type="email"
                                placeholder="email@example.com"
                            />
                            {errors.email && (
                                <p className="text-xs text-red-500">{errors.email.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Số điện thoại</Label>
                            <Input 
                                {...register("phoneNumber")} 
                                placeholder="0901234567"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu */}
                    <div className="space-y-2">
                        <Label>Mật khẩu <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input 
                                {...register("password")} 
                                type={showPassword ? "text" : "password"}
                                placeholder="Tối thiểu 6 ký tự"
                                autoComplete="new-password"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        {errors.password && (
                            <p className="text-xs text-red-500">{errors.password.message}</p>
                        )}
                    </div>

                    {/* Xác nhận mật khẩu */}
                    <div className="space-y-2">
                        <Label>Xác nhận mật khẩu <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input 
                                {...register("confirmPassword")} 
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Nhập lại mật khẩu"
                                autoComplete="new-password"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        {errors.confirmPassword && (
                            <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? "Đang tạo..." : "Tạo Máy"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword } from "@/server/user/profile-actions" // Import action vừa tạo
import { toast } from "sonner"
import { LockKeyhole, Loader2 } from "lucide-react"

// Khai báo lại schema ở client để form validate ngay khi gõ
const formSchema = z.object({
    currentPassword: z.string().min(1, "Bắt buộc"),
    newPassword: z.string().min(6, "Tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(1, "Bắt buộc"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Không khớp",
    path: ["confirmPassword"],
});

export function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setLoading(true);
        const res = await changePassword(data);
        setLoading(false);

        if (res.error) {
        toast.error(res.error);
        } else {
        toast.success(res.message);
        setOpen(false);
        reset(); // Xóa form sau khi thành công
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            {/* Nút kích hoạt - Bạn có thể thay đổi style tùy ý */}
            <Button variant="outline" className="gap-2">
                <LockKeyhole className="h-4 w-4" /> 
                Đổi mật khẩu
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            
            {/* Mật khẩu cũ */}
            <div className="space-y-2">
                <Label>Mật khẩu hiện tại</Label>
                <Input type="password" {...register("currentPassword")} />
                {errors.currentPassword && <p className="text-xs text-red-500">{errors.currentPassword.message}</p>}
            </div>

            {/* Mật khẩu mới */}
            <div className="space-y-2">
                <Label>Mật khẩu mới</Label>
                <Input type="password" {...register("newPassword")} />
                {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword.message}</p>}
            </div>

            {/* Xác nhận */}
            <div className="space-y-2">
                <Label>Xác nhận mật khẩu mới</Label>
                <Input type="password" {...register("confirmPassword")} />
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Đang xử lý..." : "Lưu thay đổi"}
                </Button>
            </div>
            
            </form>
        </DialogContent>
        </Dialog>
    )
}
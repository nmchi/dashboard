'use client'

import { useState } from "react"
import { useForm, SubmitHandler, Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox" // Đảm bảo đã import
import { createPackage, updatePackage } from "@/server/admin/package-actions"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

// Schema bao gồm isActive
const formSchema = z.object({
    name: z.string().min(1, "Tên không được trống"),
    price: z.coerce.number().min(0, "Giá phải lớn hơn 0"),
    durationDay: z.coerce.number().min(1, "Thời hạn tối thiểu 1 ngày"),
    description: z.string().optional(),
    isActive: z.boolean().default(true), // Mặc định là true (Hoạt động)
})

type FormValues = z.infer<typeof formSchema>;

interface PackageDialogProps {
    pkg?: {
        id: string;
        name: string;
        price: number;
        durationDay: number;
        description: string | null;
        isActive: boolean; // Nhận props isActive từ DB
    }
}

export function PackageDialog({ pkg }: PackageDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const isEdit = !!pkg;

    const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: pkg ? {
            name: pkg.name,
            price: pkg.price,
            durationDay: pkg.durationDay,
            description: pkg.description || "",
            isActive: pkg.isActive // Load giá trị cũ
        } : {
        name: "",
        price: 0,
        durationDay: 30,
        description: "",
        isActive: true, // Mặc định tạo mới là Active
        },
    });

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setLoading(true);
        const payload = {
            ...data,
            price: Number(data.price),
            durationDay: Number(data.durationDay),
            description: data.description || undefined,
            isActive: data.isActive // Gửi giá trị này lên server
        };

        const res = isEdit 
        ? await updatePackage(pkg.id, payload) 
        : await createPackage(payload);
        
        setLoading(false);

        if (res.error) {
        toast.error(res.error);
        } else {
        toast.success(res.message);
        setOpen(false);
        if (!isEdit) reset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            {isEdit ? (
            <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
            ) : (
            <Button className="gap-2"><Plus className="h-4 w-4" /> Thêm Gói Cước</Button>
            )}
        </DialogTrigger>
        <DialogContent>
            <DialogHeader><DialogTitle>{isEdit ? "Sửa Gói Cước" : "Tạo Gói Mới"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Tên gói</Label>
                <Input {...register("name")} placeholder="VD: Gói Khuyến Mãi" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Giá (VNĐ)</Label>
                    <Input type="number" {...register("price")} placeholder="500000" />
                </div>
                <div className="space-y-2">
                    <Label>Thời hạn (Ngày)</Label>
                    <Input type="number" {...register("durationDay")} placeholder="30" />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Mô tả</Label>
                <Textarea {...register("description")} placeholder="Quyền lợi gói..." />
            </div>

            {/* CHECKBOX QUẢN LÝ TRẠNG THÁI */}
            <div className="flex items-center gap-2 pt-2">
                <Checkbox 
                    id="active" 
                    checked={watch("isActive")} 
                    onCheckedChange={(c) => setValue("isActive", c as boolean)}
                />
                <Label htmlFor="active" className="cursor-pointer font-medium text-slate-700">
                    Đang hoạt động (Hiển thị cho khách mua)
                </Label>
            </div>

            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>{loading ? "..." : "Lưu"}</Button>
            </div>
            </form>
        </DialogContent>
        </Dialog>
    )
}
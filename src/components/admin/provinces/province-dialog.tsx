'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createProvince, updateProvince } from "@/server/admin/province-actions"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import { Region } from "@prisma/client"
import { Checkbox } from "@/components/ui/checkbox"

const formSchema = z.object({
  name: z.string().min(1),
  aliases: z.string().min(1),
  region: z.nativeEnum(Region),
})

const DAYS_OF_WEEK = [
    { value: 1, label: "Thứ 2" },
    { value: 2, label: "Thứ 3" },
    { value: 3, label: "Thứ 4" },
    { value: 4, label: "Thứ 5" },
    { value: 5, label: "Thứ 6" },
    { value: 6, label: "Thứ 7" },
    { value: 0, label: "Chủ Nhật" },
];

interface ProvinceDialogProps {
    province?: {
        id: string;
        name: string;
        aliases: string;
        region: Region;
        schedules: { dayOfWeek: number; ordering: number }[];
    }
}

interface ScheduleState {
    ordering: number;
}

export function ProvinceDialog({ province }: ProvinceDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [selectedDays, setSelectedDays] = useState<Record<number, ScheduleState>>({});

    const isEdit = !!province;

    const { register, handleSubmit, setValue, reset, watch } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", aliases: "", region: Region.MN },
    });

    useEffect(() => {
        if (province) {
            reset({
                name: province.name,
                aliases: province.aliases,
                region: province.region,
            });
            
            // Load data cũ
            if (province.schedules) {
                // --- SỬA LỖI TẠI ĐÂY: Thay 'any' bằng kiểu cụ thể ---
                const map: Record<number, ScheduleState> = {}; 
                
                province.schedules.forEach((s) => {
                    map[s.dayOfWeek] = { ordering: s.ordering };
                });
                setSelectedDays(map);
            }
        } else {
            reset({ name: "", aliases: "", region: Region.MN });
            setSelectedDays({});
        }
    }, [province, reset, open]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setLoading(true);
        // Convert state to array
        const schedules = Object.entries(selectedDays).map(([day, val]) => ({
            dayOfWeek: parseInt(day),
            ordering: val.ordering
        }));
        
        const payload = { ...data, schedules };
        
        const res = isEdit && province 
        ? await updateProvince(province.id, payload) 
        : await createProvince(payload);
        
        setLoading(false);
        
        if (res.error) {
        toast.error(res.error);
        } else {
        toast.success(isEdit ? "Cập nhật thành công" : "Tạo đài thành công");
        setOpen(false);
        if (!isEdit) { reset(); setSelectedDays({}); }
        }
    };

    // Tick chọn ngày
    const toggleDay = (day: number) => {
        setSelectedDays(prev => {
            const newMap = { ...prev };
            if (newMap[day]) delete newMap[day];
            else newMap[day] = { ordering: 2 }; // Default là Phụ (2)
            return newMap;
        });
    };

    // Chọn thứ tự
    const changeOrder = (day: number, val: string) => {
        setSelectedDays(prev => ({
            ...prev,
            [day]: { ordering: parseInt(val) }
        }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            {isEdit ? (
            <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
            ) : (
            <Button className="gap-2"><Plus className="h-4 w-4" /> Thêm Đài</Button>
            )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{isEdit ? "Sửa" : "Thêm"} Đài Xổ Số</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tên đài</Label>
                        <Input {...register("name")} placeholder="VD: Tiền Giang" />
                    </div>
                    <div className="space-y-2">
                        <Label>Miền</Label>
                        <Select onValueChange={(val) => setValue("region", val as Region)} value={watch("region")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Region.MN}>Miền Nam</SelectItem>
                            <SelectItem value={Region.MT}>Miền Trung</SelectItem>
                            <SelectItem value={Region.MB}>Miền Bắc</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Cú pháp (Aliases)</Label>
                    <Input {...register("aliases")} placeholder="tg,tiengiang" />
                </div>

                <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">Lịch Quay & Thứ Tự Ưu Tiên</Label>
                    <div className="grid grid-cols-2 gap-3">
                        {DAYS_OF_WEEK.map((day) => {
                            const isSelected = !!selectedDays[day.value];
                            const currentOrder = selectedDays[day.value]?.ordering || 2;
                            return (
                                <div key={day.value} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded border ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                                    <div className="flex items-center gap-3">
                                        <Checkbox id={`d-${day.value}`} checked={isSelected} onCheckedChange={() => toggleDay(day.value)}/>
                                        <Label htmlFor={`d-${day.value}`}>{day.label}</Label>
                                    </div>
                                    {isSelected && (
                                        <Select value={currentOrder.toString()} onValueChange={(v) => changeOrder(day.value, v)}>
                                            <SelectTrigger className={`h-7 w-[100px] text-xs font-bold ${currentOrder === 1 ? 'text-red-600 bg-red-50 border-red-200' : ''}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 (Chính)</SelectItem>
                                                <SelectItem value="2">2 (Phụ 1)</SelectItem>
                                                <SelectItem value="3">3 (Phụ 2)</SelectItem>
                                                <SelectItem value="4">4 (Phụ 3)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="flex justify-end pt-4 sticky bottom-0 bg-white border-t mt-4">
                    <Button type="submit" disabled={loading}>{loading ? "..." : "Lưu"}</Button>
                </div>
            </form>
        </DialogContent>
        </Dialog>
    )
}
'use client'

import { useState } from "react"
import { useForm, SubmitHandler, Resolver, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { createPlayer, updatePlayer } from "@/server/agent/player-actions"
import { toast } from "sonner"
import { UserPlus, Pencil, Settings2, User } from "lucide-react"
import { SettingInput } from "./setting-input"
import { DEFAULT_BET_SETTINGS, BetSettings } from "@/types/bet-settings"

// Schema Validation
const formSchema = z.object({
    name: z.string().min(1, "Tên khách không được để trống"),
    phoneNumber: z.string().optional(),
    banned: z.boolean().default(false),
    betSettings: z.record(z.string(), z.number())
})

export type PlayerFormValues = {
    name: string;
    phoneNumber?: string;
    banned: boolean;
    betSettings: BetSettings; 
};

interface PlayerDialogProps {
    player?: {
        id: string;
        username: string;
        phoneNumber: string | null;
        name: string | null;
        banned: boolean;
        betSettings: unknown; 
    }
}

// Component hiển thị một hàng setting (THU + TRẢ)
interface SettingRowProps {
    label: string;
    priceField: string;
    winField: string;
    register: ReturnType<typeof useForm<PlayerFormValues>>['register'];
}

function SettingRow({ label, priceField, winField, register }: SettingRowProps) {
    return (
        <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[80px_1fr_1fr] gap-2 items-center">
            <span className="text-xs font-semibold text-slate-600 truncate">{label}</span>
            <SettingInput name={priceField as keyof PlayerFormValues} register={register} />
            <SettingInput name={winField as keyof PlayerFormValues} register={register} />
        </div>
    );
}

export function PlayerDialog({ player }: PlayerDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const isEdit = !!player;

    // Lấy cấu hình hiện tại hoặc dùng mặc định
    const initialSettings = player?.betSettings 
        ? (player.betSettings as BetSettings) 
        : DEFAULT_BET_SETTINGS;

    const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<PlayerFormValues>({
        resolver: zodResolver(formSchema) as unknown as Resolver<PlayerFormValues>,
        defaultValues: player ? {
            name: player.name || "",
            phoneNumber: player.phoneNumber || "",
            banned: player.banned,
            betSettings: initialSettings
        } : {
            name: "",
            phoneNumber: "",
            banned: false,
            betSettings: DEFAULT_BET_SETTINGS
        }
    });

    // Sử dụng useWatch thay cho watch() trực tiếp
    const isBanned = useWatch({ control, name: "banned" });

    const onSubmit: SubmitHandler<PlayerFormValues> = async (data) => {
        setLoading(true);
        const payload = { ...data, betSettings: data.betSettings };
        
        // Gọi Server Action
        const res = isEdit 
            ? await updatePlayer(player.id, payload) 
            : await createPlayer(payload);
            
        setLoading(false);
        
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(res.message);
            setOpen(false);
            if(!isEdit) reset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                ) : (
                    <Button className="gap-2 whitespace-nowrap">
                        <UserPlus className="h-4 w-4" /> 
                        <span className="hidden sm:inline">Thêm Khách</span>
                        <span className="sm:hidden">Thêm</span>
                    </Button>
                )}
            </DialogTrigger>
            
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-3 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                        {isEdit ? `Sửa: ${player?.name || "Khách"}` : "Thêm Khách Mới"}
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-auto">
                            <TabsTrigger value="info" className="gap-1.5 text-xs sm:text-sm py-2.5">
                                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> 
                                <span className="hidden sm:inline">Thông tin</span>
                                <span className="sm:hidden">Thông tin</span>
                            </TabsTrigger>
                            <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm py-2.5">
                                <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4"/> 
                                <span className="hidden sm:inline">Cấu hình Thu & Trúng</span>
                                <span className="sm:hidden">Cấu hình</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* --- TAB 1: THÔNG TIN CƠ BẢN --- */}
                        <TabsContent value="info" className="space-y-4 py-4">
                            <div className="grid grid-cols-1 gap-4">
                                {/* Tên khách (Bắt buộc) */}
                                <div className="space-y-2">
                                    <Label>Tên khách (Biệt danh) <span className="text-red-500">*</span></Label>
                                    <Input {...register("name")} placeholder="Ví dụ: Anh Ba, Chị Tư..." autoFocus />
                                    {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
                                </div>

                                {/* SĐT (Tùy chọn) */}
                                <div className="space-y-2">
                                    <Label>Số điện thoại (Nếu có)</Label>
                                    <Input {...register("phoneNumber")} placeholder="09..." />
                                </div>
                            </div>
                            
                            {isEdit && (
                                <div className="flex items-center gap-2 pt-2 p-3 bg-slate-50 border rounded mt-2">
                                    <Checkbox 
                                        id="ban" 
                                        checked={isBanned} 
                                        onCheckedChange={(c) => setValue("banned", !!c)} 
                                    />
                                    <Label htmlFor="ban" className="text-red-600 font-medium cursor-pointer text-sm">
                                        Khóa tài khoản (Tạm dừng cược)
                                    </Label>
                                </div>
                            )}
                        </TabsContent>

                        {/* --- TAB 2: CẤU HÌNH GIÁ --- */}
                        <TabsContent value="config" className="py-4">
                            <div className="flex flex-col gap-6 max-w-xl mx-auto">
                                
                                {/* 1. MIỀN NAM */}
                                <div className="border p-3 sm:p-4 rounded-lg bg-blue-50/50 shadow-sm space-y-3">
                                    <h3 className="font-bold text-blue-700 text-center border-b border-blue-200 pb-2 text-base sm:text-lg">
                                        MIỀN NAM (MN)
                                    </h3>
                                    
                                    {/* Header cột */}
                                    <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[80px_1fr_1fr] gap-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 border-b pb-2">
                                        <span></span>
                                        <span>THU</span>
                                        <span>TRẢ</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <SettingRow label="2D-DAU" priceField="betSettings.price2daumn" winField="betSettings.win2daumn" register={register} />
                                        <SettingRow label="2D-DUOI" priceField="betSettings.price2duoimn" winField="betSettings.win2duoimn" register={register} />
                                        <SettingRow label="2D-18L" priceField="betSettings.price2lmn" winField="betSettings.win2lmn" register={register} />
                                        <SettingRow label="3D-DAU" priceField="betSettings.price3daumn" winField="betSettings.win3daumn" register={register} />
                                        <SettingRow label="3D-DUOI" priceField="betSettings.price3duoimn" winField="betSettings.win3duoimn" register={register} />
                                        <SettingRow label="3D-17L" priceField="betSettings.price3lmn" winField="betSettings.win3lmn" register={register} />
                                        <SettingRow label="4D-DUOI" priceField="betSettings.price4duoimn" winField="betSettings.win4duoimn" register={register} />
                                        <SettingRow label="4D-16L" priceField="betSettings.price4lmn" winField="betSettings.win4lmn" register={register} />
                                        <SettingRow label="DATHANG" priceField="betSettings.pricedamn" winField="betSettings.windamn" register={register} />
                                        <SettingRow label="DAXIEN" priceField="betSettings.pricedxmn" winField="betSettings.windxmn" register={register} />
                                    </div>
                                </div>

                                {/* 2. MIỀN TRUNG */}
                                <div className="border p-3 sm:p-4 rounded-lg bg-orange-50/50 shadow-sm space-y-3">
                                    <h3 className="font-bold text-orange-700 text-center border-b border-orange-200 pb-2 text-base sm:text-lg">
                                        MIỀN TRUNG (MT)
                                    </h3>
                                    
                                    {/* Header cột */}
                                    <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[80px_1fr_1fr] gap-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 border-b pb-2">
                                        <span></span>
                                        <span>THU</span>
                                        <span>TRẢ</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <SettingRow label="2D-DAU" priceField="betSettings.price2daumt" winField="betSettings.win2daumt" register={register} />
                                        <SettingRow label="2D-DUOI" priceField="betSettings.price2duoimt" winField="betSettings.win2duoimt" register={register} />
                                        <SettingRow label="2D-18L" priceField="betSettings.price2lmt" winField="betSettings.win2lmt" register={register} />
                                        <SettingRow label="3D-DAU" priceField="betSettings.price3daumt" winField="betSettings.win3daumt" register={register} />
                                        <SettingRow label="3D-DUOI" priceField="betSettings.price3duoimt" winField="betSettings.win3duoimt" register={register} />
                                        <SettingRow label="3D-17L" priceField="betSettings.price3lmt" winField="betSettings.win3lmt" register={register} />
                                        <SettingRow label="4D-DUOI" priceField="betSettings.price4duoimt" winField="betSettings.win4duoimt" register={register} />
                                        <SettingRow label="4D-16L" priceField="betSettings.price4lmt" winField="betSettings.win4lmt" register={register} />
                                        <SettingRow label="DATHANG" priceField="betSettings.pricedamt" winField="betSettings.windamt" register={register} />
                                        <SettingRow label="DAXIEN" priceField="betSettings.pricedxmt" winField="betSettings.windxmt" register={register} />
                                    </div>
                                </div>

                                {/* 3. MIỀN BẮC */}
                                <div className="border p-3 sm:p-4 rounded-lg bg-red-50/50 shadow-sm space-y-3">
                                    <h3 className="font-bold text-red-700 text-center border-b border-red-200 pb-2 text-base sm:text-lg">
                                        MIỀN BẮC (MB)
                                    </h3>
                                    
                                    {/* Header cột */}
                                    <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[80px_1fr_1fr] gap-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 border-b pb-2">
                                        <span></span>
                                        <span>THU</span>
                                        <span>TRẢ</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <SettingRow label="2D-DAU" priceField="betSettings.price2daumb" winField="betSettings.win2daumb" register={register} />
                                        <SettingRow label="2D-DUOI" priceField="betSettings.price2duoimb" winField="betSettings.win2duoimb" register={register} />
                                        <SettingRow label="2D-27L" priceField="betSettings.price2lmb" winField="betSettings.win2lmb" register={register} />
                                        <SettingRow label="3D-DAU" priceField="betSettings.price3daumb" winField="betSettings.win3daumb" register={register} />
                                        <SettingRow label="3D-DUOI" priceField="betSettings.price3duoimb" winField="betSettings.win3duoimb" register={register} />
                                        <SettingRow label="3D-23L" priceField="betSettings.price3lmb" winField="betSettings.win3lmb" register={register} />
                                        <SettingRow label="4D-DUOI" priceField="betSettings.price4duoimb" winField="betSettings.win4duoimb" register={register} />
                                        <SettingRow label="4D-20L" priceField="betSettings.price4lmb" winField="betSettings.win4lmb" register={register} />
                                        <SettingRow label="DATHANG" priceField="betSettings.pricedamb" winField="betSettings.windamb" register={register} />
                                    </div>
                                </div>

                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Submit Button - Sticky on mobile */}
                    <div className="flex justify-end pt-4 border-t mt-4 sticky bottom-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto">
                            {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo Khách Ngay"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
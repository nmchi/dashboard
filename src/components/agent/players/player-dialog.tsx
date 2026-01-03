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
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Thêm Khách</Button>
            )}
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader><DialogTitle>{isEdit ? `Sửa: ${player?.name || "Khách"}` : "Thêm Khách Mới"}</DialogTitle></DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)}>
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto">
                    <TabsTrigger value="info" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
                        <User className="h-3 w-3 sm:h-4 sm:w-4"/> 
                        <span className="hidden sm:inline">Thông tin chung</span>
                        <span className="sm:hidden">Thông tin</span>
                    </TabsTrigger>
                    <TabsTrigger value="config" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
                        <Settings2 className="h-3 w-3 sm:h-4 sm:w-4"/> 
                        <span className="hidden sm:inline">Cấu hình Giá & Trúng</span>
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
                        <Label htmlFor="ban" className="text-red-600 font-medium cursor-pointer">Khóa tài khoản (Tạm dừng cược)</Label>
                    </div>
                )}
                </TabsContent>

                {/* --- TAB 2: CẤU HÌNH GIÁ (LAYOUT 1 CỘT DỌC) --- */}
                <TabsContent value="config" className="py-4">
                <div className="flex flex-col gap-8 max-w-xl mx-auto">
                    
                    {/* 1. MIỀN NAM */}
                    <div className="border p-4 rounded-lg bg-blue-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-blue-700 text-center border-b border-blue-200 pb-2 text-lg">MIỀN NAM (MN)</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
                            {/* Header cột */}
                            <div className="col-span-2 grid grid-cols-2 gap-4 text-center text-xs font-bold text-slate-500">
                                <span>THU</span><span>TRẢ</span>
                            </div>
                            
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DAU</span>
                                <SettingInput name="betSettings.price2daumn" register={register} />
                                <SettingInput name="betSettings.win2daumn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DUOI</span>
                                <SettingInput name="betSettings.price2duoimn" register={register} />
                                <SettingInput name="betSettings.win2duoimn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-18L</span>
                                <SettingInput name="betSettings.price2lmn" register={register} />
                                <SettingInput name="betSettings.win2lmn" register={register} />
                            </div>
                            
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DAU</span>
                                <SettingInput name="betSettings.price3daumn" register={register} />
                                <SettingInput name="betSettings.win3daumn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DUOI</span>
                                <SettingInput name="betSettings.price3duoimn" register={register} />
                                <SettingInput name="betSettings.win3duoimn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-17L</span>
                                <SettingInput name="betSettings.price3lmn" register={register} />
                                <SettingInput name="betSettings.win3lmn" register={register} />
                            </div>
                            
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-DUOI</span>
                                <SettingInput name="betSettings.price4duoimn" register={register} />
                                <SettingInput name="betSettings.win4duoimn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-16L</span>
                                <SettingInput name="betSettings.price4lmn" register={register} />
                                <SettingInput name="betSettings.win4lmn" register={register} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">DATHANG</span>
                                <SettingInput name="betSettings.pricedamn" register={register} />
                                <SettingInput name="betSettings.windamn" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">DAXIEN</span>
                                <SettingInput name="betSettings.pricedxmn" register={register} />
                                <SettingInput name="betSettings.windxmn" register={register} />
                            </div>
                        </div>
                    </div>

                    {/* 2. MIỀN TRUNG */}
                    <div className="border p-4 rounded-lg bg-orange-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-orange-700 text-center border-b border-orange-200 pb-2 text-lg">MIỀN TRUNG (MT)</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DAU</span>
                                <SettingInput name="betSettings.price2daumt" register={register} />
                                <SettingInput name="betSettings.win2daumt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DUOI</span>
                                <SettingInput name="betSettings.price2duoimt" register={register} />
                                <SettingInput name="betSettings.win2duoimt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-18L</span>
                                <SettingInput name="betSettings.price2lmt" register={register} />
                                <SettingInput name="betSettings.win2lmt" register={register} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DAU</span>
                                <SettingInput name="betSettings.price3daumt" register={register} />
                                <SettingInput name="betSettings.win3daumt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DUOI</span>
                                <SettingInput name="betSettings.price3duoimt" register={register} />
                                <SettingInput name="betSettings.win3duoimt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-17L</span>
                                <SettingInput name="betSettings.price3lmt" register={register} />
                                <SettingInput name="betSettings.win3lmt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-DUOI</span>
                                <SettingInput name="betSettings.price4duoimt" register={register} />
                                <SettingInput name="betSettings.win4duoimt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-16L</span>
                                <SettingInput name="betSettings.price4lmt" register={register} />
                                <SettingInput name="betSettings.win4lmt" register={register} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">DATHANG</span>
                                <SettingInput name="betSettings.pricedamt" register={register} />
                                <SettingInput name="betSettings.windamt" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">DAXIEN</span>
                                <SettingInput name="betSettings.pricedxmt" register={register} />
                                <SettingInput name="betSettings.windxmt" register={register} />
                            </div>
                        </div>
                    </div>

                    {/* 3. MIỀN BẮC */}
                    <div className="border p-4 rounded-lg bg-red-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-red-700 text-center border-b border-red-200 pb-2 text-lg">MIỀN BẮC (MB)</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DAU</span>
                                <SettingInput name="betSettings.price2daumb" register={register} />
                                <SettingInput name="betSettings.win2daumb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-DUOI</span>
                                <SettingInput name="betSettings.price2duoimb" register={register} />
                                <SettingInput name="betSettings.win2duoimb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">2D-27L</span>
                                <SettingInput name="betSettings.price2lmb" register={register} />
                                <SettingInput name="betSettings.win2lmb" register={register} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DAU</span>
                                <SettingInput name="betSettings.price3daumb" register={register} />
                                <SettingInput name="betSettings.win3daumb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-DUOI</span>
                                <SettingInput name="betSettings.price3duoimb" register={register} />
                                <SettingInput name="betSettings.win3duoimb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">3D-23L</span>
                                <SettingInput name="betSettings.price3lmb" register={register} />
                                <SettingInput name="betSettings.win3lmb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-DUOI</span>
                                <SettingInput name="betSettings.price4duoimb" register={register} />
                                <SettingInput name="betSettings.win4duoimb" register={register} />
                            </div>
                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">4D-20L</span>
                                <SettingInput name="betSettings.price4lmb" register={register} />
                                <SettingInput name="betSettings.win4lmb" register={register} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                                <span className="text-xs font-semibold text-slate-600 min-w-[60px]">DATHANG</span>
                                <SettingInput name="betSettings.pricedamb" register={register} />
                                <SettingInput name="betSettings.windamb" register={register} />
                            </div>
                        </div>
                    </div>

                </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-2 shadow-inner">
                <Button type="submit" disabled={loading} size="lg" className="w-full md:w-auto">
                    {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo Khách Ngay"}
                </Button>
            </div>
            </form>
        </DialogContent>
        </Dialog>
    )
}
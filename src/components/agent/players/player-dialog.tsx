'use client'

import { useState } from "react"
import { useForm, SubmitHandler, Resolver } from "react-hook-form"
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

const formSchema = z.object({
    username: z.string().min(3),
    name: z.string().optional(),
    banned: z.boolean().default(false),
    betSettings: z.record(z.string(), z.number())
})

export type PlayerFormValues = {
    username: string;
    name?: string;
    banned: boolean;
    betSettings: BetSettings; 
};

interface PlayerDialogProps {
    player?: {
        id: string;
        username: string;
        name: string | null;
        banned: boolean;
        betSettings: unknown; 
    }
}

export function PlayerDialog({ player }: PlayerDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const isEdit = !!player;

    const initialSettings = player?.betSettings 
        ? (player.betSettings as BetSettings) 
        : DEFAULT_BET_SETTINGS;

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayerFormValues>({
        resolver: zodResolver(formSchema) as unknown as Resolver<PlayerFormValues>,
        defaultValues: player ? {
            username: player.username,
            name: player.name || "",
            banned: player.banned,
            betSettings: initialSettings
        } : {
            username: "",
            name: "",
            banned: false,
            betSettings: DEFAULT_BET_SETTINGS
        }
    });

    const onSubmit: SubmitHandler<PlayerFormValues> = async (data) => {
        setLoading(true);
        const payload = { ...data, betSettings: data.betSettings };
        const res = isEdit ? await updatePlayer(player.id, payload) : await createPlayer(payload);
        setLoading(false);
        
        if (res.error) toast.error(res.error);
        else {
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
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Tạo Khách</Button>
            )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{isEdit ? `Sửa: ${player?.username}` : "Tạo Khách Mới"}</DialogTitle></DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)}>
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info" className="gap-2"><User className="h-4 w-4"/> Thông tin chung</TabsTrigger>
                <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4"/> Cấu hình Giá & Trúng</TabsTrigger>
                </TabsList>

                {/* TAB THÔNG TIN */}
                <TabsContent value="info" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tài khoản</Label>
                        <Input {...register("username")} disabled={isEdit} placeholder="khach01" />
                        {errors.username && <p className="text-red-500 text-xs">{errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Tên hiển thị</Label>
                        <Input {...register("name")} placeholder="Anh Ba" />
                    </div>
                </div>
                {isEdit && (
                    <div className="flex items-center gap-2 pt-2 p-3 bg-slate-50 border rounded">
                        <Checkbox id="ban" checked={watch("banned")} onCheckedChange={(c) => setValue("banned", !!c)} />
                        <Label htmlFor="ban" className="text-red-600 font-medium cursor-pointer">Khóa tài khoản (Không cho cược)</Label>
                    </div>
                )}
                </TabsContent>

                {/* TAB CẤU HÌNH (FULL 58 TRƯỜNG) */}
                <TabsContent value="config" className="py-4">
                <div className="flex flex-col gap-6 max-w-xl mx-auto">
                    
                    {/* 1. MIỀN NAM */}
                    <div className="border p-4 rounded-lg bg-blue-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-blue-700 text-center border-b border-blue-200 pb-2">MIỀN NAM (MN)</h3>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div className="col-span-2 grid grid-cols-2 gap-4 text-center text-xs font-bold text-slate-500 mb-1">
                                <span>GIÁ THU (1k)</span><span>TRÚNG (Ăn)</span>
                            </div>

                            {/* 2 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đầu 2 số</div>
                            <SettingInput name="betSettings.price2daumn" register={register} />
                            <SettingInput name="betSettings.win2daumn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 2 số</div>
                            <SettingInput name="betSettings.price2duoimn" register={register} />
                            <SettingInput name="betSettings.win2duoimn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 2 số (18 giải)</div>
                            <SettingInput name="betSettings.price2lmn" register={register} />
                            <SettingInput name="betSettings.win2lmn" register={register} />

                            {/* 3 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đầu 3 số (Xỉu chủ đầu)</div>
                            <SettingInput name="betSettings.price3daumn" register={register} />
                            <SettingInput name="betSettings.win3daumn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 3 số (Xỉu chủ đuôi)</div>
                            <SettingInput name="betSettings.price3duoimn" register={register} />
                            <SettingInput name="betSettings.win3duoimn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 3 số (17 giải)</div>
                            <SettingInput name="betSettings.price3lmn" register={register} />
                            <SettingInput name="betSettings.win3lmn" register={register} />

                            {/* 4 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đuôi 4 số</div>
                            <SettingInput name="betSettings.price4duoimn" register={register} />
                            <SettingInput name="betSettings.win4duoimn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 4 số (16 giải)</div>
                            <SettingInput name="betSettings.price4lmn" register={register} />
                            <SettingInput name="betSettings.win4lmn" register={register} />

                            {/* Đá / Xiên */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đá (Xiên 2)</div>
                            <SettingInput name="betSettings.pricedamn" register={register} />
                            <SettingInput name="betSettings.windamn" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đá Xiên (Xiên quay)</div>
                            <SettingInput name="betSettings.pricedxmn" register={register} />
                            <SettingInput name="betSettings.windxmn" register={register} />
                        </div>
                    </div>

                    {/* 2. MIỀN TRUNG */}
                    <div className="border p-4 rounded-lg bg-orange-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-orange-700 text-center border-b border-orange-200 pb-2">MIỀN TRUNG (MT)</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {/* 2 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đầu 2 số</div>
                            <SettingInput name="betSettings.price2daumt" register={register} />
                            <SettingInput name="betSettings.win2daumt" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 2 số</div>
                            <SettingInput name="betSettings.price2duoimt" register={register} />
                            <SettingInput name="betSettings.win2duoimt" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 2 số</div>
                            <SettingInput name="betSettings.price2lmt" register={register} />
                            <SettingInput name="betSettings.win2lmt" register={register} />

                            {/* 3 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đầu 3 số</div>
                            <SettingInput name="betSettings.price3daumt" register={register} />
                            <SettingInput name="betSettings.win3daumt" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 3 số</div>
                            <SettingInput name="betSettings.price3duoimt" register={register} />
                            <SettingInput name="betSettings.win3duoimt" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 3 số</div>
                            <SettingInput name="betSettings.price3lmt" register={register} />
                            <SettingInput name="betSettings.win3lmt" register={register} />

                            {/* 4 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Bao Lô 4 số</div>
                            <SettingInput name="betSettings.price4lmt" register={register} />
                            <SettingInput name="betSettings.win4lmt" register={register} />

                            {/* Đá */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đá (Xiên 2)</div>
                            <SettingInput name="betSettings.pricedamt" register={register} />
                            <SettingInput name="betSettings.windamt" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đá Xiên</div>
                            <SettingInput name="betSettings.pricedxmt" register={register} />
                            <SettingInput name="betSettings.windxmt" register={register} />
                        </div>
                    </div>

                    {/* 3. MIỀN BẮC */}
                    <div className="border p-4 rounded-lg bg-red-50/50 shadow-sm space-y-4">
                        <h3 className="font-bold text-red-700 text-center border-b border-red-200 pb-2">MIỀN BẮC (MB)</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {/* 2 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đầu 2 số (4 giải)</div>
                            <SettingInput name="betSettings.price2daumb" register={register} />
                            <SettingInput name="betSettings.win2daumb" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 2 số (Đặc biệt)</div>
                            <SettingInput name="betSettings.price2duoimb" register={register} />
                            <SettingInput name="betSettings.win2duoimb" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 2 số (27 giải)</div>
                            <SettingInput name="betSettings.price2lmb" register={register} />
                            <SettingInput name="betSettings.win2lmb" register={register} />

                            {/* 3 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đầu 3 số (3 giải)</div>
                            <SettingInput name="betSettings.price3daumb" register={register} />
                            <SettingInput name="betSettings.win3daumb" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Đuôi 3 số (Đặc biệt)</div>
                            <SettingInput name="betSettings.price3duoimb" register={register} />
                            <SettingInput name="betSettings.win3duoimb" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 3 số (23 giải)</div>
                            <SettingInput name="betSettings.price3lmb" register={register} />
                            <SettingInput name="betSettings.win3lmb" register={register} />

                            {/* 4 Số */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đuôi 4 số (Đặc biệt)</div>
                            <SettingInput name="betSettings.price4duoimb" register={register} />
                            <SettingInput name="betSettings.win4duoimb" register={register} />

                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700">Bao Lô 4 số (20 giải)</div>
                            <SettingInput name="betSettings.price4lmb" register={register} />
                            <SettingInput name="betSettings.win4lmb" register={register} />

                            {/* Đá */}
                            <div className="col-span-2 text-xs font-semibold mt-2 text-slate-700 pt-2 border-t border-dashed">Đá (Xiên 2)</div>
                            <SettingInput name="betSettings.pricedamb" register={register} />
                            <SettingInput name="betSettings.windamb" register={register} />
                        </div>
                    </div>

                </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-2 shadow-inner">
                <Button type="submit" disabled={loading} size="lg" className="w-full md:w-auto">
                    {loading ? "Đang lưu..." : "Lưu Thông Tin"}
                </Button>
            </div>
            </form>
        </DialogContent>
        </Dialog>
    )
}
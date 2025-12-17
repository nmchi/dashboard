'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBetType, updateBetType } from "@/server/admin/bet-type-actions"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

const formSchema = z.object({
    name: z.string().min(1),
    aliases: z.string().min(1),
})

interface BetTypeDialogProps {
    betType?: {
        id: string;
        name: string;
        aliases: string;
    }
}

export function BetTypeDialog({ betType }: BetTypeDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const isEdit = !!betType;

    const { register, handleSubmit, reset } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: betType || { name: "", aliases: "" },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setLoading(true);

        const res = isEdit && betType ? await updateBetType(betType.id, data) : await createBetType(data);
        setLoading(false);
        if (res.error) toast.error(res.error);
        else {
            toast.success("Thành công");
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
                    <Button className="gap-2"><Plus className="h-4 w-4" /> Thêm Kiểu Chơi</Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>{isEdit ? "Sửa" : "Thêm"} Kiểu Chơi</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tên kiểu chơi</Label>
                        <Input {...register("name")} placeholder="VD: Bao Lô 2 số" />
                    </div>
                    <div className="space-y-2">
                        <Label>Cú pháp (Aliases)</Label>
                        <Input {...register("aliases")} placeholder="lo,bl" />
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading}>{loading ? "..." : "Lưu"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
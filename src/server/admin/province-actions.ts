'use server'

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { Region } from "@prisma/client";

const ScheduleInputSchema = z.object({
    dayOfWeek: z.number().min(0).max(6),
    ordering: z.number().min(1).max(10),
});

const ProvinceSchema = z.object({
    name: z.string().min(1, "Tên không được trống"),
    aliases: z.string().min(1, "Cú pháp không được trống"),
    region: z.nativeEnum(Region),
    schedules: z.array(ScheduleInputSchema).optional(),
});

async function checkAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "ADMIN") throw new Error("Không có quyền");
}

export async function createProvince(data: z.infer<typeof ProvinceSchema>) {
    try {
        await checkAdmin();
        const { schedules, ...provinceData } = data;

        await db.lotteryProvince.create({
        data: {
            ...provinceData,
            schedules: {
                create: schedules?.map(s => ({
                    dayOfWeek: s.dayOfWeek,
                    ordering: s.ordering, // <--- Lưu ordering
                    region: provinceData.region
                }))
            }
        }
        });
        revalidatePath("/admin/provinces");
        return { success: true };
    } catch (error) { return { error: "Lỗi tạo đài" }; }
}

export async function updateProvince(id: string, data: z.infer<typeof ProvinceSchema>) {
    try {
        await checkAdmin();
        const { schedules, ...provinceData } = data;

        await db.$transaction(async (tx) => {
            await tx.lotteryProvince.update({
                where: { id },
                data: provinceData
            });

            if (schedules) {
                await tx.lotterySchedule.deleteMany({ where: { provinceId: id } });
                
                if (schedules.length > 0) {
                    await tx.lotterySchedule.createMany({
                        data: schedules.map(s => ({
                            provinceId: id,
                            dayOfWeek: s.dayOfWeek,
                            ordering: s.ordering, // <--- Lưu ordering
                            region: provinceData.region
                        }))
                    });
                }
            }
        });

        revalidatePath("/admin/provinces");
        return { success: true };
    } catch (error) { return { error: "Lỗi cập nhật" }; }
}

export async function deleteProvince(id: string) {
    try {
        await checkAdmin();
        await db.lotteryProvince.delete({ where: { id } });
        revalidatePath("/admin/provinces");
        return { success: true };
    } catch (error) { return { error: "Lỗi xóa đài" }; }
}
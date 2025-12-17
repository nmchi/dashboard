'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Ban, Trash2, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { toggleBanAgent, deleteAgent } from "@/server/admin/agent-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgentActionsProps {
    userId: string;
    username: string;
    isBanned: boolean;
}

export function AgentActions({ userId, username, isBanned }: AgentActionsProps) {
    const [loading, setLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Xử lý Ban/Unban
    const handleToggleBan = async () => {
        setLoading(true);
        const res = await toggleBanAgent(userId, isBanned);
        setLoading(false);
        
        if (res.error) toast.error(res.error);
        else toast.success(res.message);
    };

    // Xử lý Xóa
    const handleDelete = async () => {
        const res = await deleteAgent(userId);
        if (res.error) toast.error(res.error);
        else {
        toast.success(res.message);
        setShowDeleteDialog(false);
        }
    };

    return (
        <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(username)}>
                Copy Username
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleToggleBan} disabled={loading}>
                {isBanned ? (
                    <>
                        <LockOpen className="mr-2 h-4 w-4 text-green-600" />
                        <span>Mở khóa</span>
                    </>
                ) : (
                    <>
                        <Ban className="mr-2 h-4 w-4 text-orange-600" />
                        <span>Khóa tài khoản</span>
                    </>
                )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)} 
                className="text-red-600 focus:text-red-600"
            >
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa vĩnh viễn
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* Dialog xác nhận xóa */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                <AlertDialogDescription>
                Hành động này không thể hoàn tác. Tài khoản <strong>{username}</strong> và toàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Xác nhận xóa
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
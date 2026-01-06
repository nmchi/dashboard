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
import { MoreHorizontal, Ban, Trash2, LockOpen, KeyRound, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { toggleBanAgent, deleteAgent, resetAgentPassword, extendAgentExpiry } from "@/server/admin/agent-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

// Các gói gia hạn
const EXTEND_OPTIONS = [
    { value: "3", label: "3 ngày" },
    { value: "7", label: "7 ngày" },
    { value: "30", label: "1 tháng" },
    { value: "90", label: "3 tháng" },
    { value: "180", label: "6 tháng" },
    { value: "365", label: "12 tháng" },
];

interface AgentActionsProps {
    userId: string;
    username: string;
    isBanned: boolean;
    expiresAt: Date | null;
}

export function AgentActions({ userId, username, isBanned, expiresAt }: AgentActionsProps) {
    const [loading, setLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
    const [showExtendDialog, setShowExtendDialog] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [extendDays, setExtendDays] = useState("30");

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

    // Xử lý Reset Password
    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            toast.error("Mật khẩu phải có ít nhất 6 ký tự");
            return;
        }
        
        setLoading(true);
        const res = await resetAgentPassword(userId, newPassword);
        setLoading(false);
        
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(res.message);
            setShowResetPasswordDialog(false);
            setNewPassword("");
        }
    };

    // Xử lý Gia hạn
    const handleExtend = async () => {
        setLoading(true);
        const res = await extendAgentExpiry(userId, parseInt(extendDays));
        setLoading(false);
        
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(res.message);
            setShowExtendDialog(false);
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
                    
                    <DropdownMenuItem onClick={() => setShowExtendDialog(true)}>
                        <CalendarPlus className="mr-2 h-4 w-4 text-green-600" />
                        <span>Gia hạn</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={() => setShowResetPasswordDialog(true)}>
                        <KeyRound className="mr-2 h-4 w-4 text-blue-600" />
                        <span>Reset mật khẩu</span>
                    </DropdownMenuItem>
                    
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

            {/* Dialog reset password */}
            <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset mật khẩu cho {username}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Mật khẩu mới</Label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                            />
                        </div>
                        <p className="text-sm text-slate-500">
                            Sau khi reset, đại lý sẽ bị đăng xuất và phải đăng nhập lại với mật khẩu mới.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
                                Hủy
                            </Button>
                            <Button onClick={handleResetPassword} disabled={loading || newPassword.length < 6}>
                                {loading ? "Đang xử lý..." : "Reset mật khẩu"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog gia hạn */}
            <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gia hạn cho {username}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {expiresAt && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-600">
                                    Hạn hiện tại: <strong>{format(expiresAt, "dd/MM/yyyy HH:mm")}</strong>
                                </p>
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <Label>Thời gian gia hạn</Label>
                            <Select value={extendDays} onValueChange={setExtendDays}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn thời gian" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EXTEND_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <p className="text-sm text-slate-500">
                            {expiresAt && new Date(expiresAt) > new Date() 
                                ? "Thời gian sẽ được cộng thêm vào hạn hiện tại." 
                                : "Thời gian sẽ được tính từ ngày hôm nay."}
                        </p>
                        
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
                                Hủy
                            </Button>
                            <Button onClick={handleExtend} disabled={loading} className="bg-green-600 hover:bg-green-700">
                                {loading ? "Đang xử lý..." : "Gia hạn"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
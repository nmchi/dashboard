import { ChangePasswordDialog } from "@/components/user/change-password-dialog";
import { getCurrentUser } from "@/lib/auth-session";

export default async function AgentProfilePage() {
    const user = await getCurrentUser();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Thông tin cá nhân</h1>
            
            {/* Thông tin tài khoản */}
            <div className="p-6 bg-white rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Thông tin tài khoản</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-slate-600">Tên đăng nhập</span>
                        <span className="font-medium">{user?.username}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-slate-600">Tên hiển thị</span>
                        <span className="font-medium">{user?.name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-slate-600">Email</span>
                        <span className="font-medium">{user?.email || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-slate-600">Vai trò</span>
                        <span className="font-medium text-blue-600">{user?.role}</span>
                    </div>
                </div>
            </div>
            
            {/* Bảo mật */}
            <div className="p-6 bg-white rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Bảo mật</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Mật khẩu</p>
                        <p className="text-sm text-slate-500">Nên thay đổi mật khẩu định kỳ để bảo vệ tài khoản.</p>
                    </div>
                    <ChangePasswordDialog />
                </div>
            </div>
        </div>
    );
}
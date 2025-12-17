import { ChangePasswordDialog } from "@/components/user/change-password-dialog";

export default function ProfilePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Thông tin cá nhân</h1>
            
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
    )
}
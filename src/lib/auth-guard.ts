import { getCurrentUser, SessionUser } from "./auth-session";

/**
 * Yêu cầu đăng nhập - trả về user hoặc throw error
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("Bạn chưa đăng nhập");
    }
    return user;
}

/**
 * Yêu cầu quyền ADMIN
 */
export async function requireAdmin(): Promise<SessionUser> {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
        throw new Error("Không có quyền truy cập - Yêu cầu quyền Admin");
    }
    return user;
}

/**
 * Yêu cầu quyền AGENT
 */
export async function requireAgent(): Promise<SessionUser> {
    const user = await requireAuth();
    if (user.role !== "AGENT") {
        throw new Error("Không có quyền truy cập - Yêu cầu quyền Agent");
    }
    return user;
}

/**
 * Yêu cầu ADMIN hoặc AGENT
 */
export async function requireAdminOrAgent(): Promise<SessionUser> {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "AGENT") {
        throw new Error("Không có quyền truy cập");
    }
    return user;
}
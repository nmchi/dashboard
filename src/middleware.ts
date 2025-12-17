import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route công khai - không cần đăng nhập
const publicRoutes = ["/", "/pricing", "/unauthorized", "/banned"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Bỏ qua static files và API
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // 2. Lấy session token từ cookie
    const sessionToken =
        request.cookies.get("better-auth.session_token")?.value ||
        request.cookies.get("__Secure-better-auth.session_token")?.value;

    const isAuthenticated = !!sessionToken;
    const isPublicRoute = publicRoutes.includes(pathname);

    // 3. Chưa đăng nhập + private route -> redirect về login
    if (!isAuthenticated && !isPublicRoute) {
        const loginUrl = new URL("/", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 4. Đã có token -> Verify session và check banned/role
    if (isAuthenticated && !isPublicRoute) {
        try {
            // Gọi API custom để lấy session với banned status
            const sessionResponse = await fetch(
                `${request.nextUrl.origin}/api/session-status`,
                {
                    headers: {
                        cookie: request.headers.get("cookie") || "",
                    },
                    cache: "no-store",
                }
            );

            const session = await sessionResponse.json();

            // 4a. Session không hợp lệ
            if (!session || !session.user) {
                const response = NextResponse.redirect(new URL("/", request.url));
                response.cookies.delete("better-auth.session_token");
                response.cookies.delete("__Secure-better-auth.session_token");
                return response;
            }

            const userRole = session.user.role;
            const isBanned = session.user.banned;

            // 4b. User bị banned -> redirect đến trang thông báo + xóa session
            if (isBanned) {
                const response = NextResponse.redirect(new URL("/banned", request.url));
                response.cookies.delete("better-auth.session_token");
                response.cookies.delete("__Secure-better-auth.session_token");
                return response;
            }

            // 4c. Route /admin/* - chỉ ADMIN được vào
            if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
                return NextResponse.redirect(new URL("/unauthorized", request.url));
            }

            // 4d. Route /agent/* - chỉ AGENT được vào
            if (pathname.startsWith("/agent") && userRole !== "AGENT") {
                return NextResponse.redirect(new URL("/unauthorized", request.url));
            }

        } catch (error) {
            console.error("[Middleware] Error:", error);
            // Lỗi fetch -> cho đi tiếp, layout sẽ handle
        }
    }

    // 5. Đã login mà vào trang chủ -> redirect theo role
    if (isAuthenticated && pathname === "/") {
        try {
            const sessionResponse = await fetch(
                `${request.nextUrl.origin}/api/session-status`,
                {
                    headers: {
                        cookie: request.headers.get("cookie") || "",
                    },
                    cache: "no-store",
                }
            );

            const session = await sessionResponse.json();

            if (session?.user && !session.user.banned) {
                const userRole = session.user.role;
                
                if (userRole === "ADMIN") {
                    return NextResponse.redirect(new URL("/admin", request.url));
                }
                if (userRole === "AGENT") {
                    return NextResponse.redirect(new URL("/agent", request.url));
                }
            }
        } catch (error) {
            console.error("[Middleware] Redirect error:", error);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

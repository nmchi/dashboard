import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    return session;
});

export interface SessionUser {
    id: string;
    name: string | null;
    email: string | null;
    username: string;
    role: 'ADMIN' | 'AGENT' | 'PLAYER';
    banned: boolean;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
    const session = await getSession();
    if (!session?.user) return null;
    
    return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        username: (session.user as { username?: string }).username || '',
        role: ((session.user as { role?: string }).role || 'PLAYER') as SessionUser['role'],
        banned: (session.user as { banned?: boolean }).banned || false,
    };
}
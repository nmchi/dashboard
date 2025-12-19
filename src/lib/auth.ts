import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./prisma";
import { compare, hash } from "bcryptjs";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
    database: prismaAdapter(db, {
        provider: "postgresql",
    }),

    plugins: [ 
        username(),
        nextCookies(),
    ],

    session: {
        expiresIn: 60 * 60 * 24 * 7, // Session sống 7 ngày
        updateAge: 60 * 60 * 24,     // Cập nhật mỗi 1 ngày
        
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // Cache 5 phút (không query DB trong 5 phút)
            strategy: "jwt", // Sử dụng JWT - signed & tamper-proof
        }
    },

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
            },
            banned: {
                type: "boolean",
                required: false,
            },
        },
    },

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        password: {
            hash: async (password: string) => {
                return await hash(password, 12);
            },
            verify: async ({ password, hash: storedHash }) => {
                if (!storedHash) {
                    console.error("❌ Verify Error: Không tìm thấy hash mật khẩu trong DB.");
                    return false;
                }

                const pwdString = typeof password === 'string' ? password : String(password);
                return await compare(pwdString, storedHash);
            }
        },
    },

    secret: process.env.BETTER_AUTH_SECRET,
});
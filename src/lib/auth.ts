import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./prisma";
import { compare, hash } from "bcryptjs";
import { username } from "better-auth/plugins";

export const auth = betterAuth({
    database: prismaAdapter(db, {
        provider: "postgresql",
    }),

    plugins: [ 
        username()
    ],

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

    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },

    secret: process.env.BETTER_AUTH_SECRET,
});
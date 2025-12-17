import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function HomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        const user = session.user as { role?: string }; 
        const role = user.role;

        if (role === "ADMIN") {
            redirect("/admin");
        } else if (role === "AGENT") {
            redirect("/agent"); 
        }
    }

    return <LoginForm />;
}
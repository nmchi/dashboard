import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth-session";

export default async function HomePage() {
    const user = await getCurrentUser();

    if (user) {
        if (user.role === "ADMIN") {
            redirect("/admin");
        } else if (user.role === "AGENT") {
            redirect("/agent"); 
        }
    }

    return <LoginForm />;
}
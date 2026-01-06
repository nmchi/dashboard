import { 
    LayoutDashboard, 
    Users,
    Map,
    List,
    Settings,
    LucideIcon,
    FileText,
    History,
    Code
} from "lucide-react";

export type NavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    roles: string[];
};

export const sidebarLinks: NavItem[] = [
    {
        title: "Tổng quan",
        href: "/admin",
        icon: LayoutDashboard,
        roles: ["ADMIN"],
    },
    {
        title: "Quản lý Máy",
        href: "/admin/agents",
        icon: Users,
        roles: ["ADMIN"],
    },
    {
        title: "Quản lý Đài",
        href: "/admin/provinces",
        icon: Map,
        roles: ["ADMIN"],
    },
    {
        title: "Quản lý Kiểu",
        href: "/admin/bet-types",
        icon: List,
        roles: ["ADMIN"],
    },
    {
        title: "Profile",
        href: "/admin/profile",
        icon: Settings,
        roles: ["ADMIN"],
    },
    {
        title: "Tổng quan",
        href: "/agent",
        icon: LayoutDashboard,
        roles: ["AGENT"],
    },
    {
        title: "Cú pháp Đài",
        href: "/agent/syntax/provinces",
        icon: Map,
        roles: ["AGENT"],
    },
    {
        title: "Cú pháp Kiểu",
        href: "/agent/syntax/bet-types",
        icon: Code,
        roles: ["AGENT"],
    },
    {
        title: "Quản lý Khách",
        href: "/agent/players",
        icon: Users,
        roles: ["AGENT"],
    },
    {
        title: "Máy Quét Tin",
        href: "/agent/parser",
        icon: FileText,
        roles: ["AGENT"],
    },
    {
        title: "Lịch Sử Tin",
        href: "/agent/tickets",
        icon: History,
        roles: ["AGENT"],
    },
    {
        title: "Profile",
        href: "/agent/profile",
        icon: Settings,
        roles: ["AGENT"],
    },
];
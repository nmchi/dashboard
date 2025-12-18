import { 
    LayoutDashboard, 
    Users,
    Package,
    Map,
    List,
    Settings,
    LucideIcon,
    FileText,
    History
} from "lucide-react";

export type NavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    roles: string[];
};

export const sidebarLinks: NavItem[] = [
    {
        title: "Tổng quan Admin",
        href: "/admin",
        icon: LayoutDashboard,
        roles: ["ADMIN"],
    },
    {
        title: "Quản lý Đại lý",
        href: "/admin/agents",
        icon: Users,
        roles: ["ADMIN"],
    },
    {
        title: "Quản lý Gói cước",
        href: "/admin/packages",
        icon: Package,
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
        icon: List,
        roles: ["ADMIN"],
    },
        {
        title: "Tổng quan AGENT",
        href: "/agent",
        icon: LayoutDashboard,
        roles: ["AGENT"],
    },
    {
        title: "Quản lý Người chơi",
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
        title: "Cấu hình",
        href: "/settings/game",
        icon: Settings,
        roles: ["AGENT"],
    },
];
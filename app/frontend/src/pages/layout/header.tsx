import * as React from "react";
import { NavLink, Link } from "react-router-dom";
// images
import personasLogo from "@/pages/logos/personas-logo.png";
import blLogo from "@/pages/logos/BL-logo.png";

const BRAND_PRIMARY = "#343741";

type NavItem = { to: string; label: string };

const navItems: NavItem[] = [
    { to: "/", label: "Dashboard" },
    { to: "/personas", label: "Personas" },
    { to: "/chat", label: "Chat" }
];

const pillBase = "px-3 py-1.5 rounded-full text-sm transition-smooth";
const pillInactive = "text-white/80 hover:bg-white/10 hover:text-white";
const pillActive = "bg-white text-[#343741] shadow-sm";

export default function Header() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b" style={{ backgroundColor: BRAND_PRIMARY, borderColor: "rgba(255,255,255,0.08)" }} role="banner">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="h-16 flex items-center justify-between gap-4">
                    {/* Left: Personas logo + partner */}
                    <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Home">
                        <img src={personasLogo} alt="Personas" className="h-7 w-auto object-contain" draggable={false} />
                        {/* separator */}
                        <span className="text-white/70 font-semibold">×</span>
                        <img src={blLogo} alt="Best & Less" className="h-6 w-auto object-contain rounded-md" draggable={false} />
                    </Link>

                    {/* Center nav */}
                    <nav className="hidden md:flex items-center gap-2">
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"} // so "/" only active on dashboard
                                className={({ isActive }) => [pillBase, isActive ? pillActive : pillInactive].join(" ")}
                                aria-label={item.label}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Right side: only nav items / login etc, no language picker */}
                    <div className="flex items-center gap-3 shrink-0">
                        {/* If you have auth/login button */}
                        {/* Example: */}
                        {/* {useLogin && <LoginButton />} */}
                    </div>
                </div>
            </div>
        </header>
    );
}

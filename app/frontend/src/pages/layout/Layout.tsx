// src/pages/layout/Layout.tsx
import React, { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";

import { useLogin } from "../../authConfig";
import { LoginButton } from "../../components/LoginButton";
import { IconButton } from "@fluentui/react";

// ✅ logos (place under src/pages/logos/)
import personasLogo from "../logos/personas-logo.png";
import blLogo from "../logos/BL-logo.png";

/**
 * Brand tokens for quick reuse / future theming
 */
const BRAND = {
    primary: "#343741", // company primary
    surface: "#ffffff",
    surfaceSubtle: "#ececec"
};

const pillBase = "px-3 py-1.5 rounded-full text-sm transition-smooth";
const pillInactive = "text-white/80 hover:bg-white/10 hover:text-white";
const pillActive = "bg-white text-[#343741] shadow-sm";

const Layout: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const isChat = location.pathname.startsWith("/chat");

    const toggleMenu = () => setMenuOpen(v => !v);

    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setMenuOpen(false);
        }
    };

    useEffect(() => {
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    return (
        <div className="min-h-screen flex flex-col">
            {/* ===== Header ===== */}
            <header
                role="banner"
                className="fixed top-0 inset-x-0 z-40 border-b"
                style={{
                    backgroundColor: BRAND.primary,
                    borderColor: "rgba(255,255,255,0.08)"
                }}
            >
                <div ref={menuRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    {/* Left: our logo × partner logo */}
                    <div className="flex items-center gap-3">
                        <Link to="/" className="flex items-center gap-3 group">
                            <img src={personasLogo} alt="Personas" className="h-7 w-auto object-contain select-none" draggable={false} />
                        </Link>

                        {/* Divider “×” for partnership */}
                        <span className="text-white/70 font-semibold select-none" aria-hidden>
                            ×
                        </span>

                        {/* Partner logo (larger, no background) */}
                        <img src={blLogo} alt="Best & Less" className="h-8 w-auto object-contain select-none" draggable={false} />
                    </div>

                    {/* Center: nav (active = white rounded rectangle) */}
                    <nav aria-label="Primary" className="hidden md:flex items-center gap-2">
                        <NavLink to="/" end className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillInactive}`}>
                            Dashboard
                        </NavLink>

                        <NavLink to="/personas" className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillInactive}`}>
                            Personas
                        </NavLink>

                        <NavLink to="/chat" className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillInactive}`}>
                            Chat
                        </NavLink>

                        <NavLink to="/voice" className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillInactive}`}>
                            Voice
                        </NavLink>
                    </nav>

                    {/* Right: login + hamburger */}
                    <div className="flex items-center gap-3">
                        {useLogin && <LoginButton />}

                        {/* Mobile menu toggle */}
                        <div className="md:hidden">
                            <IconButton
                                iconProps={{ iconName: "GlobalNavButton" }}
                                styles={{ root: { color: "#fff", background: "transparent" } }}
                                onClick={toggleMenu}
                                aria-expanded={menuOpen}
                                ariaLabel="Toggle menu"
                            />
                        </div>
                    </div>
                </div>

                {/* Mobile menu (collapsible) */}
                <div
                    className={`md:hidden overflow-hidden transition-[max-height] duration-200 ease-out ${menuOpen ? "max-h-48" : "max-h-0"}`}
                    style={{ backgroundColor: BRAND.primary }}
                >
                    <div className="px-4 pt-2 pb-3 flex flex-col gap-2">
                        <NavLink
                            to="/"
                            end
                            className={({ isActive }) => `${pillBase} w-max ${isActive ? pillActive : "text-white/90 hover:bg-white/10"}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Dashboard
                        </NavLink>
                        <NavLink
                            to="/personas"
                            className={({ isActive }) => `${pillBase} w-max ${isActive ? pillActive : "text-white/90 hover:bg-white/10"}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Personas
                        </NavLink>
                        <NavLink
                            to="/chat"
                            className={({ isActive }) => `${pillBase} w-max ${isActive ? pillActive : "text-white/90 hover:bg-white/10"}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Chat
                        </NavLink>
                        <NavLink
                            to="/voice"
                            className={({ isActive }) => `${pillBase} w-max ${isActive ? pillActive : "text-white/90 hover:bg-white/10"}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            Voice
                        </NavLink>
                    </div>
                </div>
            </header>

            {/* ===== Main outlet (push down under fixed header) ===== */}
            <main id="main-content" className={`flex-1 pt-20 ${isChat ? "" : ""}`} style={{ background: "#f5f6f8" }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;

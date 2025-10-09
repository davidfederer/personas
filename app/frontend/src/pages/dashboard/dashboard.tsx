import * as React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Users } from "lucide-react";

/**
 * Brand colors — KEEPING your palette as requested.
 */
const BRAND = "#31343e";
const BRAND_ALT = "#4a5060";

/** Helpers for inline gradients using brand colors */
const gradientPrimary = { backgroundImage: `linear-gradient(90deg, ${BRAND}, ${BRAND_ALT})` };
const gradientHeroText = { backgroundImage: `linear-gradient(90deg, ${BRAND}, ${BRAND_ALT})` };

/* ----------------------------- Usage (dashboard) ---------------------------- */
const USAGE_KEY = "persona_usage_v1";
type PersonaUsage = {
    id: string;
    name: string;
    industry?: string; // comes from Persona.vertical
    chats: number; // total chats started
    lastUsed: number; // epoch ms
};

function loadUsage(): Record<string, PersonaUsage> {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, PersonaUsage>) : {};
    } catch {
        return {};
    }
}

// Friendly “x minutes/hours/days ago” using the Intl.RelativeTimeFormat API.
function formatTimeAgo(ts: number, now: number = Date.now(), locale: string = navigator.language || "en") {
    const diff = ts - now; // negative if in the past
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "long" });
    const minute = 60 * 1000,
        hour = 60 * minute,
        day = 24 * hour,
        week = 7 * day;
    if (abs < minute) return rtf.format(Math.round(diff / 1000), "second");
    if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
    if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
    if (abs < week) return rtf.format(Math.round(diff / day), "day");
    return rtf.format(Math.round(diff / week), "week");
}

/**
 * NOTE on hero image:
 * - Optional image at /public/assets/hero-personas.jpg
 */
export default function Dashboard() {
    // Build Recent Personas list from local usage log (most recent first, max 3)
    const [recentUsages, setRecentUsages] = useState<PersonaUsage[]>([]);
    useEffect(() => {
        const map = loadUsage();
        const items = Object.values(map)
            .filter(u => u.lastUsed && u.chats > 0)
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 3);
        setRecentUsages(items);
    }, []);

    return (
        <div className="pt-20 min-h-screen bg-gradient-subtle">
            <div className="container mx-auto px-4 py-8">
                {/* Hero Section */}
                <div className="mb-12 relative rounded-3xl overflow-hidden">
                    <img src="/assets/hero-personas.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                    <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(1000px 600px at 50% -20%, ${BRAND}1A, transparent 70%)` }} />
                    <div className="relative z-10 py-16 md:py-20 text-center max-w-3xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent" style={gradientHeroText}>
                            Welcome to Personas
                        </h1>
                        <p className="text-xl text-neutral-500 mb-8">
                            Transform customer data into actionable insights through AI-powered persona conversations
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/chat">
                                <button
                                    className="inline-flex items-center px-6 py-3 rounded-xl text-white font-semibold shadow-sm transition duration-200 hover:shadow-md"
                                    style={gradientPrimary}
                                >
                                    Start Chatting
                                    <MessageSquare className="ml-2 w-4 h-4" />
                                </button>
                            </Link>
                            <Link to="/personas">
                                <button className="inline-flex items-center px-6 py-3 rounded-xl border border-neutral-300 text-neutral-800 font-semibold bg-white/90 backdrop-blur-sm hover:bg-white transition duration-200">
                                    Browse Personas
                                    <Users className="ml-2 w-4 h-4" />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Recent Activity + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Personas (from usage log) */}
                    <div className="rounded-2xl border border-neutral-200 bg-white">
                        <div className="px-5 py-4 border-b border-neutral-200">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-neutral-700" />
                                <h3 className="text-base font-semibold text-neutral-800">Recent Personas</h3>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                {recentUsages.length === 0 ? (
                                    <div className="text-sm text-neutral-500">No recent persona activity yet.</div>
                                ) : (
                                    recentUsages.map(u => (
                                        <div
                                            key={u.id}
                                            className="flex items-center justify-between p-4 rounded-lg bg-neutral-100/60 border border-neutral-200"
                                        >
                                            <div>
                                                <h4 className="font-medium text-neutral-900">{u.name}</h4>
                                                <p className="text-sm text-neutral-500">{u.industry || "—"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-neutral-800">{u.chats} chats</p>
                                                <p className="text-xs text-neutral-500">{formatTimeAgo(u.lastUsed)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <Link to="/personas" className="block mt-4">
                                <button className="w-full px-4 py-3 rounded-xl border border-neutral-300 text-neutral-800 font-semibold bg-white hover:bg-neutral-50 transition duration-200">
                                    View All Personas
                                </button>
                            </Link>
                        </div>
                    </div>

                    {/* Quick Actions (trimmed) */}
                    <div className="rounded-2xl border border-neutral-200 bg-white">
                        <div className="px-5 py-4 border-b border-neutral-200">
                            <h3 className="text-base font-semibold text-neutral-800">Quick Actions</h3>
                        </div>
                        <div className="p-5">
                            <div className="space-y-4">
                                <Link to="/chat" className="block">
                                    <button
                                        className="w-full justify-start inline-flex items-center px-4 py-3 rounded-xl text-white font-semibold shadow-sm hover:shadow-md transition duration-200"
                                        style={gradientPrimary}
                                    >
                                        <MessageSquare className="mr-2 w-4 h-4" />
                                        Start New Conversation
                                    </button>
                                </Link>
                                <Link to="/personas" className="block">
                                    <button className="w-full justify-start inline-flex items-center px-4 py-3 rounded-xl border border-neutral-300 text-neutral-800 font-semibold bg-white hover:bg-neutral-50 transition duration-200">
                                        <Users className="mr-2 w-4 h-4" />
                                        Create New Persona
                                    </button>
                                </Link>
                                {/* Removed: View Analytics & Export Insights */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

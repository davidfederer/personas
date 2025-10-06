import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Users, TrendingUp, Activity } from "lucide-react";

// === Logic brought back (no UI changes for stats values) ===
import { configApi } from "../../api";
import { useLogin, getToken } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { useHistoryManager, HistoryProviderOptions, type HistoryMetaData, type IHistoryProvider } from "../../components/HistoryProviders";
import { DEFAULT_PERSONAS } from "../personas/personas";

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

/* ----------------------- Cross-page data (read-only) ----------------------- */
/** Dashboard reads lightweight summaries written by:
 * - Analytics page (LatencySLA.tsx) -> localStorage["analytics.summary"]
 * - Insights page  (PersonaHealth.tsx) -> localStorage["insights.summary"]
 *
 * Expected shapes:
 * analytics.summary   -> { responseRate?: number, sampleCount?: number, updatedAt?: number }
 * insights.summary    -> { insightsGenerated?: number, updatedAt?: number }
 */
type AnalyticsSummary = { responseRate?: number; sampleCount?: number; updatedAt?: number };
type InsightsSummary = { insightsGenerated?: number; updatedAt?: number };

function readAnalyticsSummary(): AnalyticsSummary {
    try {
        const raw = localStorage.getItem("analytics.summary");
        return raw ? (JSON.parse(raw) as AnalyticsSummary) : {};
    } catch {
        return {};
    }
}
function readInsightsSummary(): InsightsSummary {
    try {
        const raw = localStorage.getItem("insights.summary");
        return raw ? (JSON.parse(raw) as InsightsSummary) : {};
    } catch {
        return {};
    }
}

/**
 * NOTE on hero image:
 * - Optional image at /public/assets/hero-personas.jpg
 */
export default function Dashboard() {
    // === Reintroduced data logic (unchanged behavior for counts) ===
    const isAuthOn = useLogin;
    const msal = isAuthOn ? useMsal().instance : undefined;

    const [showChatHistoryBrowser, setShowChatHistoryBrowser] = useState(false);
    const [showChatHistoryCosmos, setShowChatHistoryCosmos] = useState(false);

    const [historyMeta, setHistoryMeta] = useState<HistoryMetaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const historyProvider: HistoryProviderOptions = useMemo(() => {
        if (isAuthOn && showChatHistoryCosmos) return HistoryProviderOptions.CosmosDB;
        if (showChatHistoryBrowser) return HistoryProviderOptions.IndexedDB;
        return HistoryProviderOptions.None;
    }, [isAuthOn, showChatHistoryBrowser, showChatHistoryCosmos]);

    const historyManager: IHistoryProvider = useHistoryManager(historyProvider);

    useEffect(() => {
        let aborted = false;
        const run = async () => {
            setIsLoading(true);
            try {
                const cfg = await configApi();
                if (aborted) return;
                setShowChatHistoryBrowser(cfg.showChatHistoryBrowser);
                setShowChatHistoryCosmos(cfg.showChatHistoryCosmos);

                const idToken = isAuthOn && msal ? await getToken(msal) : undefined;

                historyManager.resetContinuationToken();
                const meta = await historyManager.getNextItems(50, idToken);
                if (aborted) return;
                setHistoryMeta(meta ?? []);
            } catch {
                setHistoryMeta([]);
            } finally {
                if (!aborted) setIsLoading(false);
            }
        };
        run();
        return () => {
            aborted = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // dynamic counts for first two stat tiles (values only)
    const activePersonasCount = DEFAULT_PERSONAS.length;
    const conversationsCount = historyMeta.length;

    /* ----------- Read dynamic metrics from Analytics/Insights pages ----------- */
    const [insightsGenerated, setInsightsGenerated] = useState<number | undefined>(undefined);
    const [responseRatePct, setResponseRatePct] = useState<number | undefined>(undefined);

    useEffect(() => {
        // pull once on mount
        const ins = readInsightsSummary();
        const ana = readAnalyticsSummary();
        setInsightsGenerated(typeof ins.insightsGenerated === "number" ? ins.insightsGenerated : undefined);
        setResponseRatePct(typeof ana.responseRate === "number" && !isNaN(ana.responseRate) ? Math.max(0, Math.min(1, ana.responseRate)) : undefined);

        // also listen for storage updates (if those pages update while dashboard is open)
        const onStorage = (e: StorageEvent) => {
            if (e.key === "insights.summary") {
                try {
                    const v = e.newValue ? (JSON.parse(e.newValue) as InsightsSummary) : {};
                    setInsightsGenerated(typeof v.insightsGenerated === "number" ? v.insightsGenerated : undefined);
                } catch {
                    /* noop */
                }
            } else if (e.key === "analytics.summary") {
                try {
                    const v = e.newValue ? (JSON.parse(e.newValue) as AnalyticsSummary) : {};
                    setResponseRatePct(typeof v.responseRate === "number" && !isNaN(v.responseRate) ? Math.max(0, Math.min(1, v.responseRate)) : undefined);
                } catch {
                    /* noop */
                }
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    // Compute display strings (no hardcoded fallbacks)
    const insightsDisplay = typeof insightsGenerated === "number" ? String(insightsGenerated) : "—";
    const responseDisplay = typeof responseRatePct === "number" ? `${Math.round(responseRatePct * 100)}%` : "—";

    // Stats with NO subtext lines (unchanged UI)
    const stats = [
        { key: "active", title: "Active Personas", value: isLoading ? "—" : String(activePersonasCount), icon: Users as any, to: undefined },
        { key: "convos", title: "Conversations", value: isLoading ? "—" : String(conversationsCount), icon: MessageSquare as any, to: undefined },
        {
            key: "insights",
            title: "Insights Generated",
            value: insightsDisplay,
            icon: TrendingUp as any,
            to: "/insights" // clickable tile → Insights page
        },
        {
            key: "response",
            title: "Response Rate",
            value: responseDisplay,
            icon: Activity as any,
            to: "/analytics" // clickable tile → Analytics page
        }
    ] as const;

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

                {/* Stats Grid (no sub text) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {stats.map(stat => {
                        const Icon = stat.icon;
                        const content = (
                            <div className="rounded-2xl border border-neutral-200 bg-white hover:shadow-md transition duration-200">
                                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                                    <div className="text-sm font-medium text-neutral-500">{stat.title}</div>
                                    <Icon className="w-4 h-4 text-neutral-500" />
                                </div>
                                <div className="px-5 pb-5">
                                    <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                                </div>
                            </div>
                        );

                        // Make Insights + Response tiles clickable to their pages — no visual change
                        return stat.to ? (
                            <Link to={stat.to} key={stat.key} className="block">
                                {content}
                            </Link>
                        ) : (
                            <div key={stat.key}>{content}</div>
                        );
                    })}
                </div>

                {/* Recent Activity */}
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

                    {/* Quick Actions */}
                    <div className="rounded-2xl border border-neutral-200 bg-white">
                        <div className="px-5 py-4 border-b border-neutral-200">
                            <h3 className="text-base font-semibold text-neutral-800">Quick Actions</h3>
                        </div>
                        <div className="p-5">
                            {/* Add vertical spacing between direct children (Tailwind space-y-4) */}
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

                                {/* Navigate to the new pages — visual remains identical */}
                                <Link to="/analytics" className="block">
                                    <button className="w-full justify-start inline-flex items-center px-4 py-3 rounded-xl border border-neutral-300 text-neutral-800 font-semibold bg-white hover:bg-neutral-50 transition duration-200">
                                        <TrendingUp className="mr-2 w-4 h-4" />
                                        View Analytics
                                    </button>
                                </Link>
                                <Link to="/insights" className="block">
                                    <button className="w-full justify-start inline-flex items-center px-4 py-3 rounded-xl border border-neutral-300 text-neutral-800 font-semibold bg-white hover:bg-neutral-50 transition duration-200">
                                        <Activity className="mr-2 w-4 h-4" />
                                        Export Insights
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

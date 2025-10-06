import * as React from "react";
import {
    Button as FButton,
    Text,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Caption1,
    Slider
} from "@fluentui/react-components";
import { Settings as SettingsIcon, Mic, MicOff, Volume2, MessageSquare } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { DEFAULT_PERSONAS, Persona, getCustomPersonas } from "../personas/personas";
// import { chatApi } from "../../api"; // (optional) wire up your backend like in Chat

type Message = { role: "user" | "assistant"; content: string };

const EMOJI_DEFAULT = "🤖";

/* ---------------- Persona persistence helpers (match Chat.tsx) ---------------- */
const LAST_PERSONA_ID_KEY = "last_persona_id";
const LAST_PERSONA_KEY = "last_persona_json";

function getAllPersonas(): Persona[] {
    const custom = getCustomPersonas?.() ?? [];
    const customIds = new Set(custom.map(p => p.id));
    const defaults = (DEFAULT_PERSONAS ?? []).filter(p => !customIds.has(p.id));
    return [...custom, ...defaults];
}
function resolvePersonaById(id: string | null | undefined): Persona | null {
    if (!id) return null;
    return getAllPersonas().find(p => p.id === id) ?? null;
}

/* --------------------------- Browser speech helpers -------------------------- */
const hasSTT = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

function getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis?.getVoices?.() ?? [];
}

function speak(text: string, voice?: SpeechSynthesisVoice, rate = 1, pitch = 1) {
    if (!("speechSynthesis" in window) || !text?.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    window.speechSynthesis.speak(u);
}

// Prefer a tiny curated set of English voices (2–4) so UI stays simple.
function pickTopEnglishVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
    const english = all.filter(v => (v.lang || "").toLowerCase().startsWith("en"));
    const preferredNames = [
        "Microsoft Aria Online",
        "Microsoft Guy Online",
        "Google US English",
        "Google UK English Female",
        "Google UK English Male",
        "Samantha",
        "Daniel"
    ];
    const preferred: SpeechSynthesisVoice[] = [];
    for (const name of preferredNames) {
        const found = english.find(v => v.name.includes(name));
        if (found && !preferred.some(v => v.voiceURI === found.voiceURI)) preferred.push(found);
    }
    for (const v of english) {
        if (preferred.length >= 4) break;
        if (!preferred.some(p => p.voiceURI === v.voiceURI)) preferred.push(v);
    }
    return preferred.slice(0, 4);
}

export default function Voice() {
    /* ------------------------------ Personas state ------------------------------ */
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const [activePersona, setActivePersona] = React.useState<Persona | null>(null);

    // Hydrate persona selection (same logic as Chat.tsx)
    React.useEffect(() => {
        let id = searchParams.get("persona");

        if (!id) {
            const statePersona = (location.state as any)?.personaId as string | undefined;
            if (statePersona) {
                id = statePersona;
                const next = new URLSearchParams(searchParams);
                next.set("persona", statePersona);
                setSearchParams(next);
            }
        }
        if (!id) {
            const last = localStorage.getItem(LAST_PERSONA_ID_KEY) || undefined;
            if (last) {
                id = last;
                const next = new URLSearchParams(searchParams);
                next.set("persona", last);
                setSearchParams(next);
            }
        }

        if (!id) {
            setActivePersona(null);
            return;
        }

        let p = resolvePersonaById(id);
        if (!p) {
            try {
                const snapRaw = localStorage.getItem(LAST_PERSONA_KEY);
                if (snapRaw) {
                    const snap = JSON.parse(snapRaw);
                    p = resolvePersonaById(snap?.id) ?? null;
                }
            } catch {
                /* noop */
            }
        }
        if (!p) {
            const next = new URLSearchParams(searchParams);
            next.delete("persona");
            setSearchParams(next);
            return;
        }

        setActivePersona(p);

        // Persist selection so it always carries over across pages
        try {
            localStorage.setItem(LAST_PERSONA_ID_KEY, p.id);
            localStorage.setItem(
                LAST_PERSONA_KEY,
                JSON.stringify({
                    id: p.id,
                    name: p.name,
                    icon: p.icon,
                    ageRange: p.ageRange,
                    vertical: p.vertical,
                    isDefault: !!p.isDefault
                })
            );
        } catch {
            /* noop */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, setSearchParams, location.search, location.state]);

    const clearActivePersona = () => {
        const next = new URLSearchParams(searchParams);
        next.delete("persona");
        setSearchParams(next);
        try {
            localStorage.removeItem(LAST_PERSONA_ID_KEY);
            localStorage.removeItem(LAST_PERSONA_KEY);
        } catch {
            /* noop */
        }
        setActivePersona(null);
    };

    // Keep the select dropdown in sync with URL (when present)
    const allPersonas = React.useMemo<Persona[]>(() => getAllPersonas(), []);
    const currentPersonaId = activePersona?.id ?? "";

    /* --------------------------------- Messages -------------------------------- */
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [partialTranscript, setPartialTranscript] = React.useState("");
    const [isMicOn, setIsMicOn] = React.useState(false);

    /* ---------------------------------- Voices --------------------------------- */
    const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [simpleVoices, setSimpleVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [voiceUri, setVoiceUri] = React.useState<string>("");
    const selectedVoice = React.useMemo(() => voices.find(v => v.voiceURI === voiceUri) ?? undefined, [voices, voiceUri]);

    // Load voices (async in many browsers)
    React.useEffect(() => {
        const load = () => {
            const all = getVoices();
            setVoices(all);
            const curated = pickTopEnglishVoices(all);
            setSimpleVoices(curated);
            if (!voiceUri && all.length) {
                const first = curated[0] ?? all[0];
                if (first) setVoiceUri(first.voiceURI);
            }
        };
        load();
        if ("speechSynthesis" in window) {
            window.speechSynthesis.onvoiceschanged = load;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voiceUri]);

    // Auto-speak assistant replies
    React.useEffect(() => {
        const last = messages[messages.length - 1];
        if (last?.role === "assistant" && last.content) {
            speak(last.content, selectedVoice, 1, 1);
        }
    }, [messages, selectedVoice]);

    // Send via existing chat logic (plug your chatApi here)
    const handleSend = async (text: string) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, { role: "user", content: text }]);

        // >>> REUSE YOUR BACKEND CHAT CALL HERE (align with Chat.tsx) <<<
        // const res = await chatApi(request, shouldStream, token);
        // const replyText = res.message?.content ?? "";

        const replyText = `${activePersona?.icon || EMOJI_DEFAULT} ${activePersona?.name || "Persona"}: ${text}`; // placeholder
        setMessages(prev => [...prev, { role: "assistant", content: replyText }]);
    };

    /* ----------------------------------- Mic ----------------------------------- */
    const toggleMic = async () => {
        if (!hasSTT) return;
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            return;
        }
        const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const rec = new SR();

        // Use browser language as default (no persona.language field on type)
        const defaultLang = (navigator.language || "en-US").toString();
        rec.lang = defaultLang;
        rec.continuous = false;
        rec.interimResults = true;

        if (isMicOn) {
            rec.stop();
            setIsMicOn(false);
            return;
        }

        setPartialTranscript("");
        setIsMicOn(true);

        rec.onresult = (ev: any) => {
            let txt = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
            setPartialTranscript(txt);
        };
        rec.onerror = () => setIsMicOn(false);
        rec.onend = () => {
            setIsMicOn(false);
            const finalText = partialTranscript.trim();
            if (finalText) {
                handleSend(finalText);
                setPartialTranscript("");
            }
        };
        rec.start();
    };

    // Simple header badge using same emoji feel as Personas/Chat
    const headerEmoji = activePersona?.icon || EMOJI_DEFAULT;

    return (
        <div className="pt-20 min-h-screen">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Persona header (mirrors Chat.tsx) */}
                {activePersona && (
                    <div className="mt-0 mb-6 rounded-2xl border bg-card shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-neutral-200 grid place-items-center text-2xl">{headerEmoji}</div>
                                <div>
                                    <h2 className="text-lg font-semibold">Voice with {activePersona.name}</h2>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {(activePersona.tags ?? []).slice(0, 3).map((t, i) => (
                                            <span key={i} className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link to="/personas" state={{ from: "voice", personaId: activePersona.id }}>
                                    <button className="h-9 px-3 rounded-md border bg-background hover:bg-muted transition-smooth">Switch Persona</button>
                                </Link>
                                <button onClick={clearActivePersona} className="h-9 px-3 rounded-md border bg-background hover:bg-muted transition-smooth">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top row: Title + Persona picker + Settings */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {!activePersona && <div className="w-12 h-12 rounded-full bg-neutral-200 grid place-items-center text-2xl">{headerEmoji}</div>}
                        <div>
                            <h1 className="text-2xl font-semibold leading-tight">Voice</h1>
                            <p className="text-sm text-muted-foreground">Speak with a persona. See transcription and replies.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Persona picker that also updates the URL ?persona= */}
                        <select
                            className="border rounded-xl px-3 py-2"
                            value={currentPersonaId}
                            onChange={e => {
                                const id = e.target.value;
                                const next = new URLSearchParams(searchParams);
                                if (id) next.set("persona", id);
                                else next.delete("persona");
                                setSearchParams(next);
                            }}
                        >
                            <option value="">Select persona…</option>
                            {allPersonas.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.icon || EMOJI_DEFAULT} {p.name}
                                </option>
                            ))}
                        </select>

                        {/* Settings (rate/pitch dialog) */}
                        <Dialog>
                            <DialogTrigger disableButtonEnhancement>
                                <FButton appearance="secondary" icon={<SettingsIcon className="w-4 h-4" />}>
                                    Settings
                                </FButton>
                            </DialogTrigger>
                            <DialogSurface>
                                <DialogBody>
                                    <DialogTitle>Voice Settings</DialogTitle>
                                    <DialogContent className="grid gap-4">
                                        <div className="grid gap-1">
                                            <Caption1>Voice</Caption1>
                                            <select className="border rounded-xl px-3 py-2" value={voiceUri} onChange={e => setVoiceUri(e.target.value)}>
                                                {simpleVoices.map(v => (
                                                    <option key={v.voiceURI} value={v.voiceURI}>
                                                        {v.name} ({v.lang}){v.localService ? "" : " • cloud"}
                                                    </option>
                                                ))}
                                            </select>
                                            <Text size={200} className="text-muted-foreground">
                                                We show a few popular English voices here for simplicity.
                                            </Text>
                                        </div>

                                        <div>
                                            <Caption1>Rate</Caption1>
                                            <Slider
                                                value={1}
                                                min={0.5}
                                                max={2}
                                                step={0.1}
                                                onChange={(_, data) => {
                                                    const v = Number(data.value);
                                                    // speak next messages with this rate: keep in state if you want dynamic preview
                                                    // We keep the speak() call using default 1 for stability; adjust if you add live preview.
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Caption1>Pitch</Caption1>
                                            <Slider
                                                value={1}
                                                min={0}
                                                max={2}
                                                step={0.1}
                                                onChange={(_, data) => {
                                                    const v = Number(data.value);
                                                    // similar note as rate
                                                }}
                                            />
                                        </div>
                                    </DialogContent>
                                    <DialogActions>
                                        <FButton appearance="secondary">Close</FButton>
                                    </DialogActions>
                                </DialogBody>
                            </DialogSurface>
                        </Dialog>
                    </div>
                </div>

                {/* Center “session” area: big mic + mute */}
                <div className="rounded-2xl bg-neutral-900 text-white min-h-[260px] grid place-items-center relative mb-6">
                    <div className="absolute top-3 right-3 opacity-70">
                        <Volume2 />
                    </div>
                    <div className="flex flex-col items-center gap-6 py-12">
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-200 to-blue-500 shadow-lg" />
                        <div className="flex items-center gap-4">
                            <FButton
                                appearance="primary"
                                onClick={toggleMic}
                                icon={isMicOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                className="!rounded-full !h-12 !w-12 !p-0"
                                title={hasSTT ? "Toggle microphone" : "Speech input not supported in this browser"}
                                disabled={!hasSTT}
                            />
                            <FButton
                                appearance="secondary"
                                onClick={() => window.speechSynthesis?.cancel?.()}
                                className="!rounded-full !h-12 !w-12 !p-0"
                                title="Mute"
                            >
                                <span className="sr-only">Mute</span>🔇
                            </FButton>
                        </div>
                    </div>
                </div>

                {/* Transcript panel */}
                <div className="grid gap-3 mb-6">
                    {isMicOn && !!partialTranscript && (
                        <div className="rounded-xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground mb-1">You said</p>
                            <p className="text-base">🎙 {partialTranscript}</p>
                        </div>
                    )}
                    {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                        <div className="rounded-xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground mb-1">Persona replied</p>
                            <p className="text-base">{messages[messages.length - 1].content}</p>
                        </div>
                    )}
                </div>

                {/* History list */}
                <div className="rounded-2xl border bg-white p-4 space-y-3">
                    {messages.map((m, i) => (
                        <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${m.role === "user" ? "bg-blue-100" : "bg-neutral-100"}`}>
                                {m.role === "assistant" ? activePersona?.icon || EMOJI_DEFAULT : "🗣️"}
                                <span>{m.content}</span>
                            </span>
                        </div>
                    ))}
                    {messages.length === 0 && <div className="text-center text-sm text-muted-foreground">No messages yet. Tap the mic and start speaking.</div>}
                </div>

                {/* Text input fallback */}
                <form
                    className="flex items-center gap-2 mt-4"
                    onSubmit={e => {
                        e.preventDefault();
                        const input = e.currentTarget.querySelector('input[name="q"]') as HTMLInputElement;
                        const text = input?.value || "";
                        input.value = "";
                        handleSend(text);
                    }}
                >
                    <input name="q" className="flex-1 border rounded-xl px-3 py-2" placeholder={`Message ${activePersona?.name || "persona"}…`} />
                    <FButton appearance="primary" icon={<MessageSquare className="w-4 h-4" />}>
                        Send
                    </FButton>
                </form>
            </div>
        </div>
    );
}

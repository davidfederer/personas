// app/frontend/src/pages/personas/PersonasPage.tsx
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { DisclaimerFooter } from "../../components/DisclaimerFooter";

import {
    Button as FButton,
    Caption1,
    Text,
    Input,
    Textarea,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Spinner
} from "@fluentui/react-components";

// Lucide icons
import { MessageSquare, Users, Info, Wand2, Save, Edit3, Laptop, Heart, Briefcase, ShoppingCart, Trash2 } from "lucide-react";

// Personas (defaults) + types + CENTRALIZED persistence
import {
    DEFAULT_PERSONAS,
    Persona,
    getCustomPersonas, // NEW: read customs from personas.ts
    saveCustomPersonas, // NEW: bulk-save customs
    upsertPersona, // NEW: create/update a single persona by id
    deletePersonaById // NEW: delete by id
} from "./personas";

// Auth + API (reused for AI persona generation)
import { useLogin, getToken } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { chatApi, ChatAppRequest, ChatAppResponseOrError, ChatAppResponse, RetrievalMode } from "../../api";

/* -------------------------------------------------------------------------- */
/*                           Cross-page small persisted                        */
/* -------------------------------------------------------------------------- */
// Keep these (selection for Chat/Voice restore, etc.)
const LAST_PERSONA_ID_KEY = "last_persona_id";
const LAST_PERSONA_KEY = "last_persona_json";

/* ---------------------- Lightweight “logs.log” store ---------------------- */
type UsageRecord = { chats: number; lastUsed: number };
type UsageIndex = Record<string, UsageRecord>;

const USAGE_KEY = "logs.log";

function loadUsage(): UsageIndex {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        return raw ? (JSON.parse(raw) as UsageIndex) : {};
    } catch {
        return {};
    }
}
function saveUsage(ix: UsageIndex) {
    try {
        localStorage.setItem(USAGE_KEY, JSON.stringify(ix));
    } catch {
        // ignore quota errors
    }
}
function bumpUsage(personaId: string) {
    const ix = loadUsage();
    const prev = ix[personaId] ?? { chats: 0, lastUsed: 0 };
    ix[personaId] = { chats: prev.chats + 1, lastUsed: Date.now() };
    saveUsage(ix);
}
function getUsage(personaId: string): UsageRecord {
    const ix = loadUsage();
    return ix[personaId] ?? { chats: 0, lastUsed: 0 };
}

/** Friendly "X ago" for a given timestamp (ms) using Intl.RelativeTimeFormat */
function formatAgo(ts: number): string {
    if (!ts) return "—";
    const now = Date.now();
    let diff = Math.round((ts - now) / 1000); // seconds (negative for past)
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    const units: Array<["year" | "month" | "week" | "day" | "hour" | "minute" | "second", number]> = [
        ["year", 60 * 60 * 24 * 365],
        ["month", 60 * 60 * 24 * 30],
        ["week", 60 * 60 * 24 * 7],
        ["day", 60 * 60 * 24],
        ["hour", 60 * 60],
        ["minute", 60],
        ["second", 1]
    ];

    for (const [unit, secondsInUnit] of units) {
        const amt = Math.trunc(diff / secondsInUnit);
        if (amt !== 0) return rtf.format(amt, unit);
    }
    return rtf.format(0, "second");
}

/* -------------------------------------------------------------------------- */
/*                          Image loading (for defaults)                       */
/* -------------------------------------------------------------------------- */
const personaImages = import.meta.glob("./images/*.{png,jpg,jpeg,webp,svg}", {
    eager: true,
    as: "url"
}) as Record<string, string>;

/* ---------------------- Image loading (for CUSTOMS) ----------------------- */
/** Load any files placed under personas/images/custom */
const customPersonaImages = import.meta.glob("./images/custom/*.{png,jpg,jpeg,webp,svg}", {
    eager: true,
    as: "url"
}) as Record<string, string>;

/** Map seeded custom persona IDs -> provided filenames */
const CUSTOM_ID_TO_FILENAME: Record<string, string> = {
    // 0–5
    "p-parent-0-5-frequent": "0-5; Frequent Shopper.png",
    "p-parent-0-5-regular": "0-5; Regular Shopper.png",
    "p-parent-0-5-occasional": "0-5; Occasional:Rare Shopper.png",
    // 6–13
    "p-parent-6-13-frequent": "6-13; Frequent Shopper.png",
    "p-parent-6-13-regular": "6-13; Regular Shopper.png",
    "p-parent-6-13-occasional": "6-13; Occasional:Rare Shopper.png"
};

/** Default ID -> filename (already in ./images) */
const DEFAULT_ID_TO_FILENAME: Record<string, string> = {
    "p-budget-parent": "budget-parent.png",
    "p-plus-size-fashionista": "plus-size-fashionista.png",
    "p-sporty-family": "sporty-family.png",
    "p-sustainable-shopper": "sustainable-shopper.png",
    "p-urban-pro-budget": "urban-pro-budget.png",
    "p-retiree-style": "retiree-style.png",
    "p-teen-trend": "teen-trend.png",
    "p-expecting-mum": "expecting-mum.png",
    "p-new-home-budgeter": "new-home-budgeter.png",
    "p-grandparent-gifts": "grandparent-gifts.png",
    "p-young-professional": "young-professional.png"
};

function getImageUrlByFile(fileName: string | undefined): string | undefined {
    if (!fileName) return undefined;
    for (const [path, url] of Object.entries(personaImages)) {
        const base = path.split("/").pop()!;
        if (base === fileName) return url;
    }
    return undefined;
}

function getCustomImageUrlByFile(fileName: string | undefined): string | undefined {
    if (!fileName) return undefined;
    for (const [path, url] of Object.entries(customPersonaImages)) {
        const base = path.split("/").pop()!;
        if (base === fileName) return url;
    }
    return undefined;
}

/** Decide which visual to show for a persona */
function getPreviewVisual(p: Persona): { type: "image" | "emoji"; url?: string; emoji?: string } {
    // Defaults -> use ./images mapping
    if (p.isDefault) {
        const file = DEFAULT_ID_TO_FILENAME[p.id];
        const url = getImageUrlByFile(file);
        if (url) return { type: "image", url };
        return { type: "emoji", emoji: p.icon ?? "🧩" };
    }

    // Customs -> try explicit custom image match first
    const customFile = CUSTOM_ID_TO_FILENAME[p.id];
    const customUrl = getCustomImageUrlByFile(customFile);
    if (customUrl) return { type: "image", url: customUrl };

    // Otherwise fall back to emoji/icon
    return { type: "emoji", emoji: p.icon ?? "🤖" };
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */
function slugify(s: string) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
}
function nowTs() {
    return Date.now();
}

/* -------------------------------------------------------------------------- */
/*                           Create Persona (Dialog)                           */
/* -------------------------------------------------------------------------- */
type DraftPersona = {
    name: string;
    summary: string;
    description: string;
    tags: string;
    vertical?: string;
    ageRange?: string;
    icon?: string;
    examples?: string;
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
};

const BRAND_BTN = "!bg-[#31343f] !text-white !rounded-xl !h-11 !px-4 hover:!opacity-90 focus:!outline-none focus:!ring-2 focus:!ring-[#31343f]/40";

// Rounded secondary (outline) like dashboard
const SECONDARY_BTN = "!bg-white !text-neutral-800 !rounded-xl !h-11 !px-4 !border !border-neutral-300 hover:!bg-neutral-50";

// Small circular icon button (top-right actions)
const ICON_BTN = "!rounded-full !w-9 !h-9 !p-0 !min-w-0 !border !border-neutral-200 hover:!bg-neutral-100";

// Larger circular icon button for Voice — ensure true circle (no oval)
const ICON_BTN_LG = "!rounded-full !w-12 !h-12 !p-0 !min-w-0 !leading-none !items-center !justify-center !border !border-neutral-200 hover:!bg-neutral-100";

/* ------------------------------ Create Dialog ------------------------------ */
const CreatePersonaDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (persona: Persona) => void;
}> = ({ open, onOpenChange, onCreated }) => {
    const [brief, setBrief] = React.useState<string>("");
    const [draft, setDraft] = React.useState<DraftPersona>({
        name: "",
        summary: "",
        description: "",
        tags: "",
        vertical: "Retail",
        ageRange: "",
        icon: "🤖", // default robot emoji
        examples: "",
        promptTemplatePrefix: "",
        promptTemplateSuffix: ""
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const client = useLogin ? useMsal().instance : undefined;
    const handleField = (key: keyof DraftPersona, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

    const toPersona = (d: DraftPersona): Persona => {
        const idBase = slugify(d.name || "custom-persona");
        const id = `p-${idBase}-${Math.floor(Math.random() * 1e6).toString(36)}`;
        const tags = (d.tags || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);
        const examples = (d.examples || "")
            .split("\n")
            .map(e => e.trim())
            .filter(Boolean);
        const ts = nowTs();
        return {
            id,
            name: d.name || "Custom Persona",
            summary: d.summary || d.description.slice(0, 120),
            description: d.description || d.summary,
            tags,
            vertical: d.vertical || "Retail",
            ageRange: d.ageRange || "—",
            icon: (d.icon && d.icon.trim()) || "🤖", // default robot emoji
            examples,
            promptTemplatePrefix: d.promptTemplatePrefix?.trim() || undefined,
            promptTemplateSuffix: d.promptTemplateSuffix?.trim() || undefined,
            createdAt: ts,
            updatedAt: ts,
            isDefault: false
        };
    };

    const handleSave = () => {
        setError(null);
        const persona = toPersona(draft);
        if (!persona.name || !persona.summary || !persona.description) {
            setError("Please provide at least a name, summary and description.");
            return;
        }
        onCreated(persona);
        onOpenChange(false);
        setTimeout(() => {
            setBrief("");
            setDraft({
                name: "",
                summary: "",
                description: "",
                tags: "",
                vertical: "Retail",
                ageRange: "",
                icon: "🤖", // reset default to robot
                examples: "",
                promptTemplatePrefix: "",
                promptTemplateSuffix: ""
            });
            setError(null);
        }, 0);
    };

    const generateWithAI = async () => {
        setError(null);
        if (!brief.trim()) {
            setError("Add a short brief first (e.g., audience, goals, constraints).");
            return;
        }
        setLoading(true);
        try {
            const responseSpec = JSON.stringify({
                type: "object",
                properties: {
                    name: { type: "string" },
                    summary: { type: "string" },
                    description: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                    vertical: { type: "string" },
                    ageRange: { type: "string" },
                    icon: { type: "string" },
                    examples: { type: "array", items: { type: "string" } },
                    promptTemplatePrefix: { type: "string" },
                    promptTemplateSuffix: { type: "string" }
                },
                required: ["name", "summary", "description", "tags"]
            });

            const sys =
                "You are an assistant that creates high-quality customer personas for a retail shopping assistant. " +
                "Return ONLY valid JSON matching the provided JSON Schema. Do not include markdown. Keep fields concise, practical, and directly useful for prompting.";

            const user =
                `Brief:\n${brief}\n\n` +
                "Target format: a persona JSON object with realistic examples and a solid promptTemplatePrefix/promptTemplateSuffix that would prime the model to role-play as this customer.\n\n" +
                `JSON Schema:\n${responseSpec}`;

            const messages: ChatAppRequest["messages"] = [
                { role: "system", content: sys },
                { role: "user", content: user }
            ];

            const token = client ? await getToken(client) : undefined;

            const overrides = {
                prompt_template: undefined,
                include_category: undefined,
                exclude_category: undefined,
                top: 3,
                max_subqueries: 3,
                results_merge_strategy: "interleaved",
                temperature: 0.2,
                minimum_reranker_score: 0,
                minimum_search_score: 0,
                retrieval_mode: RetrievalMode.Text,
                semantic_ranker: false,
                semantic_captions: false,
                query_rewriting: false,
                reasoning_effort: "",
                suggest_followup_questions: true,
                use_oid_security_filter: false,
                use_groups_security_filter: false,
                search_text_embeddings: true,
                search_image_embeddings: false,
                send_text_sources: false,
                send_image_sources: false,
                language: "en",
                use_agentic_retrieval: false
            };

            const res = await chatApi({ messages, context: { overrides }, session_state: null }, false, token);
            if (!res.ok || !res.body) throw new Error(`Request failed with status ${res.status}`);

            const data = (await res.json()) as ChatAppResponseOrError;
            if ("error" in data && (data as any).error) throw new Error((data as any).error);

            const content = (data as ChatAppResponse).message?.content ?? "";
            let jsonText = content.trim();
            const firstBrace = jsonText.indexOf("{");
            const lastBrace = jsonText.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonText = jsonText.slice(firstBrace, lastBrace + 1);
            }
            const parsed = JSON.parse(jsonText) as Partial<Persona> & {
                tags?: string[];
                examples?: string[];
            };

            setDraft(prev => ({
                ...prev,
                name: parsed.name || prev.name,
                summary: parsed.summary || prev.summary,
                description: parsed.description || prev.description,
                tags: (parsed.tags ?? []).join(", "),
                vertical: parsed.vertical || prev.vertical,
                ageRange: parsed.ageRange || prev.ageRange,
                icon: parsed.icon || prev.icon || "🤖", // keep robot if not provided
                examples: (parsed.examples ?? []).join("\n"),
                promptTemplatePrefix: parsed.promptTemplatePrefix || prev.promptTemplatePrefix,
                promptTemplateSuffix: parsed.promptTemplateSuffix || prev.promptTemplateSuffix
            }));
        } catch (e: any) {
            setError(e?.message || "Failed to generate persona.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => onOpenChange(!!data.open)}>
            <DialogSurface aria-describedby="create-persona-desc">
                <DialogBody>
                    <DialogTitle>Create a Persona</DialogTitle>
                    <DialogContent className="grid gap-3">
                        <Text id="create-persona-desc" size={200}>
                            Write a short brief and let AI draft it — or fill the form manually. You can edit everything before saving.
                        </Text>

                        <div className="grid gap-2">
                            <Caption1>Brief (for AI)</Caption1>
                            <Textarea
                                placeholder="e.g., Parent with two kids in primary school in Australia, tight budget, prioritises durable uniforms and multi-packs."
                                value={brief}
                                onChange={(_, v) => setBrief(v.value)}
                                rows={4}
                            />
                            <div className="flex items-center gap-2">
                                <FButton appearance="primary" icon={<Wand2 size={16} />} onClick={generateWithAI} disabled={loading} className={BRAND_BTN}>
                                    {loading ? <Spinner size="extra-tiny" /> : "Generate with AI"}
                                </FButton>
                                {error && (
                                    <Text role="alert" style={{ color: "var(--colorPaletteRedForeground2)" }}>
                                        {error}
                                    </Text>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Caption1>Basics</Caption1>
                            <Input value={draft.name} onChange={(_, v) => handleField("name", v.value)} placeholder="Name" />
                            <Input value={draft.summary} onChange={(_, v) => handleField("summary", v.value)} placeholder="Summary" />
                            <Textarea value={draft.description} onChange={(_, v) => handleField("description", v.value)} placeholder="Description" rows={3} />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <Input value={draft.vertical} onChange={(_, v) => handleField("vertical", v.value)} placeholder="Vertical (e.g., Retail)" />
                            <Input value={draft.ageRange} onChange={(_, v) => handleField("ageRange", v.value)} placeholder="Age Range (e.g., 30–40)" />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <Input value={draft.icon} onChange={(_, v) => handleField("icon", v.value)} placeholder="Icon (emoji or text)" />
                            <Input value={draft.tags} onChange={(_, v) => handleField("tags", v.value)} placeholder="Tags (comma-separated)" />
                        </div>

                        <div className="grid gap-2">
                            <Caption1>Examples (one per line)</Caption1>
                            <Textarea
                                value={draft.examples}
                                onChange={(_, v) => handleField("examples", v.value)}
                                placeholder={"Example question 1...\nExample question 2..."}
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Caption1>Prompt Template (optional)</Caption1>
                            <Textarea
                                value={draft.promptTemplatePrefix}
                                onChange={(_, v) => handleField("promptTemplatePrefix", v.value)}
                                placeholder="promptTemplatePrefix"
                                rows={3}
                            />
                            <Textarea
                                value={draft.promptTemplateSuffix}
                                onChange={(_, v) => handleField("promptTemplateSuffix", v.value)}
                                placeholder="promptTemplateSuffix"
                                rows={3}
                            />
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <FButton appearance="secondary" className={SECONDARY_BTN}>
                                Cancel
                            </FButton>
                        </DialogTrigger>
                        <FButton appearance="primary" icon={<Save size={16} />} onClick={handleSave} className={BRAND_BTN}>
                            Save Persona
                        </FButton>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */
export default function PersonasPage() {
    const navigate = useNavigate();

    // Data (CENTRALIZED via personas.ts)
    const [custom, setCustom] = React.useState<Persona[]>(() => getCustomPersonas());
    const [defaults] = React.useState<Persona[]>(() => DEFAULT_PERSONAS);

    // Dialog state
    const [createOpen, setCreateOpen] = React.useState(false);
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [editOpen, setEditOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<Persona | null>(null);

    // Deletion
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<Persona | null>(null);

    // Edit draft state
    const emptyDraft: DraftPersona = {
        name: "",
        summary: "",
        description: "",
        tags: "",
        vertical: "Retail",
        ageRange: "",
        icon: "🤖", // default robot emoji in edit draft too
        examples: "",
        promptTemplatePrefix: "",
        promptTemplateSuffix: ""
    };
    const [editDraft, setEditDraft] = React.useState<DraftPersona>(emptyDraft);
    const [editError, setEditError] = React.useState<string | null>(null);
    const [editingFromDefault, setEditingFromDefault] = React.useState<Persona | null>(null); // source default being edited

    /* -------------------------- Stats (usage-backed) ------------------------- */
    const getStats = (personaId: string) => {
        const u = getUsage(personaId);
        return {
            conversations: u.chats || 0,
            insights: 0, // placeholder until you wire insights
            lastUsedTs: u.lastUsed
        };
    };

    const onPersonaCreated = (p: Persona) => {
        const ts = Date.now();
        const normalized: Persona = {
            ...p,
            isDefault: false,
            createdAt: p.createdAt || ts,
            updatedAt: ts
        };

        // Centralized write
        upsertPersona(normalized);

        // Local state update (prepend)
        const next = [normalized, ...custom];
        setCustom(next);

        // Optional: keep bulk store consistent if your helpers expect the full list
        saveCustomPersonas(next);
    };

    const toChatHref = (p: Persona, example?: string) => {
        const base = `/chat?persona=${encodeURIComponent(p.id)}`;
        return example ? `${base}&q=${encodeURIComponent(example)}` : base;
    };

    const toVoiceHref = (p: Persona) => `/voice?persona=${encodeURIComponent(p.id)}`;

    /** Persist selection so Chat/Voice can recover it + bump usage */
    const persistSelection = (p: Persona) => {
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
            // ignore
        }
        bumpUsage(p.id);
    };

    const onChatClick = (p: Persona) => {
        persistSelection(p);
    };

    const onVoiceClick = (p: Persona) => {
        persistSelection(p);
    };

    const openDetails = (p: Persona) => {
        setSelected(p);
        setDetailsOpen(true);
    };

    const personaToDraft = (p: Persona): DraftPersona => ({
        name: p.name ?? "",
        summary: p.summary ?? "",
        description: p.description ?? "",
        tags: (p.tags ?? []).join(", "),
        vertical: p.vertical ?? "Retail",
        ageRange: p.ageRange ?? "",
        icon: p.icon ?? "🤖", // when loading into form, show robot if missing
        examples: (p.examples ?? []).join("\n"),
        promptTemplatePrefix: p.promptTemplatePrefix ?? "",
        promptTemplateSuffix: p.promptTemplateSuffix ?? ""
    });

    // IMPORTANT: do not create a copy on open; create on save if source is default
    const openEdit = (p: Persona) => {
        setSelected(p);
        setEditDraft(personaToDraft(p));
        setEditError(null);
        setEditingFromDefault(p.isDefault ? p : null);
        setEditOpen(true);
    };

    const createCopyFromDefault = (source: Persona, draft: DraftPersona): Persona => {
        const idBase = slugify(draft.name || source.name || "persona");
        const id = `p-${idBase}-${Math.floor(Math.random() * 1e6).toString(36)}`;
        const tags = (draft.tags || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);
        const examples = (draft.examples || "")
            .split("\n")
            .map(e => e.trim())
            .filter(Boolean);
        const ts = Date.now();
        return {
            ...source,
            id,
            isDefault: false,
            name: draft.name || source.name,
            summary: draft.summary || source.summary,
            description: draft.description || source.description,
            vertical: draft.vertical || source.vertical,
            ageRange: draft.ageRange || source.ageRange,
            // default robot emoji for copies unless user typed a custom icon
            icon: (draft.icon && draft.icon.trim()) || "🤖",
            tags,
            examples,
            promptTemplatePrefix: draft.promptTemplatePrefix?.trim() || undefined,
            promptTemplateSuffix: draft.promptTemplateSuffix?.trim() || undefined,
            createdAt: ts,
            updatedAt: ts
        };
    };

    const saveEdit = () => {
        if (!selected) return;
        if (!editDraft.name || !editDraft.summary || !editDraft.description) {
            setEditError("Please provide at least a name, summary and description.");
            return;
        }

        // Editing a default persona: create a copy on save (not on open)
        if (editingFromDefault) {
            const copy = createCopyFromDefault(editingFromDefault, editDraft);

            // Persist centrally
            upsertPersona(copy);

            // Update local state
            const next = [copy, ...custom];
            setCustom(next);
            saveCustomPersonas(next);

            setSelected(copy);
            setEditingFromDefault(null);
            setEditOpen(false);
            return;
        }

        // Editing a custom persona
        const tags = (editDraft.tags || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);
        const examples = (editDraft.examples || "")
            .split("\n")
            .map(e => e.trim())
            .filter(Boolean);
        const updated: Persona = {
            ...selected,
            name: editDraft.name || selected.name,
            summary: editDraft.summary || selected.summary,
            description: editDraft.description || selected.description,
            tags,
            vertical: editDraft.vertical || selected.vertical,
            ageRange: editDraft.ageRange || selected.ageRange,
            // keep user-provided icon; if blank, default to 🤖
            icon: (editDraft.icon && editDraft.icon.trim()) || selected.icon || "🤖",
            examples,
            promptTemplatePrefix: editDraft.promptTemplatePrefix?.trim() || undefined,
            promptTemplateSuffix: editDraft.promptTemplateSuffix?.trim() || undefined,
            updatedAt: Date.now(),
            isDefault: false
        };

        // Persist centrally
        upsertPersona(updated);

        // Update local state (replace by id)
        const next = [updated, ...custom.filter(p => p.id !== updated.id)];
        setCustom(next);
        saveCustomPersonas(next);

        setSelected(updated);
        setEditOpen(false);
    };

    const handleDelete = (p: Persona) => {
        if (p.isDefault) return; // safeguard
        setDeleteTarget(p);
        setDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;

        // Persist centrally
        deletePersonaById(deleteTarget.id);

        // Update local state
        const next = custom.filter(p => p.id !== deleteTarget.id);
        setCustom(next);
        saveCustomPersonas(next);

        if (selected?.id === deleteTarget.id) {
            setSelected(null);
            setDetailsOpen(false);
        }
        setDeleteTarget(null);
        setDeleteOpen(false);
    };

    /* ------------------------------ UI helpers ------------------------------ */

    // Optional icon suggestion if no image + non-emoji icon
    const iconFor = (p: Persona) => {
        if (p.icon && /[\p{Emoji}\uFE0F]/u.test(p.icon)) return null; // emoji already displayed
        const v = (p.vertical || "").toLowerCase();
        if (v.includes("tech")) return <Laptop className="w-6 h-6 text-[#31343f]" />;
        if (v.includes("b2b")) return <Briefcase className="w-6 h-6 text-[#31343f]" />;
        if (v.includes("e-") || v.includes("commerce")) return <ShoppingCart className="w-6 h-6 text-[#31343f]" />;
        return <Heart className="w-6 h-6 text-[#31343f]" />;
    };

    // Shared image frame (consistent alignment)
    const ImageFrame: React.FC<{
        visual: ReturnType<typeof getPreviewVisual>;
        alt: string;
    }> = ({ visual, alt }) => (
        <div className="w-[64px] h-[64px] rounded-xl bg-white shadow-sm grid place-items-center overflow-hidden shrink-0">
            {visual.type === "image" ? (
                <img src={visual.url} alt={alt} className="max-w-full max-h-full object-contain" />
            ) : visual.emoji ? (
                <span className="text-2xl">{visual.emoji}</span>
            ) : (
                iconFor({} as any)
            )}
        </div>
    );

    // Pill style used for both examples and traits
    const pillClass = "text-xs rounded-full border px-2 py-1 hover:bg-muted transition-colors";

    /* -------------------------------- RENDER -------------------------------- */

    const sectionTitle = (title: string) => (
        <div className="mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
        </div>
    );

    const PersonaCard: React.FC<{ p: Persona }> = ({ p }) => {
        const stats = getStats(p.id);
        const visual = getPreviewVisual(p);

        return (
            <div className="group rounded-2xl border bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
                {/* Card header */}
                <div className="p-5 pb-3 relative">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <ImageFrame visual={visual} alt={`${p.name} avatar`} />
                            <div className="flex-1 min-w-0">
                                <h3 className="mt-1.5 text-lg font-semibold leading-tight break-normal whitespace-normal">
                                    {p.name}
                                </h3>
                            </div>
                        </div>

                        {/* Top-right actions: (Delete if custom) + Details icon */}
                        <div className="flex items-center gap-2 ml-3">
                            {!p.isDefault && (
                                <FButton
                                    size="small"
                                    appearance="subtle"
                                    aria-label="Delete persona"
                                    icon={<Trash2 className="w-4 h-4" />}
                                    onClick={() => handleDelete(p)}
                                    className={ICON_BTN}
                                />
                            )}
                            <FButton
                                size="small"
                                appearance="subtle"
                                aria-label="View details"
                                icon={<Info className="w-4 h-4" />}
                                onClick={() => openDetails(p)}
                                className={ICON_BTN}
                            />
                        </div>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2 break-normal whitespace-normal">{p.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Age: {p.ageRange ?? "—"}</p>
                </div>

                {/* Card body */}
                <div className="p-4 pt-3 flex flex-col h-full">
                    <div className="flex-1 space-y-4">
                        {/* Traits */}
                        {p.tags && p.tags.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">Key Traits</p>
                                <div className="flex flex-wrap gap-2">
                                    {(p.tags ?? []).slice(0, 4).map((t, i) => (
                                        <span key={i} className={pillClass}>
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Examples */}
                        {p.examples && p.examples.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">Try an example</p>
                                <div className="flex flex-wrap gap-2">
                                    {p.examples.slice(0, 2).map((ex, i) => (
                                        <Link
                                            key={i}
                                            to={toChatHref(p, ex)}
                                            state={{ personaId: p.id }}
                                            onClick={() => onChatClick(p)}
                                            className={pillClass}
                                        >
                                            {ex}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-8 text-sm">
                            <div>
                                <p className="font-medium">{stats.conversations}</p>
                                <p className="text-muted-foreground">Conversations</p>
                            </div>
                            <div>
                                <p className="font-medium">{stats.insights}</p>
                                <p className="text-muted-foreground">Insights</p>
                            </div>
                        </div>

                        {/* Last used (small, unobtrusive) */}
                        <div className="text-xs text-muted-foreground">
                            Last used: {stats.lastUsedTs ? formatAgo(stats.lastUsedTs) : "—"}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 items-center">
                        <Link
                            to={toChatHref(p)}
                            state={{ personaId: p.id }}
                            onClick={() => onChatClick(p)}
                            className="flex-1"
                        >
                            <FButton
                                appearance="primary"
                                icon={<MessageSquare className="w-4 h-4" />}
                                className={`w-full ${BRAND_BTN}`}
                            >
                                Chat
                            </FButton>
                        </Link>
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="pt-20 min-h-screen">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Customer Personas</h1>
                        <p className="text-muted-foreground">Interact with AI-powered customer personas based on real user scenarios</p>
                    </div>

                    <DialogTrigger>
                        <FButton
                            appearance="primary"
                            size="large"
                            onClick={() => setCreateOpen(true)}
                            icon={<Users className="w-4 h-4" />}
                            className={BRAND_BTN}
                        >
                            Create New Persona
                        </FButton>
                    </DialogTrigger>
                    <CreatePersonaDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onPersonaCreated} />
                </div>

                {/* Your personas (custom) */}
                {custom.length > 0 && (
                    <>
                        {sectionTitle("Your personas")}
                        {/* Three-up layout at large sizes while keeping text breathable */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mb-10">
                            {custom.map(p => (
                                <PersonaCard key={p.id} p={p} />
                            ))}
                        </div>
                    </>
                )}

                {/* Default / Starter personas */}
                {sectionTitle("Starter personas")}
                {/* Three-up layout at large sizes while keeping text breathable */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                    {defaults.map(p => (
                        <PersonaCard key={p.id} p={p} />
                    ))}
                </div>
                <DisclaimerFooter />
            </div>

            {/* ---------------------- Delete Confirmation ---------------------- */}
            <Dialog open={deleteOpen} onOpenChange={(_, d) => setDeleteOpen(!!d.open)}>
                <DialogSurface aria-describedby="delete-persona-desc">
                    <DialogBody>
                        <DialogTitle>Delete persona</DialogTitle>
                        <DialogContent className="grid gap-3">
                            <Text id="delete-persona-desc" size={200}>
                                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                            </Text>
                        </DialogContent>
                        <DialogActions>
                            <FButton appearance="secondary" className={SECONDARY_BTN} onClick={() => setDeleteOpen(false)}>
                                Cancel
                            </FButton>
                            <FButton
                                appearance="primary"
                                onClick={confirmDelete}
                                className="!bg-red-600 !text-white !rounded-xl !h-11 !px-4 hover:!bg-red-700"
                                icon={<Trash2 className="w-4 h-4" />}
                            >
                                Delete
                            </FButton>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* ---------------------- Details Dialog ---------------------- */}
            <Dialog open={detailsOpen} onOpenChange={(_, d) => setDetailsOpen(!!d.open)}>
                <DialogSurface aria-describedby="persona-details-desc">
                    <DialogBody>
                        <DialogTitle>Persona Details</DialogTitle>
                        <DialogContent className="grid gap-4">
                            {selected ? (
                                <>
                                    <div className="flex items-center gap-3">
                                        <ImageFrame visual={getPreviewVisual(selected)} alt={`${selected.name} avatar`} />
                                        <div className="grid gap-1">
                                            <h4 className="m-0 text-base font-semibold">{selected.name}</h4>
                                            <div className="text-xs text-muted-foreground">
                                                {selected.isDefault ? "Default Persona" : "Custom Persona"} · Age: {selected.ageRange ?? "—"}
                                            </div>
                                        </div>
                                        {!selected.isDefault && (
                                            <div className="ml-auto">
                                                <FButton
                                                    appearance="subtle"
                                                    aria-label="Delete persona"
                                                    icon={<Trash2 className="w-4 h-4" />}
                                                    onClick={() => {
                                                        setDeleteTarget(selected);
                                                        setDeleteOpen(true);
                                                    }}
                                                    className={ICON_BTN}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Labeled sections with ': ' */}
                                    <div>
                                        <p className="text-sm">
                                            <span className="font-medium">Summary: </span>
                                            <span>{selected.summary}</span>
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-sm">
                                            <span className="font-medium">Description: </span>
                                            <span>{selected.description}</span>
                                        </p>
                                    </div>

                                    {!!(selected.tags && selected.tags.length) && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Key Traits</p>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {selected.tags.map((t, i) => (
                                                    <span key={i} className={pillClass}>
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!!(selected.examples && selected.examples.length) && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Examples</p>
                                            <div className="grid gap-2 mt-1">
                                                {selected.examples.map((ex, i) => (
                                                    <Link
                                                        key={i}
                                                        to={toChatHref(selected, ex)}
                                                        state={{ personaId: selected.id }}
                                                        onClick={() => onChatClick(selected!)}
                                                        className={pillClass + " w-max"}
                                                    >
                                                        {ex}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(selected.promptTemplatePrefix || selected.promptTemplateSuffix) && (
                                        <div className="grid gap-2">
                                            <p className="text-sm font-medium text-muted-foreground">Prompt Template</p>
                                            {selected.promptTemplatePrefix && (
                                                <p className="text-sm">
                                                    <span className="font-medium">Prefix: </span>
                                                    <span>{selected.promptTemplatePrefix}</span>
                                                </p>
                                            )}
                                            {selected.promptTemplateSuffix && (
                                                <p className="text-sm">
                                                    <span className="font-medium">Suffix: </span>
                                                    <span>{selected.promptTemplateSuffix}</span>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Text>Nothing selected.</Text>
                            )}
                        </DialogContent>

                        {/* Actions: Chat + NEW Edit inside the Info dialog + Close */}
                        <DialogActions>
                            {selected && (
                                <>
                                    <Link
                                        to={toChatHref(selected)}
                                        state={{ personaId: selected.id }}
                                        onClick={() => onChatClick(selected)}
                                        style={{ textDecoration: "none" }}
                                    >
                                        <FButton appearance="primary" icon={<MessageSquare className="w-4 h-4" />} className={BRAND_BTN}>
                                            Chat
                                        </FButton>
                                    </Link>

                                    {/* NEW: Edit moved into the Info dialog */}
                                    <FButton
                                        appearance="secondary"
                                        icon={<Edit3 className="w-4 h-4" />}
                                        onClick={() => {
                                            const s = selected;
                                            if (!s) return;
                                            setDetailsOpen(false);
                                            openEdit(s);
                                        }}
                                        className={SECONDARY_BTN}
                                    >
                                        Edit
                                    </FButton>
                                </>
                            )}
                            <DialogTrigger disableButtonEnhancement>
                                <FButton appearance="secondary" className={SECONDARY_BTN}>
                                    Close
                                </FButton>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* ---------------------- Edit Dialog ---------------------- */}
            <Dialog open={editOpen} onOpenChange={(_, d) => setEditOpen(!!d.open)}>
                <DialogSurface aria-describedby="persona-edit-desc">
                    <DialogBody>
                        <DialogTitle>{editingFromDefault ? "Edit Persona (will save as a copy)" : "Edit Persona"}</DialogTitle>
                        <DialogContent className="grid gap-3">
                            <Text id="persona-edit-desc" size={200}>
                                {editingFromDefault
                                    ? "This is a starter persona. Your changes will be saved as a new copy when you click Save."
                                    : "Update the details below and save to apply changes."}
                            </Text>

                            <Input value={editDraft.name} onChange={(_, v) => setEditDraft(d => ({ ...d, name: v.value }))} placeholder="Name" />
                            <Input value={editDraft.summary} onChange={(_, v) => setEditDraft(d => ({ ...d, summary: v.value }))} placeholder="Summary" />
                            <Textarea
                                value={editDraft.description}
                                onChange={(_, v) => setEditDraft(d => ({ ...d, description: v.value }))}
                                placeholder="Description"
                                rows={3}
                            />

                            <div className="grid gap-2 md:grid-cols-2">
                                <Input
                                    value={editDraft.vertical}
                                    onChange={(_, v) => setEditDraft(d => ({ ...d, vertical: v.value }))}
                                    placeholder="Vertical"
                                />
                                <Input
                                    value={editDraft.ageRange}
                                    onChange={(_, v) => setEditDraft(d => ({ ...d, ageRange: v.value }))}
                                    placeholder="Age Range (e.g., 30–40)"
                                />
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                                <Input
                                    value={editDraft.icon}
                                    onChange={(_, v) => setEditDraft(d => ({ ...d, icon: v.value }))}
                                    placeholder="Icon (emoji or text)"
                                />
                                <Input
                                    value={editDraft.tags}
                                    onChange={(_, v) => setEditDraft(d => ({ ...d, tags: v.value }))}
                                    placeholder="Tags (comma-separated)"
                                />
                            </div>

                            <Textarea
                                value={editDraft.examples}
                                onChange={(_, v) => setEditDraft(d => ({ ...d, examples: v.value }))}
                                placeholder={"Example question 1...\nExample question 2..."}
                                rows={3}
                            />

                            <Textarea
                                value={editDraft.promptTemplatePrefix}
                                onChange={(_, v) => setEditDraft(d => ({ ...d, promptTemplatePrefix: v.value }))}
                                placeholder="promptTemplatePrefix"
                                rows={3}
                            />
                            <Textarea
                                value={editDraft.promptTemplateSuffix}
                                onChange={(_, v) => setEditDraft(d => ({ ...d, promptTemplateSuffix: v.value }))}
                                placeholder="promptTemplateSuffix"
                                rows={3}
                            />

                            {editError && (
                                <Text role="alert" style={{ color: "var(--colorPaletteRedForeground2)" }}>
                                    {editError}
                                </Text>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <FButton appearance="primary" icon={<Save className="w-4 h-4" />} onClick={saveEdit} className={BRAND_BTN}>
                                Save Changes
                            </FButton>
                            <DialogTrigger disableButtonEnhancement>
                                <FButton appearance="secondary" className={SECONDARY_BTN}>
                                    Cancel
                                </FButton>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}

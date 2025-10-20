// app/frontend/src/pages/personas/personas.ts

// Persona type
export type Persona = {
    id: string;
    name: string;
    summary: string;
    description: string;
    tags: string[];
    vertical?: string;
    ageRange?: string; // shown in UI as "Age: ..."; we label both parent & child here
    icon?: string;
    examples?: string[];
    promptTemplatePrefix?: string;
    promptTemplateSuffix?: string;
    createdAt: number;
    updatedAt: number;
    isDefault?: boolean;
};

// Capture a timestamp for defaults
const now = Date.now();

// Default personas (unchanged)
export const DEFAULT_PERSONAS: Persona[] = [
    // 1
    {
        id: "p-budget-parent",
        name: "Budget-Conscious Parent",
        summary: "Stretching every dollar on kids’ everyday clothing and school basics",
        description:
            "Primary caregiver with two primary-school kids, balancing quality and price. Buys multi-packs, uniforms, socks/undies, and seasonal basics during promos.",
        tags: ["Value-Seeking", "Family-Oriented", "Bulk Buyer"],
        vertical: "Retail",
        ageRange: "30–40",
        icon: "👨‍👩‍👧‍👦",
        examples: [
            "Build a term-start checklist for two kids under $180 total.",
            "Which bundle offers better value for socks and undies this month?",
            "Suggest a winter capsule for two school-age kids under $220."
        ],
        promptTemplatePrefix:
            "You are advising a cost-conscious parent buying clothes for two school-age children in Australia. Prioritise durability, bundle value, and uniform compliance. Be specific with quantities and total spend.",
        promptTemplateSuffix: "Always include a running total and highlight any multi-pack or promo opportunities.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 2
    {
        id: "p-expecting-mum",
        name: "Expecting First-Time Mum",
        summary: "Preparing a newborn essentials kit with safe, soft, easy-care items",
        description:
            "Pregnant with first child (due in 2 months). Wants breathable fabrics, skin-safe materials, easy-care items, and a clear essentials roadmap.",
        tags: ["Safety-First", "Comfort", "Essentials Planner"],
        vertical: "Retail",
        ageRange: "25–35",
        icon: "🤰",
        examples: [
            "Create a newborn essentials list (0–3 months) under $300.",
            "Compare organic vs standard cotton bodysuits for summer in AU.",
            "What sizes should I buy to cover rapid growth in first 3 months?"
        ],
        promptTemplatePrefix:
            "You are helping a first-time mum assemble newborn clothing and nursery basics for warm Australian weather. Prioritise skin-safe fabrics, easy changes, and washing simplicity.",
        promptTemplateSuffix: "Present items in a checklist by size range (0000–000–00) with estimated totals.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 3
    {
        id: "p-teen-trend",
        name: "Trend-Seeking Teen",
        summary: "Wants on-trend outfits at low cost for school breaks and weekends",
        description: "Teen shopper influenced by social trends. Seeks affordable looks (streetwear, basics to mix/match), plus occasional event outfits.",
        tags: ["Trend-Following", "Price-Conscious", "Social-Influenced"],
        vertical: "Retail",
        ageRange: "14–18",
        icon: "🧢",
        examples: [
            "Build 3 weekend outfits under $120 total with current trends.",
            "Suggest a TikTok-ready casual look with pieces I can re-wear.",
            "What’s the cheapest way to refresh tees/hoodies this term?"
        ],
        promptTemplatePrefix:
            "You advise a trend-aware teen with limited budget. Suggest versatile pieces that remix into multiple outfits. Keep totals low and call out any bundle savings.",
        promptTemplateSuffix: "Return a compact shopping list plus 3 mix-and-match outfit ideas.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 4
    {
        id: "p-grandparent-gifts",
        name: "Grandparent Gift-Giver",
        summary: "Buying simple, comfy gifts for grandkids with easy size choices",
        description: "Grandparent purchasing for 2 grandkids across different ages. Values simplicity, generous fits, gift value, and easy returns.",
        tags: ["Gifting", "Simplicity", "Comfort"],
        vertical: "Retail",
        ageRange: "60–75",
        icon: "🧶",
        examples: [
            "Recommend age-appropriate gift outfits for a 3yo and 7yo under $100.",
            "What sizes are safe to buy if I’m unsure? Provide a quick guide.",
            "Find soft, sensory-friendly options suitable as gifts."
        ],
        promptTemplatePrefix:
            "You are assisting a grandparent choosing clothing gifts for two children of different ages. Emphasise forgiving fits, sensory comfort, and clear size guidance.",
        promptTemplateSuffix: "Provide a brief size cheat-sheet and a receipt-friendly tip.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 5
    {
        id: "p-urban-pro-budget",
        name: "Urban Professional on a Budget",
        summary: "Time-poor parent replacing work/casual staples without overspending",
        description: "Lives in metro area, juggling work and family. Needs durable basics (tees, chinos, socks, underwear) and quick seasonal refreshes.",
        tags: ["Time-Poor", "Staples", "Durability"],
        vertical: "Retail",
        ageRange: "28–40",
        icon: "🏙️",
        examples: [
            "Refresh work-casual staples (tops/bottoms/socks) under $200.",
            "Create a 7-day basics rotation with minimal laundry stress.",
            "Find the best-value multi-packs for men’s or women’s basics."
        ],
        promptTemplatePrefix:
            "You help a budget-conscious professional quickly rebuild reliable basics. Focus on cost-per-wear, easy care, and minimal decision fatigue.",
        promptTemplateSuffix: "Output a 7-day rotation and care tips; include per-item and total costs.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 7
    {
        id: "p-young-professional",
        name: "Young Urban Professional",
        summary: "Just starting out, wants style with budget & quick options",
        description: "Single, early career, city-based. Wants stylish work/casual looks without overspending. Prioritises easy care and fast delivery/pickup.",
        tags: ["Style-Conscious", "Budget Friendly", "Quick Shopping"],
        vertical: "Retail",
        ageRange: "22–30",
        icon: "💼",
        examples: [
            "Put together 3 office-friendly outfits under $250.",
            "What casual weekend pairings work with items I already own?",
            "Suggest shirts/blazers that transition from work to after-hours."
        ],
        promptTemplatePrefix: "You are advising a young professional in a city. They want versatile, low-maintenance outfits that stretch a tight budget.",
        promptTemplateSuffix: "Include outfit combinations and estimated costs; show multi-use per item.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 8
    {
        id: "p-retiree-style",
        name: "Retiree Comfort & Value Shopper",
        summary: "Fixed income, seeks comfort and classic styles that are easy care",
        description: "Retired shopper prioritising softness, generous fits, and durable basics. Prefers classic cuts over trends and reliable sizing.",
        tags: ["Comfort", "Classic", "Low Fuss"],
        vertical: "Retail",
        ageRange: "65–80",
        icon: "🧓",
        examples: [
            "Suggest lightweight cardigans and trousers for mild climates.",
            "Find easy-wash, non-iron shirts suited to older adults.",
            "Which value multipacks would stretch my budget best?"
        ],
        promptTemplatePrefix: "You are advising a retiree who wants comfort-first clothing with easy wear and care.",
        promptTemplateSuffix: "List fabric recommendations, care notes, and value-pack options.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 9
    {
        id: "p-sporty-family",
        name: "Active Family with Sport Needs",
        summary: "Kids and parents needing durable activewear/swimwear on a budget",
        description: "Family where kids play sport; needs activewear and swim gear that survives heavy use and frequent washing.",
        tags: ["Active", "Durable", "Family Use"],
        vertical: "Retail",
        ageRange: "35–50",
        icon: "🏃‍♀️",
        examples: [
            "Find durable gym gear for 2 kids and 2 adults under $200.",
            "Suggest chlorine-resistant swimwear worth the price.",
            "Which shoes offer good cushioning deals this season?"
        ],
        promptTemplatePrefix: "You are helping a sporty family outfit for training and swim. Priorise durability, moisture control, and cost-per-use.",
        promptTemplateSuffix: "Include wash-care instructions and fit guidance between brands.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 10
    {
        id: "p-sustainable-shopper",
        name: "Eco-Aware Sustainable Shopper",
        summary: "Cares about materials, ethical sourcing and low waste",
        description:
            "Environmentally conscious consumer. Looks for organic/recycled fabrics and transparent sourcing, accepts trade-offs vs. price when justified.",
        tags: ["Eco Friendly", "Ethical", "Minimal Waste"],
        vertical: "Retail",
        ageRange: "25–45",
        icon: "🌿",
        examples: [
            "Show organic cotton or recycled apparel under $120.",
            "Which kids ranges have credible certifications?",
            "How to build a low-waste basics set for school?"
        ],
        promptTemplatePrefix:
            "You are advising a shopper with strong sustainability values. Prioritise certified materials, durability, and minimal packaging.",
        promptTemplateSuffix: "Highlight certifications and trade-offs between price and sustainability.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 11
    {
        id: "p-plus-size-fashionista",
        name: "Plus-Size Fashionista",
        summary: "Trendy, flattering plus-size options with great fit and comfort",
        description: "Curvy adult seeking on-trend designs with inclusive sizing, flattering proportions, and comfortable stretch fabrics.",
        tags: ["Plus Size", "Style Focused", "Fit Conscious"],
        vertical: "Retail",
        ageRange: "30–50",
        icon: "👗",
        examples: [
            "Find elegant plus-size evening wear under $150.",
            "Suggest tops with flattering cuts and flexible stretch in plus sizes.",
            "What brands have reliable plus-size jeans and shorts?"
        ],
        promptTemplatePrefix: "You are advising a plus-size shopper who values fit and style. Offer size-inclusive brands and flattering cuts.",
        promptTemplateSuffix: "Provide sizing tips, stretch/fit guidance, and accessory suggestions.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    },
    // 12
    {
        id: "p-new-home-budgeter",
        name: "New Home Budgeter",
        summary: "Recently moved, tight budget, needs basics for whole household",
        description: "Family of four setting up wardrobes and home basics after a move. Seeks multipacks and discount bundles across clothing and textiles.",
        tags: ["Home Setup", "Bulk Buying", "Budget Stretch"],
        vertical: "Retail",
        ageRange: "30–45",
        icon: "🏡",
        examples: [
            "Plan clothing basics for a family of four under $400.",
            "Find multipacks of sheets/towels with good value.",
            "Bundle school, work, and casual needs efficiently."
        ],
        promptTemplatePrefix:
            "You are advising a family building wardrobes and home basics on a tight budget. Prioritise multipacks, durable fabrics, and value bundles.",
        promptTemplateSuffix: "Include home textiles alongside clothing; show itemised and total costs.",
        createdAt: now,
        updatedAt: now,
        isDefault: true
    }
];

/* ----------------------------- CUSTOM STORAGE ---------------------------- */

const CUSTOM_KEY = "personas.custom";

// Helper: safely parse JSON or return fallback
function safeParse<T>(raw: string | null, fallback: T): T {
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

// Read custom personas from storage
function readCustom(): Persona[] {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const arr = safeParse<Persona[]>(raw, []);
    // ensure minimal fields and that isDefault is false
    return arr.map(p => ({
        id: p.id,
        name: p.name,
        summary: p.summary,
        description: p.description,
        tags: Array.isArray(p.tags) ? p.tags : [],
        vertical: p.vertical,
        ageRange: p.ageRange,
        icon: p.icon,
        examples: Array.isArray(p.examples) ? p.examples : [],
        promptTemplatePrefix: p.promptTemplatePrefix,
        promptTemplateSuffix: p.promptTemplateSuffix,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isDefault: false
    }));
}

// Write a list of custom personas to storage (overwrites)
function writeCustom(list: Persona[]): void {
    const customs = list.filter(p => !p.isDefault);
    try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
    } catch {
        // ignore storage quota errors
    }
}

// Exported helpers
export function getCustomPersonas(): Persona[] {
    return readCustom();
}

export function saveCustomPersonas(list: Persona[]): void {
    writeCustom(list);
}

export function upsertPersona(p: Persona): void {
    const nowTs = Date.now();
    const inc: Persona = {
        ...p,
        isDefault: false,
        createdAt: p.createdAt ?? nowTs,
        updatedAt: nowTs
    };
    const all = readCustom();
    const idx = all.findIndex(x => x.id === inc.id);
    const next = idx >= 0 ? all.map(x => (x.id === inc.id ? { ...x, ...inc } : x)) : [inc, ...all];
    writeCustom(next);
}

export function deletePersonaById(id: string): void {
    const all = readCustom();
    writeCustom(all.filter(p => p.id !== id));
}

/* ---------------------------- SEEDED PERSONAS ---------------------------- */
/**
 * Six custom personas (all 🤖), with explicit parent + child age in ageRange.
 * We also include a versioned, idempotent seeding flow that reconciles changes:
 * - Removes legacy/bad seed ids (where child's age was treated as shopper age)
 * - Upserts the corrected six seeds
 * - Stores a seed version so future changes re-apply safely
 */

const seedNow = Date.now();
export const SEED_CUSTOM_PERSONAS: Persona[] = [
    // Parent of Child 0–5 · Frequent Shopper
    {
        id: "p-parent-0-5-frequent",
        name: "Parent of Child 0–5 · Frequent Shopper",
        summary: "Weekly top-ups for fast-growing 0–5s; comfort, easy-care and multipack value.",
        description:
            "Parent/caregiver to a baby or toddler (youngest child aged 0–5). Shops weekly/fortnightly for daycare and home basics. Prioritises soft, breathable fabrics, quick changes (zips/snaps), stain resistance and multipack savings.",
        tags: ["Parent", "Child 0–5", "Frequent", "Comfort", "Easy-Care", "Multipacks", "Budget"],
        vertical: "Retail",
        ageRange: "Parent 28–35; Child 0–5",
        icon: "🤖",
        examples: [
            "Build a weekly daycare refresh list under $60 with multipacks.",
            "When should I size up from 12–18m? Include a quick fit check.",
            "Recommend 5 daycare-proof outfits that wash/dry fast."
        ],
        promptTemplatePrefix:
            "Role-play a retail assistant advising a PARENT whose youngest child is 0–5 and who shops weekly. Prioritise soft breathable fabrics, easy fastenings and stain resistance. Expect growth spurts and brand variance; recommend when to size up. Highlight multipacks/value.",
        promptTemplateSuffix:
            "Return: (1) concise checklist + quantities, (2) size-up guidance, (3) care tips for fast laundry turnaround, (4) estimated total.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    },
    // Parent of Child 0–5 · Regular Shopper
    {
        id: "p-parent-0-5-regular",
        name: "Parent of Child 0–5 · Regular Shopper",
        summary: "Monthly plan for 0–5 essentials; balances comfort, durability and bundles.",
        description:
            "Parent shops monthly and during promos for a youngest child aged 0–5. Wants predictable replenishment and seasonal updates for daycare/sleep/home. Prefers balanced bundles over constant top-ups; needs size-up timing across brands.",
        tags: ["Parent", "Child 0–5", "Regular", "Planner", "Seasonal", "Bundles", "Value"],
        vertical: "Retail",
        ageRange: "Parent 30–38; Child 0–5",
        icon: "🤖",
        examples: [
            "Create a monthly essentials plan for a 2-year-old under $120.",
            "What to buy now vs wait for promo? Prioritise best value.",
            "Build a daycare capsule (tops/bottoms/sleep) with 2 spare sets."
        ],
        promptTemplatePrefix:
            "Advise a PARENT whose youngest child is 0–5 and who shops monthly. Optimise comfort, easy-care and predictable replenishment. Recommend balanced bundles and seasonal timing. Include guidance on when to size up.",
        promptTemplateSuffix: "Output a month-by-month checklist, promo-timing tips, and itemised + total costs with fabric/care notes.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    },
    // Parent of Child 0–5 · Occasional/Rare Shopper
    {
        id: "p-parent-0-5-occasional",
        name: "Parent of Child 0–5 · Occasional/Rare Shopper",
        summary: "Infrequent seasonal buys; durable sets that last through growth.",
        description:
            "Parent purchases quarterly/seasonally for a youngest child aged 0–5. Needs robust, versatile pieces that bridge growth spurts and avoid emergency buys. Prefers adjustable waists, neutral mix-and-match sets, quick-dry/low-fuss care.",
        tags: ["Parent", "Child 0–5", "Occasional", "Durable", "Versatile", "Mix-and-Match", "Size-Up"],
        vertical: "Retail",
        ageRange: "Parent 32–42; Child 0–5",
        icon: "🤖",
        examples: [
            "Quarterly buy: cover daycare, sleep and outings under $220.",
            "What adjustable items reduce replacements as they grow?",
            "Plan a minimal travel capsule with quick-dry pieces."
        ],
        promptTemplatePrefix:
            "Act as a planner for a PARENT whose youngest child is 0–5 and who shops infrequently. Suggest durable, versatile, quick-dry pieces with adjustable features that handle growth. Prefer multipacks and neutral mixes for longevity.",
        promptTemplateSuffix: "Provide a minimal capsule list, longevity notes, size-up advice and total estimated cost.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    },
    // Parent of Child 6–13 · Frequent Shopper
    {
        id: "p-parent-6-13-frequent",
        name: "Parent of Child 6–13 · Frequent Shopper",
        summary: "Frequent top-ups around school/sport; sturdy, easy-care multipacks.",
        description:
            "Parent of a primary/middle-school child (youngest aged 6–13). Shops often for socks/undies/tees and uniform/sports pieces. Sensitive to back-to-school budgets and seasonal spikes.",
        tags: ["Parent", "Child 6–13", "Frequent", "School", "Sport", "Multipacks", "Budget"],
        vertical: "Retail",
        ageRange: "Parent 35–45; Child 6–13",
        icon: "🤖",
        examples: [
            "Top-up a school basics list (socks/undies/tees) under $70.",
            "Uniform refresh + sports kit for term start under $160.",
            "Weekly plan: replace worn items; flag any bundle value."
        ],
        promptTemplatePrefix:
            "Role-play a store associate for a PARENT whose youngest child is 6–13 and who shops frequently. Prioritise school basics, durable sportswear, fast laundry turnaround and multipack value. Consider back-to-school budget constraints.",
        promptTemplateSuffix: "Return a short weekly/fortnightly checklist, durability tips and an itemised + total estimate.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    },
    // Parent of Child 6–13 · Regular Shopper
    {
        id: "p-parent-6-13-regular",
        name: "Parent of Child 6–13 · Regular Shopper",
        summary: "Monthly/term planner covering school, casual and activities on a budget.",
        description:
            "Parent shops monthly or each term for a youngest child aged 6–13. Wants predictable replenishment for school and casual with value packs, durability and comfort. Seeks promo timing guidance around back-to-school cycles.",
        tags: ["Parent", "Child 6–13", "Regular", "Planner", "Value", "Term-Based", "Comfort"],
        vertical: "Retail",
        ageRange: "Parent 37–47; Child 6–13",
        icon: "🤖",
        examples: [
            "Term planner: uniforms, socks and sports basics under $220.",
            "Which items to buy now vs wait for back-to-school promos?",
            "Assemble a 7-day outfit rotation with minimal laundry stress."
        ],
        promptTemplatePrefix:
            "Advise a PARENT whose youngest child is 6–13 and who shops on a monthly/term cadence. Optimise for value packs, durability and comfort. Include promo-timing suggestions and size guidance as kids hit growth phases.",
        promptTemplateSuffix: "Output a month/term checklist, promo calendar notes and itemised + total costs with care instructions.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    },
    // Parent of Child 6–13 · Occasional/Rare Shopper
    {
        id: "p-parent-6-13-occasional",
        name: "Parent of Child 6–13 · Occasional/Rare Shopper",
        summary: "Infrequent seasonal buys; durable cross-use capsule for school/sport/casual.",
        description:
            "Parent buys a few times per year (seasonal/back-to-school) for a youngest child aged 6–13. Needs robust, versatile sets that cover school, sport and casual with minimal overlap. Prefers bundles and strong cost-per-wear.",
        tags: ["Parent", "Child 6–13", "Occasional", "Durable", "Bundles", "Capsule", "Cost-per-Wear"],
        vertical: "Retail",
        ageRange: "Parent 40–50; Child 6–13",
        icon: "🤖",
        examples: [
            "Design a back-to-school capsule (uniform + basics) under $280.",
            "One seasonal buy to cover sport & casual; minimise overlap.",
            "Which items last longest per wear? Prioritise those."
        ],
        promptTemplatePrefix:
            "Be a capsule curator for a PARENT whose youngest child is 6–13 and who shops infrequently. Focus on durable, cross-use items that reduce mid-term top-ups. Prefer bundles and strong cost-per-wear over trend churn.",
        // promptTemplateSuffix: "Deliver a capsule checklist, longevity notes, size-up guidance and a total cost estimate.",
        createdAt: seedNow,
        updatedAt: seedNow,
        isDefault: false
    }
];

/* ---------------------- Versioned, idempotent seeding --------------------- */

const SEED_VERSION = 2; // bump when seed content/ids change
const SEED_VERSION_KEY = "personas.seed.version";

// legacy ids (older incorrect seeds) to purge on migrate
const LEGACY_SEED_IDS = new Set<string>([
    "p-0-5-frequent-shopper",
    "p-0-5-regular-shopper",
    "p-0-5-rare-shopper",
    "p-6-13-frequent-shopper",
    "p-6-13-regular-shopper",
    "p-6-13-rare-shopper"
]);

function getSeedVersion(): number {
    const raw = localStorage.getItem(SEED_VERSION_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
}

function setSeedVersion(v: number) {
    try {
        localStorage.setItem(SEED_VERSION_KEY, String(v));
    } catch {
        // ignore
    }
}

export function insertSeedCustomPersonas(): void {
    for (const p of SEED_CUSTOM_PERSONAS) {
        upsertPersona(p);
    }
}

/** Remove legacy seeds that used the wrong age interpretation. */
function purgeLegacySeeds(): void {
    const current = readCustom();
    const filtered = current.filter(p => !LEGACY_SEED_IDS.has(p.id));
    writeCustom(filtered);
}

/**
 * Reconcile seeds:
 * - If no customs: seed fresh
 * - If seed version outdated or any seed missing/stale: purge legacy and upsert latest
 */
function reconcileSeedPersonas(): void {
    const currentVersion = getSeedVersion();
    const customs = readCustom();

    const byId = new Map(customs.map(p => [p.id, p]));
    let needsUpdate = currentVersion < SEED_VERSION;

    // if any of our seed ids are missing or materially different, mark for update
    for (const seed of SEED_CUSTOM_PERSONAS) {
        const existing = byId.get(seed.id);
        if (!existing) {
            needsUpdate = true;
            break;
        }
        // check a few core fields likely to change
        const changed =
            existing.name !== seed.name ||
            existing.summary !== seed.summary ||
            existing.description !== seed.description ||
            existing.ageRange !== seed.ageRange ||
            (existing.icon ?? "") !== (seed.icon ?? "");
        if (changed) {
            needsUpdate = true;
            break;
        }
    }

    if (customs.length === 0 || needsUpdate) {
        purgeLegacySeeds();
        insertSeedCustomPersonas();
        setSeedVersion(SEED_VERSION);
    }
}

/** Auto-reconcile at module load so PersonasPage always sees the corrected customs. */
(function seedOrReconcileOnLoad() {
    try {
        reconcileSeedPersonas();
    } catch {
        // Ignore storage unavailability (SSR / privacy modes).
    }
})();

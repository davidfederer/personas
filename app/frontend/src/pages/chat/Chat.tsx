// src/pages/chat/Chat.tsx
import { useRef, useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Panel, DefaultButton } from "@fluentui/react";
import readNDJSONStream from "ndjson-readablestream";
import { useSearchParams, Link, useLocation } from "react-router-dom";

import appLogo from "../../assets/personas-logo-white.png";
import personaTileLogo from "../logos/personas-logo.png"; // app logo for the persona header tile
import styles from "./Chat.module.css";

import { chatApi, configApi, RetrievalMode, ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, ResponseMessage, SpeechConfig } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
// import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { HistoryPanel } from "../../components/HistoryPanel";
import { HistoryProviderOptions, useHistoryManager } from "../../components/HistoryProviders";
import { HistoryButton } from "../../components/HistoryButton";
import { SettingsButton } from "../../components/SettingsButton";
import { ClearChatButton } from "../../components/ClearChatButton";
import { UploadFile } from "../../components/UploadFile";
import { useLogin, getToken, requireAccessControl } from "../../authConfig";
import { useMsal } from "@azure/msal-react";
import { TokenClaimsDisplay } from "../../components/TokenClaimsDisplay";
import { LoginContext } from "../../loginContext";
import { Settings } from "../../components/Settings/Settings";

// Personas
import { DEFAULT_PERSONAS, Persona, getCustomPersonas } from "../personas/personas";

/* ---------------- Persona persistence helpers ---------------- */
const LAST_PERSONA_ID_KEY = "last_persona_id";
const LAST_PERSONA_KEY = "last_persona_json";

function getAllPersonas(): Persona[] {
    const custom = getCustomPersonas(); // centralized custom store
    const customIds = new Set(custom.map(p => p.id));
    const defaults = DEFAULT_PERSONAS.filter(p => !customIds.has(p.id));
    return [...custom, ...defaults];
}
function resolvePersonaById(id: string | null | undefined): Persona | null {
    if (!id) return null;
    return getAllPersonas().find(p => p.id === id) ?? null;
}

const Chat = () => {
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [temperature, setTemperature] = useState<number>(0.3);
    const [seed, setSeed] = useState<number | null>(null);
    const [minimumRerankerScore, setMinimumRerankerScore] = useState<number>(0);
    const [minimumSearchScore, setMinimumSearchScore] = useState<number>(0);
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [maxSubqueryCount, setMaxSubqueryCount] = useState<number>(10);
    const [resultsMergeStrategy, setResultsMergeStrategy] = useState<string>("interleaved");
    const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Hybrid);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useQueryRewriting, setUseQueryRewriting] = useState<boolean>(false);
    const [reasoningEffort, setReasoningEffort] = useState<string>("");
    const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);
    const [shouldStream, setShouldStream] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [includeCategory, setIncludeCategory] = useState<string>("");
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const [searchTextEmbeddings, setSearchTextEmbeddings] = useState<boolean>(true);
    const [searchImageEmbeddings, setSearchImageEmbeddings] = useState<boolean>(false);
    const [useOidSecurityFilter, setUseOidSecurityFilter] = useState<boolean>(false);
    const [useGroupsSecurityFilter, setUseGroupsSecurityFilter] = useState<boolean>(false);
    const [sendTextSources, setSendTextSources] = useState<boolean>(true);
    const [sendImageSources, setSendImageSources] = useState<boolean>(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: ChatAppResponse][]>([]);
    const [streamedAnswers, setStreamedAnswers] = useState<[user: string, response: ChatAppResponse][]>([]);
    const [speechUrls, setSpeechUrls] = useState<(string | null)[]>([]);

    const [showMultimodalOptions, setShowMultimodalOptions] = useState<boolean>(false);
    const [showSemanticRankerOption, setShowSemanticRankerOption] = useState<boolean>(false);
    const [showQueryRewritingOption, setShowQueryRewritingOption] = useState<boolean>(false);
    const [showReasoningEffortOption, setShowReasoningEffortOption] = useState<boolean>(false);
    const [showVectorOption, setShowVectorOption] = useState<boolean>(false);
    const [showUserUpload, setShowUserUpload] = useState<boolean>(false);
    const [showSpeechInput, setShowSpeechInput] = useState<boolean>(false);
    const [showSpeechOutputBrowser, setShowSpeechOutputBrowser] = useState<boolean>(false);
    const [showSpeechOutputAzure, setShowSpeechOutputAzure] = useState<boolean>(false);
    const [showChatHistoryBrowser, setShowChatHistoryBrowser] = useState<boolean>(false);
    const [showChatHistoryCosmos, setShowChatHistoryCosmos] = useState<boolean>(false);
    const [showAgenticRetrievalOption, setShowAgenticRetrievalOption] = useState<boolean>(false);
    const [useAgenticRetrieval, setUseAgenticRetrieval] = useState<boolean>(false);

    const audio = useRef(new Audio()).current;
    const [isPlaying, setIsPlaying] = useState(false);

    const speechConfig: SpeechConfig = {
        speechUrls,
        setSpeechUrls,
        audio,
        isPlaying,
        setIsPlaying
    };

    // Persona plumbing
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const [activePersona, setActivePersona] = useState<Persona | null>(null);
    const previousTemplateRef = useRef<string>("");
    const personaAppliedRef = useRef<boolean>(false);

    const buildPersonaPrompt = (p: Persona) => {
        const traits = (p.tags ?? []).join(", ");
        const lines: string[] = [];
        if (p.promptTemplatePrefix) lines.push(p.promptTemplatePrefix.trim());
        lines.push(
            `You are role-playing as a customer persona called "${p.name}".`,
            `Vertical: ${p.vertical ?? "—"}. Age Range: ${p.ageRange ?? "—"}.`,
            `Key traits: ${traits || "—"}.`,
            `Context: ${p.summary || p.description || "—"}.`,
            "",
            "Act strictly as this customer. Answer questions *as the customer*, with realistic goals, constraints, and language.",
            "Keep replies concise and practical unless asked for more detail."
        );
        if (p.promptTemplateSuffix) lines.push("", p.promptTemplateSuffix.trim());
        return lines.join("\n");
    };

    const getConfig = async () => {
        configApi().then(config => {
            setShowMultimodalOptions(config.showMultimodalOptions);
            setSearchImageEmbeddings(config.ragSearchImageEmbeddings);
            if (config.showMultimodalOptions) {
                setSendTextSources(config.ragSendTextSources !== undefined ? config.ragSendTextSources : true);
                setSendImageSources(config.ragSendImageSources);
                setSearchTextEmbeddings(config.ragSearchTextEmbeddings);
                setSearchImageEmbeddings(config.ragSearchImageEmbeddings);
            }
            setUseSemanticRanker(config.showSemanticRankerOption);
            setShowSemanticRankerOption(config.showSemanticRankerOption);
            setUseQueryRewriting(config.showQueryRewritingOption);
            setShowQueryRewritingOption(config.showQueryRewritingOption);
            setShowReasoningEffortOption(config.showReasoningEffortOption);
            setStreamingEnabled(config.streamingEnabled);
            if (!config.streamingEnabled) setShouldStream(false);
            if (config.showReasoningEffortOption) setReasoningEffort(config.defaultReasoningEffort);
            setShowVectorOption(config.showVectorOption);
            if (!config.showVectorOption) setRetrievalMode(RetrievalMode.Text);
            setShowUserUpload(config.showUserUpload);
            setShowSpeechInput(config.showSpeechInput);
            setShowSpeechOutputBrowser(config.showSpeechOutputBrowser);
            setShowSpeechOutputAzure(config.showSpeechOutputAzure);
            setShowChatHistoryBrowser(config.showChatHistoryBrowser);
            setShowChatHistoryCosmos(config.showChatHistoryCosmos);
            setShowAgenticRetrievalOption(config.showAgenticRetrievalOption);
            setUseAgenticRetrieval(config.showAgenticRetrievalOption);
            if (config.showAgenticRetrievalOption) setRetrieveCount(10);
        });
    };

    const handleAsyncRequest = async (question: string, answers: [string, ChatAppResponse][], responseBody: ReadableStream<any>) => {
        let answer: string = "";
        let askResponse: ChatAppResponse = {} as ChatAppResponse;

        const updateState = (newContent: string) =>
            new Promise(resolve => {
                setTimeout(() => {
                    answer += newContent;
                    const latestResponse: ChatAppResponse = {
                        ...askResponse,
                        message: { content: answer, role: askResponse.message.role }
                    };
                    setStreamedAnswers([...answers, [question, latestResponse]]);
                    resolve(null);
                }, 33);
            });

        try {
            setIsStreaming(true);
            for await (const event of readNDJSONStream(responseBody)) {
                if (event["context"] && event["context"]["data_points"]) {
                    event["message"] = event["delta"];
                    askResponse = event as ChatAppResponse;
                } else if (event["delta"] && event["delta"]["content"]) {
                    setIsLoading(false);
                    await updateState(event["delta"]["content"]);
                } else if (event["context"]) {
                    askResponse = { ...askResponse, context: { ...askResponse.context, ...event["context"] } };
                } else if (event["error"]) {
                    throw Error(event["error"]);
                }
            }
        } finally {
            setIsStreaming(false);
        }
        const fullResponse: ChatAppResponse = {
            ...askResponse,
            message: { content: answer, role: askResponse.message.role }
        };
        return fullResponse;
    };

    const client = useLogin ? useMsal().instance : undefined;
    const { loggedIn } = useContext(LoginContext);

    const historyProvider: HistoryProviderOptions = (() => {
        if (useLogin && showChatHistoryCosmos) return HistoryProviderOptions.CosmosDB;
        if (showChatHistoryBrowser) return HistoryProviderOptions.IndexedDB;
        return HistoryProviderOptions.None;
    })();
    const historyManager = useHistoryManager(historyProvider);

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        const token = client ? await getToken(client) : undefined;

        try {
            const messages: ResponseMessage[] = answers.flatMap(a => [
                { content: a[0], role: "user" },
                { content: a[1].message.content, role: "assistant" }
            ]);

            const request: ChatAppRequest = {
                messages: [...messages, { content: question, role: "user" }],
                context: {
                    overrides: {
                        prompt_template: promptTemplate.length === 0 ? undefined : promptTemplate,
                        include_category: includeCategory.length === 0 ? undefined : includeCategory,
                        exclude_category: excludeCategory.length === 0 ? undefined : excludeCategory,
                        top: retrieveCount,
                        max_subqueries: maxSubqueryCount,
                        results_merge_strategy: resultsMergeStrategy,
                        temperature: temperature,
                        minimum_reranker_score: minimumRerankerScore,
                        minimum_search_score: minimumSearchScore,
                        retrieval_mode: retrievalMode,
                        semantic_ranker: useSemanticRanker,
                        semantic_captions: useSemanticCaptions,
                        query_rewriting: useQueryRewriting,
                        reasoning_effort: reasoningEffort,
                        suggest_followup_questions: useSuggestFollowupQuestions,
                        use_oid_security_filter: useOidSecurityFilter,
                        use_groups_security_filter: useGroupsSecurityFilter,
                        search_text_embeddings: searchTextEmbeddings,
                        search_image_embeddings: searchImageEmbeddings,
                        send_text_sources: sendTextSources,
                        send_image_sources: sendImageSources,
                        language: "en",
                        use_agentic_retrieval: useAgenticRetrieval,
                        ...(seed !== null ? { seed: seed } : {})
                    }
                },
                session_state: answers.length ? answers[answers.length - 1][1].session_state : null
            };

            const response = await chatApi(request, shouldStream, token);
            if (!response.body) throw Error("No response body");
            if (response.status > 299 || !response.ok) throw Error(`Request failed with status ${response.status}`);

            if (shouldStream) {
                const parsedResponse: ChatAppResponse = await handleAsyncRequest(question, answers, response.body);
                setAnswers([...answers, [question, parsedResponse]]);
                if (typeof parsedResponse.session_state === "string" && parsedResponse.session_state !== "") {
                    const token2 = client ? await getToken(client) : undefined;
                    historyManager.addItem(parsedResponse.session_state, [...answers, [question, parsedResponse]], token2);
                }
            } else {
                const parsedResponse: ChatAppResponseOrError = await response.json();
                if ((parsedResponse as any).error) throw Error((parsedResponse as any).error);
                setAnswers([...answers, [question, parsedResponse as ChatAppResponse]]);
                if (typeof (parsedResponse as ChatAppResponse).session_state === "string" && (parsedResponse as ChatAppResponse).session_state !== "") {
                    const token2 = client ? await getToken(client) : undefined;
                    historyManager.addItem(
                        (parsedResponse as ChatAppResponse).session_state,
                        [...answers, [question, parsedResponse as ChatAppResponse]],
                        token2
                    );
                }
            }
            setSpeechUrls([...speechUrls, null]);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);
        setSpeechUrls([]);
        setStreamedAnswers([]);
        setIsLoading(false);
        setIsStreaming(false);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "auto" }), [streamedAnswers]);
    useEffect(() => {
        getConfig();
    }, []);

    const handleSettingsChange = (field: string, value: any) => {
        switch (field) {
            case "promptTemplate":
                setPromptTemplate(value);
                break;
            case "temperature":
                setTemperature(value);
                break;
            case "seed":
                setSeed(value);
                break;
            case "minimumRerankerScore":
                setMinimumRerankerScore(value);
                break;
            case "minimumSearchScore":
                setMinimumSearchScore(value);
                break;
            case "retrieveCount":
                setRetrieveCount(value);
                break;
            case "maxSubqueryCount":
                setMaxSubqueryCount(value);
                break;
            case "resultsMergeStrategy":
                setResultsMergeStrategy(value);
                break;
            case "useSemanticRanker":
                setUseSemanticRanker(value);
                break;
            case "useQueryRewriting":
                setUseQueryRewriting(value);
                break;
            case "reasoningEffort":
                setReasoningEffort(value);
                break;
            case "useSemanticCaptions":
                setUseSemanticCaptions(value);
                break;
            case "excludeCategory":
                setExcludeCategory(value);
                break;
            case "includeCategory":
                setIncludeCategory(value);
                break;
            case "useOidSecurityFilter":
                setUseOidSecurityFilter(value);
                break;
            case "useGroupsSecurityFilter":
                setUseGroupsSecurityFilter(value);
                break;
            case "shouldStream":
                setShouldStream(value);
                break;
            case "useSuggestFollowupQuestions":
                setUseSuggestFollowupQuestions(value);
                break;
            case "sendTextSources":
                setSendTextSources(value);
                break;
            case "sendImageSources":
                setSendImageSources(value);
                break;
            case "searchTextEmbeddings":
                setSearchTextEmbeddings(value);
                break;
            case "searchImageEmbeddings":
                setSearchImageEmbeddings(value);
                break;
            case "retrievalMode":
                setRetrievalMode(value);
                break;
            case "useAgenticRetrieval":
                setUseAgenticRetrieval(value);
                break;
        }
    };

    const { t } = useTranslation();

    // Persona hydration
    useEffect(() => {
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
            if (personaAppliedRef.current) {
                setPromptTemplate(previousTemplateRef.current || "");
                personaAppliedRef.current = false;
            }
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

        // Persist selection so it always carries over to Chat
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

        if (!personaAppliedRef.current) previousTemplateRef.current = promptTemplate;

        const personaPrompt = buildPersonaPrompt(p);
        setPromptTemplate(personaPrompt);
        personaAppliedRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, setSearchParams, location.search, location.state]);

    const clearActivePersona = () => {
        const next = new URLSearchParams(searchParams);
        next.delete("persona");
        next.delete("q");
        setSearchParams(next);
        try {
            localStorage.removeItem(LAST_PERSONA_ID_KEY);
            localStorage.removeItem(LAST_PERSONA_KEY);
        } catch {
            /* noop */
        }
    };

    /* ============================== RENDER =============================== */

    const starterQuestions = [
        "What is the typical frequency of loyal customers?",
        "What is the main concern of customers who disengage from B&L?",
        "Why can B&L improve customer retention?"
    ];

    return (
        <div className={styles.container}>
            {/* Tab title from i18n: frontend/src/locales/en/translation.json -> pageTitle */}
            <Helmet>
                <title>{t("pageTitle", { defaultValue: "Personas" })}</title>
            </Helmet>

            {/* Top command bar */}
            <div className="mx-auto max-w-5xl px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {((useLogin && showChatHistoryCosmos) || showChatHistoryBrowser) && (
                        <HistoryButton className={styles.commandButton} onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)} />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                    {showUserUpload && <UploadFile className={styles.commandButton} disabled={!loggedIn} />}
                    <SettingsButton className={styles.commandButton} onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)} />
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4">
                {/* Persona header */}
                {activePersona && (
                    <div className="mt-4 mb-3 rounded-2xl border bg-card shadow-sm p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Brand-colored tile with app logo */}
                                <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ backgroundColor: "#343741" }} aria-hidden="true">
                                    <img src={personaTileLogo} alt="Persona logo" className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Chat with {activePersona.name}</h2>
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
                                <Link to="/personas" state={{ from: "chat", personaId: activePersona.id }}>
                                    <button className="h-9 px-3 rounded-md border bg-background hover:bg-muted transition-smooth">Switch Persona</button>
                                </Link>
                                <button onClick={clearActivePersona} className="h-9 px-3 rounded-md border bg-background hover:bg-muted transition-smooth">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!lastQuestionRef.current ? (
                    <div className="mt-10 grid place-items-center text-center">
                        <img src={appLogo} alt="App logo" width={100} height={100} className="opacity-80" />
                        <h1 className="mt-4 text-2xl font-bold">Start a conversation</h1>
                        <p className="text-muted-foreground mt-1">Ask anything. Your persona will respond in character.</p>

                        <div className="w-full max-w-3xl mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {starterQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => makeApiRequest(q)}
                                    className="text-left justify-start h-auto p-3 text-sm rounded-md border hover:bg-muted transition-smooth"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Chat stream */
                    <div className={`${styles.chatMessageStream} space-y-4`}>
                        {isStreaming &&
                            streamedAnswers.map((streamedAnswer, index) => (
                                <div key={`s-${index}`} className="space-y-2">
                                    <UserChatMessage message={streamedAnswer[0]} />
                                    <div className="rounded-2xl border bg-card shadow-sm p-0">
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                isStreaming={true}
                                                key={index}
                                                answer={streamedAnswer[1]}
                                                index={index}
                                                speechConfig={speechConfig}
                                                isSelected={false}
                                                onCitationClicked={c => setActiveCitation(c)}
                                                onThoughtProcessClicked={() => setActiveAnalysisPanelTab(AnalysisPanelTabs.ThoughtProcessTab)}
                                                onSupportingContentClicked={() => setActiveAnalysisPanelTab(AnalysisPanelTabs.SupportingContentTab)}
                                                onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                                showSpeechOutputAzure={showSpeechOutputAzure}
                                                showSpeechOutputBrowser={showSpeechOutputBrowser}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                        {!isStreaming &&
                            answers.map((answer, index) => (
                                <div key={`a-${index}`} className="space-y-2">
                                    <UserChatMessage message={answer[0]} />
                                    <div className="rounded-2xl border bg-card shadow-sm p-0">
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                isStreaming={false}
                                                key={index}
                                                answer={answer[1]}
                                                index={index}
                                                speechConfig={speechConfig}
                                                isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                onCitationClicked={c => setActiveCitation(c)}
                                                onThoughtProcessClicked={() => setActiveAnalysisPanelTab(AnalysisPanelTabs.ThoughtProcessTab)}
                                                onSupportingContentClicked={() => setActiveAnalysisPanelTab(AnalysisPanelTabs.SupportingContentTab)}
                                                onFollowupQuestionClicked={q => makeApiRequest(q)}
                                                showFollowupQuestions={useSuggestFollowupQuestions && answers.length - 1 === index}
                                                showSpeechOutputAzure={showSpeechOutputAzure}
                                                showSpeechOutputBrowser={showSpeechOutputBrowser}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                        {isLoading && (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className="rounded-2xl border bg-card shadow-sm p-4">
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerLoading />
                                    </div>
                                </div>
                            </>
                        )}

                        {error ? (
                            <>
                                <UserChatMessage message={lastQuestionRef.current} />
                                <div className="rounded-2xl border bg-card shadow-sm p-4">
                                    <div className={styles.chatMessageGptMinWidth}>
                                        <AnswerError error={String(error)} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
                                    </div>
                                </div>
                            </>
                        ) : null}

                        <div ref={chatMessageStreamEnd} />
                    </div>
                )}

                {/* Sticky input — transparent wrapper, moved further down */}
                <div className={`${styles.chatInput} mt-10 md:mt-14`} style={{ background: "transparent", boxShadow: "none", border: "none" }}>
                    <QuestionInput
                        clearOnSend
                        placeholder={activePersona ? `Ask as “${activePersona.name}”. What would this customer say/ask?` : "Ask your persona anything..."}
                        disabled={isLoading}
                        onSend={question => makeApiRequest(question)}
                        showSpeechInput={showSpeechInput}
                    />
                </div>
            </div>

            {/* Panels */}
            {answers.length > 0 && activeAnalysisPanelTab && (
                <AnalysisPanel
                    className={styles.chatAnalysisPanel}
                    activeCitation={activeCitation}
                    onActiveTabChanged={x => setActiveAnalysisPanelTab(x)}
                    citationHeight="810px"
                    answer={answers[selectedAnswer][1]}
                    activeTab={activeAnalysisPanelTab}
                />
            )}

            {((useLogin && showChatHistoryCosmos) || showChatHistoryBrowser) && (
                <HistoryPanel
                    provider={historyProvider}
                    isOpen={isHistoryPanelOpen}
                    notify={!isStreaming && !isLoading}
                    onClose={() => setIsHistoryPanelOpen(false)}
                    onChatSelected={answers2 => {
                        if (answers2.length === 0) return;
                        setAnswers(answers2);
                        lastQuestionRef.current = answers2[answers2.length - 1][0];
                    }}
                />
            )}

            <Panel
                headerText={t("labels.headerText")}
                isOpen={isConfigPanelOpen}
                isBlocking={false}
                onDismiss={() => setIsConfigPanelOpen(false)}
                closeButtonAriaLabel={t("labels.closeButton")}
                onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>{t("labels.closeButton")}</DefaultButton>}
                isFooterAtBottom={true}
            >
                <Settings
                    promptTemplate={promptTemplate}
                    temperature={temperature}
                    retrieveCount={retrieveCount}
                    maxSubqueryCount={maxSubqueryCount}
                    resultsMergeStrategy={resultsMergeStrategy}
                    seed={seed}
                    minimumSearchScore={minimumSearchScore}
                    minimumRerankerScore={minimumRerankerScore}
                    useSemanticRanker={useSemanticRanker}
                    useSemanticCaptions={useSemanticCaptions}
                    useQueryRewriting={useQueryRewriting}
                    reasoningEffort={reasoningEffort}
                    excludeCategory={excludeCategory}
                    includeCategory={includeCategory}
                    retrievalMode={retrievalMode}
                    showMultimodalOptions={showMultimodalOptions}
                    sendTextSources={sendTextSources}
                    sendImageSources={sendImageSources}
                    searchTextEmbeddings={searchTextEmbeddings}
                    searchImageEmbeddings={searchImageEmbeddings}
                    showSemanticRankerOption={showSemanticRankerOption}
                    showQueryRewritingOption={showQueryRewritingOption}
                    showReasoningEffortOption={showReasoningEffortOption}
                    showVectorOption={showVectorOption}
                    useOidSecurityFilter={useOidSecurityFilter}
                    useGroupsSecurityFilter={useGroupsSecurityFilter}
                    useLogin={!!useLogin}
                    loggedIn={loggedIn}
                    requireAccessControl={requireAccessControl}
                    shouldStream={shouldStream}
                    streamingEnabled={streamingEnabled}
                    useSuggestFollowupQuestions={useSuggestFollowupQuestions}
                    showSuggestFollowupQuestions={true}
                    showAgenticRetrievalOption={showAgenticRetrievalOption}
                    useAgenticRetrieval={useAgenticRetrieval}
                    onChange={handleSettingsChange}
                />
                {useLogin && <TokenClaimsDisplay />}
            </Panel>
        </div>
    );
};

export default Chat;

import { useState, useEffect, useContext } from "react";
import { Stack, TextField } from "@fluentui/react";
import { Button, Tooltip } from "@fluentui/react-components";
import { Send28Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { SpeechInput } from "./SpeechInput";
import { LoginContext } from "../../loginContext";
import { requireLogin } from "../../authConfig";

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    initQuestion?: string;
    placeholder?: string;
    clearOnSend?: boolean;
    showSpeechInput?: boolean;

    /** NEW: callback when voice button clicked */
    onVoiceClick?: () => void;

    /** NEW: whether to show the voice button next to send */
    showVoiceButton?: boolean;

    /** NEW: render only the input field (no container/buttons) */
    bare?: boolean;
    inputClassName?: string;
}

export const QuestionInput = ({
    onSend,
    disabled,
    placeholder,
    clearOnSend,
    initQuestion,
    showSpeechInput,
    onVoiceClick,
    showVoiceButton = false,
    bare = false,
    inputClassName
}: Props) => {
    const [question, setQuestion] = useState<string>("");
    const { loggedIn } = useContext(LoginContext);
    const { t } = useTranslation();
    const [isComposing, setIsComposing] = useState(false);

    useEffect(() => {
        if (initQuestion) setQuestion(initQuestion);
    }, [initQuestion]);

    const sendQuestion = () => {
        if (disabled || !question.trim()) return;
        onSend(question.trim());
        if (clearOnSend) setQuestion("");
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (isComposing) return;
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const handleCompositionStart = () => setIsComposing(true);
    const handleCompositionEnd = () => setIsComposing(false);

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        if (!newValue) setQuestion("");
        else if (newValue.length <= 1000) setQuestion(newValue);
    };

    const disableRequiredAccessControl = requireLogin && !loggedIn;
    const sendQuestionDisabled = disabled || !question.trim() || disableRequiredAccessControl;

    if (disableRequiredAccessControl) {
        placeholder = "Please login to continue...";
    }

    // Bare mode (no wrapper UI)
    if (bare) {
        return (
            <TextField
                className={inputClassName}
                disabled={disableRequiredAccessControl}
                placeholder={placeholder}
                multiline
                resizable={false}
                borderless
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
            />
        );
    }

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            <TextField
                className={styles.questionInputTextArea}
                disabled={disableRequiredAccessControl}
                placeholder={placeholder}
                multiline
                resizable={false}
                borderless
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
            />
            <div className={styles.questionInputButtonsContainer}>
                <Tooltip content={t("tooltips.submitQuestion")} relationship="label">
                    <Button
                        className={styles.sendButton}
                        size="large"
                        icon={<Send28Filled primaryFill="#31343e" />}
                        disabled={sendQuestionDisabled}
                        onClick={sendQuestion}
                    />
                </Tooltip>

                {showVoiceButton && onVoiceClick && (
                    <Tooltip content={t("tooltips.voice")} relationship="label">
                        <Button
                            className={styles.voiceButton}
                            size="large"
                            icon={
                                // you can replace with your mic icon
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M12 14C13.6569 14 15 12.6569 15 11V5C15 3.34315 13.6569 2 12 2C10.3431 2 9 3.34315 9 5V11C9 12.6569 10.3431 14 12 14Z"
                                        fill="#31343e"
                                    />
                                    <path d="M19 11C19 14.3137 16.3137 17 13 17H11C7.68629 17 5 14.3137 5 11" stroke="#31343e" strokeWidth="2" />
                                    <path d="M12 17V21" stroke="#31343e" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            }
                            onClick={onVoiceClick}
                            disabled={disabled}
                        />
                    </Tooltip>
                )}
            </div>
            {showSpeechInput && <SpeechInput updateQuestion={setQuestion} />}
        </Stack>
    );
};

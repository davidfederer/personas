import { Link } from "react-router-dom";

type DisclaimerFooterProps = {
    className?: string;
};

/**
 * Lightweight footer used on high-traffic pages to remind users that AI content
 * may be inaccurate while linking to the full legal disclaimer.
 */
export function DisclaimerFooter({ className = "" }: DisclaimerFooterProps) {
    return (
        <div className={`mt-10 text-center text-xs text-neutral-500 ${className}`.trim()}>
            <p>
                AI-generated responses may be inaccurate or incomplete.{" "}
                <Link to="/disclaimer" className="underline font-medium hover:text-neutral-700">
                    Read the full disclaimer
                </Link>
                .
            </p>
        </div>
    );
}

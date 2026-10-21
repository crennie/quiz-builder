import { Fragment, useId, type ReactNode } from "react";
import styles from "../pages/course-pages.module.css";

import { parseLessonContent } from "./lesson-markdown";

function inline(text: string): ReactNode[] {
    return text
        .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\][\n]+\]\([^\s)]+\))/gu)
        .map((part, index) => {
            if (part.startsWith("`") && part.endsWith("`"))
                return <code key={index}>{part.slice(1, -1)}</code>;
            if (part.startsWith("**") && part.endsWith("**"))
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            if (part.startsWith("*") && part.endsWith("*"))
                return <em key={index}>{part.slice(1, -1)}</em>;
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(part);
            if (link && /^(https?:\/\/|mailto:)/iu.test(link[2]!))
                return (
                    <a key={index} href={link[2]} rel="noreferrer">
                        {link[1]}
                    </a>
                );
            return <Fragment key={index}>{part}</Fragment>;
        });
}

export function LessonContent({
    content,
    headingIdPrefix,
}: {
    content: string;
    headingIdPrefix?: string;
}) {
    const generatedId = useId();
    const blocks = parseLessonContent(content);
    return (
        <div className={styles.prose}>
            {blocks.map((block, index) => {
                switch (block.kind) {
                    case "heading": {
                        const Heading = `h${block.level}` as "h2" | "h3" | "h4" | "h5" | "h6";
                        return (
                            <Heading
                                id={`${headingIdPrefix ?? generatedId}-${block.id}`}
                                key={index}
                            >
                                {inline(block.text)}
                            </Heading>
                        );
                    }
                    case "code":
                        return (
                            <pre key={index}>
                                <code>{block.text}</code>
                            </pre>
                        );
                    case "quote":
                        return (
                            <blockquote key={index}>
                                <p>{inline(block.text)}</p>
                            </blockquote>
                        );
                    case "list":
                        return block.ordered ? (
                            <ol key={index} start={block.start}>
                                {block.items?.map((item, i) => (
                                    <li key={i}>{inline(item)}</li>
                                ))}
                            </ol>
                        ) : (
                            <ul key={index}>
                                {block.items?.map((item, i) => (
                                    <li key={i}>{inline(item)}</li>
                                ))}
                            </ul>
                        );
                    default:
                        return <p key={index}>{inline(block.text)}</p>;
                }
            })}
        </div>
    );
}

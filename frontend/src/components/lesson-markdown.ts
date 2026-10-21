// A deliberately small Markdown dialect. All source text is rendered through React;
// HTML, images, and active URL schemes are never interpreted.
type Block = {
    kind: "heading" | "paragraph" | "code" | "quote" | "list";
    text: string;
    level?: number;
    ordered?: boolean;
    start?: number | undefined;
    items?: string[];
    id?: string;
};
export function parseLessonContent(content: string): Block[] {
    const lines = content.replace(/\r\n?/gu, "\n").split("\n");
    const blocks: Block[] = [];
    let index = 0;
    const startsBlock = (line: string) => /^(#{1,6} |```|> |[-*+] |\d+\. )/u.test(line);
    while (index < lines.length) {
        const line = lines[index]!;
        if (!line.trim()) {
            index++;
            continue;
        }
        if (line.startsWith("```")) {
            const code: string[] = [];
            index++;
            while (index < lines.length && !lines[index]!.startsWith("```"))
                code.push(lines[index++]!);
            if (index < lines.length) index++;
            blocks.push({ kind: "code", text: code.join("\n") });
            continue;
        }
        const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
        if (heading) {
            blocks.push({
                kind: "heading",
                text: heading[2]!,
                level: Math.min(6, heading[1]!.length + 1),
                id: `section-${blocks.length}`,
            });
            index++;
            continue;
        }
        if (/^> /u.test(line)) {
            const quote: string[] = [];
            while (index < lines.length && /^> /u.test(lines[index]!))
                quote.push(lines[index++]!.slice(2));
            blocks.push({ kind: "quote", text: quote.join("\n") });
            continue;
        }
        const list = /^([-*+]|\d+\.) (.*)$/u.exec(line);
        if (list) {
            const ordered = /^\d/u.test(list[1]!);
            const matcher = ordered ? /^\d+\. (.*)$/u : /^[-*+] (.*)$/u;
            const items: string[] = [];
            while (index < lines.length) {
                const item = matcher.exec(lines[index]!);
                if (!item) break;
                items.push(item[1]!);
                index++;
            }
            blocks.push({
                kind: "list",
                text: "",
                ordered,
                start: ordered ? Number.parseInt(list[1]!, 10) : undefined,
                items,
            });
            continue;
        }
        const paragraph = [line];
        index++;
        while (index < lines.length && lines[index]!.trim() && !startsBlock(lines[index]!))
            paragraph.push(lines[index++]!);
        blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    }
    return blocks;
}

"use client";

import { useRef, useEffect, useState } from "react";
import { ParseError } from "@/types/messages";

interface ErrorHighlightTextareaProps {
    value: string;
    onChange: (value: string) => void;
    errors?: ParseError[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

interface HighlightRange {
    start: number;
    end: number;
    error: ParseError;
}

export default function ErrorHighlightTextarea({
    value,
    onChange,
    errors = [],
    placeholder,
    disabled,
    className = "",
}: ErrorHighlightTextareaProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [highlightRanges, setHighlightRanges] = useState<HighlightRange[]>([]);

    // Tìm vị trí của lỗi trong text
    useEffect(() => {
        if (!value || errors.length === 0) {
            setHighlightRanges([]);
            return;
        }

        const ranges: HighlightRange[] = [];

        for (const error of errors) {
            // Build search pattern: numbers followed by type alias
            const typeAliases: Record<string, string[]> = {
                'Đá xiên': ['dx', 'dax'],
                'Đá thẳng': ['dat', 'da'],
                'Đầu': ['dd', 'd'],
                'Đuôi': ['dt'],
                'Đầu đuôi': ['dd'],
                'Bao lô': ['bl', 'b'],
                'Xỉu chủ': ['xc'],
            };

            const aliases = error.type ? (typeAliases[error.type] || []) : [];
            const numbers = error.numbers || [];

            if (numbers.length === 0 && aliases.length === 0) continue;

            const lines = value.split('\n');
            let found = false;

            for (let lineIdx = 0; lineIdx < lines.length && !found; lineIdx++) {
                const line = lines[lineIdx];
                const lineLower = line.toLowerCase();
                const lineStart = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0);

                // Try to find pattern: any number from error.numbers followed by any alias
                for (const num of numbers) {
                    for (const alias of aliases) {
                        // Look for pattern: number + optional space + alias
                        // Example: "22b", "22 b", "22 bl"
                        const patterns = [
                            `${num}${alias}`,      // 22b
                            `${num} ${alias}`,     // 22 b
                        ];

                        for (const pattern of patterns) {
                            const pos = lineLower.indexOf(pattern.toLowerCase());
                            if (pos !== -1) {
                                const start = lineStart + pos;
                                const end = start + pattern.length;
                                ranges.push({ start, end, error });
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    if (found) break;
                }

                // If no pattern found, fallback to finding just the numbers
                if (!found && numbers.length > 0) {
                    for (const num of numbers) {
                        const pos = lineLower.indexOf(num.toLowerCase());
                        if (pos !== -1) {
                            const start = lineStart + pos;
                            const end = start + num.length;
                            ranges.push({ start, end, error });
                            found = true;
                            break;
                        }
                    }
                }
            }
        }

        setHighlightRanges(ranges);
    }, [value, errors]);

    // Update editor content when value changes externally
    useEffect(() => {
        if (editorRef.current && document.activeElement !== editorRef.current) {
            editorRef.current.innerHTML = renderHighlightedHTML();
        }
    }, [value, highlightRanges]);

    const renderHighlightedHTML = () => {
        if (!value) return '';
        if (highlightRanges.length === 0) {
            return value.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
        }

        const parts: string[] = [];
        let lastIndex = 0;

        const sortedRanges = [...highlightRanges].sort((a, b) => a.start - b.start);

        for (const range of sortedRanges) {
            if (range.start > lastIndex) {
                const text = value.substring(lastIndex, range.start);
                parts.push(text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;'));
            }

            const highlightedText = value.substring(range.start, range.end);
            parts.push(
                `<mark style="background-color: rgba(254, 226, 226, 0.6); border-bottom: 2px solid rgba(252, 165, 165, 0.8); border-radius: 2px; padding: 1px 2px;">${highlightedText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')}</mark>`
            );

            lastIndex = range.end;
        }

        if (lastIndex < value.length) {
            const text = value.substring(lastIndex);
            parts.push(text.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;'));
        }

        return parts.join('');
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const text = e.currentTarget.innerText;
        onChange(text);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleFocus = () => {
        if (editorRef.current) {
            // When focusing, show plain text for editing
            editorRef.current.innerText = value;
        }
    };

    const handleBlur = () => {
        if (editorRef.current) {
            // When blurring, restore highlighted HTML
            editorRef.current.innerHTML = renderHighlightedHTML();
        }
    };

    return (
        <div className={`relative ${className}`}>
            <div
                ref={editorRef}
                contentEditable={!disabled}
                onInput={handleInput}
                onPaste={handlePaste}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full outline-none"
                style={{
                    minHeight: 'inherit',
                    padding: '0.5rem 0.75rem',
                    lineHeight: '1.5',
                    fontSize: '0.875rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    color: disabled ? '#9ca3af' : 'inherit',
                }}
                suppressContentEditableWarning
            />
            {!value && placeholder && (
                <div
                    className="absolute inset-0 pointer-events-none text-gray-400"
                    style={{
                        padding: '0.5rem 0.75rem',
                        lineHeight: '1.5',
                        fontSize: '0.875rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                >
                    {placeholder}
                </div>
            )}
        </div>
    );
}

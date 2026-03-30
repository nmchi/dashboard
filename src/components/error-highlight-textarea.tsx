"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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

/**
 * Chuẩn hóa text để so sánh (lowercase, bỏ dấu tiếng Việt)
 */
function normalizeForSearch(text: string): string {
    return text
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, 'a')
        .replace(/[èéẻẽẹêềếểễệ]/g, 'e')
        .replace(/[ìíỉĩị]/g, 'i')
        .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, 'o')
        .replace(/[ùúủũụưừứửữự]/g, 'u')
        .replace(/[ỳýỷỹỵ]/g, 'y');
}

/**
 * Tìm vị trí của fragment trong raw text (tìm kiếm linh hoạt)
 * - Case-insensitive
 * - Bỏ dấu tiếng Việt
 * - Linh hoạt khoảng trắng (1 space trong fragment = 1+ spaces/separators trong raw)
 */
function findFragmentPosition(
    rawText: string,
    fragment: string,
    searchAfter: number = 0
): { start: number; end: number } | null {
    if (!fragment || !rawText) return null;

    const normalizedRaw = normalizeForSearch(rawText);
    const normalizedFragment = normalizeForSearch(fragment);

    // Tạo regex: thay thế khoảng trắng bằng \s+ cho linh hoạt
    const parts = normalizedFragment.split(/\s+/).map(p =>
        p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
    );
    const pattern = new RegExp(parts.join('\\s+'), 'g');

    // Tìm match sau vị trí searchAfter
    pattern.lastIndex = searchAfter;
    const match = pattern.exec(normalizedRaw);

    if (match) {
        return {
            start: match.index,
            end: match.index + match[0].length,
        };
    }

    return null;
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
    const [isFocused, setIsFocused] = useState(false);

    // Tìm vị trí lỗi trong text dựa trên rawFragment
    useEffect(() => {
        if (!value || errors.length === 0) {
            setHighlightRanges([]);
            return;
        }

        const ranges: HighlightRange[] = [];
        const usedPositions = new Set<string>(); // Tránh highlight trùng vị trí

        for (const error of errors) {
            const fragment = error.rawFragment;
            if (!fragment) continue;

            // Tìm vị trí fragment trong raw text
            let searchFrom = 0;
            let found = false;

            while (!found) {
                const pos = findFragmentPosition(value, fragment, searchFrom);
                if (!pos) break;

                const posKey = `${pos.start}-${pos.end}`;
                if (!usedPositions.has(posKey)) {
                    usedPositions.add(posKey);
                    ranges.push({ start: pos.start, end: pos.end, error });
                    found = true;
                } else {
                    // Vị trí đã dùng, tìm tiếp
                    searchFrom = pos.start + 1;
                }
            }
        }

        // Sắp xếp theo vị trí
        ranges.sort((a, b) => a.start - b.start);

        // Loại bỏ overlap
        const filtered: HighlightRange[] = [];
        for (const range of ranges) {
            const last = filtered[filtered.length - 1];
            if (!last || range.start >= last.end) {
                filtered.push(range);
            }
        }

        setHighlightRanges(filtered);
    }, [value, errors]);

    // Render HTML với highlight
    const renderHighlightedHTML = useCallback(() => {
        if (!value) return '';
        if (highlightRanges.length === 0) {
            return escapeAndFormat(value);
        }

        const parts: string[] = [];
        let lastIndex = 0;

        for (const range of highlightRanges) {
            // Text trước highlight
            if (range.start > lastIndex) {
                parts.push(escapeAndFormat(value.substring(lastIndex, range.start)));
            }

            // Text được highlight (tô đỏ)
            const highlightedText = value.substring(range.start, range.end);
            const tooltip = range.error.message.replace(/"/g, '&quot;');
            parts.push(
                `<mark style="background-color: rgba(254, 202, 202, 0.7); border-bottom: 2px solid #ef4444; border-radius: 2px; padding: 1px 2px; color: #dc2626;" title="${tooltip}">${escapeAndFormat(highlightedText)}</mark>`
            );

            lastIndex = range.end;
        }

        // Text sau highlight cuối
        if (lastIndex < value.length) {
            parts.push(escapeAndFormat(value.substring(lastIndex)));
        }

        return parts.join('');
    }, [value, highlightRanges]);

    // Update editor khi value hoặc highlights thay đổi từ bên ngoài
    useEffect(() => {
        if (!editorRef.current) return;
        // Không update khi đang focus để tránh làm mất vị trí con trỏ
        if (isFocused) return;
        // renderHighlightedHTML trả về '' khi value rỗng → tự xử lý cả 2 trường hợp
        editorRef.current.innerHTML = renderHighlightedHTML();
    }, [value, highlightRanges, renderHighlightedHTML, isFocused]);

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
        setIsFocused(true);
        // Chuyển từ highlighted HTML về plain text để con trỏ hoạt động đúng
        if (editorRef.current) {
            editorRef.current.innerText = value;
        }
    };

    const handleBlur = () => {
        // Chỉ cập nhật state, KHÔNG mutate DOM trực tiếp
        // useEffect sẽ set highlighted HTML sau khi isFocused = false
        setIsFocused(false);
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
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    color: disabled ? '#9ca3af' : 'inherit',
                    boxSizing: 'border-box',
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


            {/* Hiển thị danh sách lỗi bên dưới */}
            {errors.length > 0 && (
                <div className="mt-2 space-y-1">
                    {errors.map((error, idx) => (
                        <div
                            key={idx}
                            className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1.5"
                        >
                            <span className="shrink-0 mt-0.5">⚠️</span>
                            <span>{error.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Escape HTML và format cho hiển thị
 */
function escapeAndFormat(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/ /g, '&nbsp;');
}

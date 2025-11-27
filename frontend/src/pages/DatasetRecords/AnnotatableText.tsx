import { useRef, useMemo, useCallback } from 'react';
import type { SourceTerm, SourceTermCreate } from 'types';
import styles from './styles.module.css';

// ================================================
// Helper function
// ================================================

function getLabelColorClass(label: string, labels: string[]): string {
    const index = labels.indexOf(label);
    if (index === -1) return 'label1';
    return `label${(index % 9) + 1}`;
}

// ================================================
// Interface
// ================================================

export interface AnnotatableTextProps {
    text: string;
    labels: string[];
    annotations: SourceTerm[];
    selectedLabel: string | null;
    selectedAnnotation: number | null;
    onCreateAnnotation: (term: SourceTermCreate) => void;
    onSelectAnnotation: (id: number | null) => void;
    isAnnotating: boolean;
}

// ================================================
// Component
// ================================================

const AnnotatableText = ({
    text,
    labels,
    annotations,
    selectedLabel,
    selectedAnnotation,
    onCreateAnnotation,
    onSelectAnnotation,
    isAnnotating,
}: AnnotatableTextProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Build segments from text and annotations
    const segments = useMemo(() => {
        if (!annotations.length) {
            return [{ type: 'text' as const, content: text, start: 0, end: text.length }];
        }

        // Filter terms with valid positions and sort by start position
        const validTerms = annotations
            .filter(t => t.start_position !== null && t.end_position !== null)
            .sort((a, b) => (a.start_position ?? 0) - (b.start_position ?? 0));

        if (!validTerms.length) {
            return [{ type: 'text' as const, content: text, start: 0, end: text.length }];
        }

        const result: Array<
            | { type: 'text'; content: string; start: number; end: number }
            | { type: 'annotation'; content: string; term: SourceTerm; start: number; end: number }
        > = [];
        let lastEnd = 0;

        for (const term of validTerms) {
            const start = term.start_position ?? 0;
            const end = term.end_position ?? 0;

            // Skip overlapping terms
            if (start < lastEnd) continue;

            // Add text before this term
            if (start > lastEnd) {
                result.push({
                    type: 'text',
                    content: text.slice(lastEnd, start),
                    start: lastEnd,
                    end: start,
                });
            }

            // Add the annotation
            result.push({
                type: 'annotation',
                content: text.slice(start, end),
                term,
                start,
                end,
            });

            lastEnd = end;
        }

        // Add remaining text
        if (lastEnd < text.length) {
            result.push({
                type: 'text',
                content: text.slice(lastEnd),
                start: lastEnd,
                end: text.length,
            });
        }

        return result;
    }, [text, annotations]);

    // Handle text selection
    const handleMouseUp = useCallback(() => {
        if (!isAnnotating || !selectedLabel) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const container = containerRef.current;
        if (!container) return;

        // Check if selection is within our container
        if (!container.contains(range.commonAncestorContainer)) {
            return;
        }

        // Calculate the actual position in the original text
        // We need to traverse the DOM to find the correct offset
        const getTextOffset = (node: Node, offset: number): number => {
            let totalOffset = 0;
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                null
            );

            let currentNode: Node | null = walker.nextNode();
            while (currentNode) {
                if (currentNode === node) {
                    return totalOffset + offset;
                }
                totalOffset += currentNode.textContent?.length ?? 0;
                currentNode = walker.nextNode();
            }
            return totalOffset;
        };

        // Get the selected text's position
        const startOffset = getTextOffset(range.startContainer, range.startOffset);
        const endOffset = getTextOffset(range.endContainer, range.endOffset);

        // Get the selected text value
        const selectedText = text.slice(startOffset, endOffset).trim();
        if (!selectedText) {
            selection.removeAllRanges();
            return;
        }

        // Adjust offsets for trimmed text
        const trimmedStart = startOffset + (text.slice(startOffset, endOffset).indexOf(selectedText));
        const trimmedEnd = trimmedStart + selectedText.length;

        // Check for overlaps with existing annotations
        const hasOverlap = annotations.some(ann => {
            if (ann.start_position === null || ann.end_position === null) return false;
            return (trimmedStart < ann.end_position && trimmedEnd > ann.start_position);
        });

        if (hasOverlap) {
            selection.removeAllRanges();
            return;
        }

        // Create the annotation
        onCreateAnnotation({
            value: selectedText,
            label: selectedLabel,
            start_position: trimmedStart,
            end_position: trimmedEnd,
        });

        // Clear selection
        selection.removeAllRanges();
    }, [isAnnotating, selectedLabel, text, annotations, onCreateAnnotation]);

    // Handle click on annotation
    const handleAnnotationClick = useCallback((termId: number, e: React.MouseEvent) => {
        if (!isAnnotating) return;
        e.stopPropagation();
        onSelectAnnotation(selectedAnnotation === termId ? null : termId);
    }, [isAnnotating, selectedAnnotation, onSelectAnnotation]);

    // Handle click on container to deselect
    const handleContainerClick = useCallback(() => {
        if (selectedAnnotation !== null) {
            onSelectAnnotation(null);
        }
    }, [selectedAnnotation, onSelectAnnotation]);

    return (
        <div
            ref={containerRef}
            className={`${styles.annotatableText} ${isAnnotating ? styles.annotating : ''}`}
            onMouseUp={handleMouseUp}
            onClick={handleContainerClick}
        >
            {segments.map((segment, idx) =>
                segment.type === 'text' ? (
                    <span key={idx}>{segment.content}</span>
                ) : (
                    <span
                        key={idx}
                        className={`${styles.highlightedTerm} ${styles[getLabelColorClass(segment.term.label, labels)]} ${selectedAnnotation === segment.term.id ? styles.selectedAnnotation : ''}`}
                        title={`${segment.term.label}: ${segment.term.value}`}
                        onClick={(e) => handleAnnotationClick(segment.term.id, e)}
                    >
                        {segment.content}
                    </span>
                )
            )}
            {isAnnotating && !selectedLabel && (
                <div className={styles.annotationHint}>
                    Select a label from the sidebar to start annotating
                </div>
            )}
        </div>
    );
};

export default AnnotatableText;


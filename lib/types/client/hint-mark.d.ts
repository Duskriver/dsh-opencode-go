/**
 * The hint mark a label carries and the sentence behind it.
 *
 * The Host's own Tooltip opens the sentence on hover and on keyboard focus, while
 * the same sentence stays in the document so assistive technology reads it without
 * opening anything. A Host that ships no question glyph still gets a mark, and a
 * Host with no Tooltip keeps the sentence visible instead of hiding it.
 */
/** The mark beside a label. Decorative: the sentence is {@link HintText}. */
export declare function HintMark(props: {
    hint: string;
}): import("react").JSX.Element;
/** The hint sentence, at the id a control points its `aria-describedby` at. */
export declare function HintText(props: {
    id: string;
    hint: string;
}): import("react").JSX.Element;

/**
 * Free text in a table cell that can run long — a description.
 *
 * Table cells do not wrap (`whitespace-nowrap` in `ui/table.tsx`), so one long
 * description made the whole table as wide as itself: on a phone every row
 * scrolled sideways for the sake of a single sentence. Cut to 16rem here, and
 * whole on hover.
 *
 * Used as `cell: ({ getValue }) => <TruncatedText value={getValue()} />`, so
 * the column keeps its own row type.
 */
export function TruncatedText({ value }: { value: unknown }) {
  const text = value == null ? "" : String(value);
  return <span className="block max-w-64 truncate" title={text}>{text}</span>;
}

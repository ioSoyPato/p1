import { BlockMath, InlineMath } from "react-katex";

export function Eq({ children }: { children: string }) {
  return (
    <div style={{ margin: "1.1em 0", overflowX: "auto" }}>
      <BlockMath math={children} />
    </div>
  );
}

export function EqInline({ children }: { children: string }) {
  return <InlineMath math={children} />;
}

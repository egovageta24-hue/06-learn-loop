import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: (p) => <h2 className="mt-8 mb-3 text-2xl font-bold tracking-tight first:mt-0" {...p} />,
  h2: (p) => <h2 className="mt-8 mb-3 text-xl font-bold tracking-tight first:mt-0" {...p} />,
  h3: (p) => <h3 className="mt-6 mb-2 text-lg font-bold first:mt-0" {...p} />,
  p: (p) => <p className="my-4 leading-relaxed first:mt-0 last:mb-0" {...p} />,
  ul: (p) => <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-primary" {...p} />,
  ol: (p) => <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
  blockquote: (p) => <blockquote className="my-4 border-l-4 border-primary/40 bg-secondary/40 py-2 pl-4 italic" {...p} />,
  a: (p) => <a className="font-medium text-primary underline underline-offset-2" {...p} />,
  code: (p) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]" {...p} />,
  hr: () => <hr className="my-8" />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-base text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

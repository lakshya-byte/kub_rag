"use client";

import type { ReactNode } from "react";
import type { Block, Section as SectionData } from "@/docs/types";
import { Diagram } from "./diagrams";
import { Callout, CodeBlock, Deep, DocTable, EnvTable, GlossaryList, Inline, Quiz, TroubleList } from "./ui";

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Item key={i} b={b} />
      ))}
    </>
  );
}

function Item({ b }: { b: Block }): ReactNode {
  switch (b.t) {
    case "p":
      return (
        <p className="docs-prose">
          <Inline text={b.text} />
        </p>
      );
    case "h":
      return <h3 className="pt-3 font-serif text-2xl font-semibold text-ink">{b.text}</h3>;
    case "list": {
      const L = b.ordered ? "ol" : "ul";
      return (
        <L className={`docs-prose space-y-2 pl-6 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-ink-faint`}>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline text={it} />
            </li>
          ))}
        </L>
      );
    }
    case "code":
      return <CodeBlock code={b.code} lang={b.lang} file={b.file} />;
    case "callout":
      return <Callout tone={b.tone} title={b.title} text={b.text} />;
    case "table":
      return <DocTable head={b.head} rows={b.rows} />;
    case "diagram":
      return (
        <figure className="space-y-2">
          <Diagram name={b.name} />
          {b.caption && <figcaption className="text-sm text-ink-faint">{b.caption}</figcaption>}
        </figure>
      );
    case "quiz":
      return <Quiz q={b.q} options={b.options} answer={b.answer} why={b.why} />;
    case "deep":
      return (
        <Deep title={b.title}>
          <Blocks blocks={b.blocks} />
        </Deep>
      );
    case "env":
      return <EnvTable />;
    case "troubleshooting":
      return <TroubleList />;
    case "glossary":
      return <GlossaryList />;
  }
}

export default function Section({ s }: { s: SectionData }) {
  return (
    <section id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28 space-y-6 py-14 first:pt-4">
      <header className="max-w-[41rem]">
        <h2 id={`${s.id}-h`} className="font-serif text-[2.1rem] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {s.title}
        </h2>
        <p className="mt-2 font-serif text-xl italic text-ink-soft">{s.summary}</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-faint" aria-label="What you will learn">
          {s.learn.map((l) => (
            <li key={l} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      </header>
      <Blocks blocks={s.blocks} />
    </section>
  );
}

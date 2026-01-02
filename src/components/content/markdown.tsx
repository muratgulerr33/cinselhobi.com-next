import type React from "react";

type MarkdownProps = {
  body: string;
};

export function Markdown({ body }: MarkdownProps) {
  const lines = body.split("\n");
  const elements: React.ReactElement[] = [];
  let currentParagraph: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(" ").trim();
      if (text) {
        elements.push(
          <p key={elements.length} className="text-sm leading-6 text-foreground/90">
            {text}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc pl-5 text-sm leading-6 text-foreground/90">
          {listItems.map((item, idx) => (
            <li key={idx}>{item.trim()}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Boş satır
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    // H1 başlık
    if (trimmed.startsWith("# ")) {
      flushList();
      flushParagraph();
      elements.push(
        <h1 key={elements.length} className="text-2xl font-semibold">
          {trimmed.slice(2).trim()}
        </h1>
      );
      continue;
    }

    // H2 başlık
    if (trimmed.startsWith("## ")) {
      flushList();
      flushParagraph();
      elements.push(
        <h2 key={elements.length} className="text-xl font-semibold">
          {trimmed.slice(3).trim()}
        </h2>
      );
      continue;
    }

    // H3 başlık
    if (trimmed.startsWith("### ")) {
      flushList();
      flushParagraph();
      elements.push(
        <h3 key={elements.length} className="text-lg font-semibold">
          {trimmed.slice(4).trim()}
        </h3>
      );
      continue;
    }

    // Liste öğesi
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        inList = true;
      }
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    // Normal paragraf satırı
    flushList();
    currentParagraph.push(trimmed);
  }

  // Kalanları flush et
  flushList();
  flushParagraph();

  return <div className="space-y-4">{elements}</div>;
}


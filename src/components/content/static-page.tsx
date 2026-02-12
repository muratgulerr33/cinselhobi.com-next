import { Markdown } from "./markdown";

type StaticPageProps = {
  title: string;
  body: string;
};

export function StaticPage({ title, body }: StaticPageProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="mt-4">
          <Markdown body={body} />
        </div>
      </div>
    </div>
  );
}


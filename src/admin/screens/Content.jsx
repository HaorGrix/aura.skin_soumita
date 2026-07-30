/* skin.script admin — CMS slot index. Every editable region of the
 * storefront, grouped by where it appears. */
import { ChevronRight, FileText } from "lucide-react";
import { listBlocks } from "../../lib/api/admin/content.js";
import { SLOT_GROUPS } from "../../lib/api/admin/schemas.js";
import { adminNavigate } from "../AdminApp.jsx";
import { PageHeader, Pill, Spinner, useAsync } from "../components/kit.jsx";

export default function Content() {
  const blocks = useAsync(() => listBlocks(), []);

  if (blocks.loading) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        title="Content & banners"
        subtitle="Edit the words and images on your storefront. Changes go live as soon as you save — no developer needed."
      />

      {blocks.error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{blocks.error.message}</p>
      )}

      <div className="space-y-6">
        {SLOT_GROUPS.map((group) => {
          const items = (blocks.data ?? []).filter((b) => b.group === group);
          if (!items.length) return null;
          return (
            <section key={group}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{group}</h2>
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {items.map((b) => (
                  <button key={b.slot} onClick={() => adminNavigate(`/admin/content/${encodeURIComponent(b.slot)}`)}
                    className="flex w-full items-center gap-3 border-b border-line/60 px-5 py-4 text-left last:border-0 hover:bg-snow">
                    <FileText className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{b.label}</p>
                      {b.help && <p className="truncate text-xs text-ink-soft">{b.help}</p>}
                    </div>
                    {/* "Not set up" is the honest state for a slot that exists in
                        code but has never been saved — it renders its defaults. */}
                    {!b.exists && <Pill tone="amber">Using defaults</Pill>}
                    {b.updatedAt && (
                      <span className="hidden text-[11px] text-ink-soft sm:block">
                        Edited {new Date(b.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

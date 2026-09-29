/* =================================================================== *
 * skin.theory admin — Reviews
 * -------------------------------------------------------------------
 * Every product review written by a verified buyer from their order
 * history. They go live straight away; hide one (spam, abuse, wrong
 * product) and it leaves the product page and its star rating at once.
 * =================================================================== */
import { useState } from "react";
import { Star } from "lucide-react";
import { useAdmin } from "../context.js";
import { listReviews, setReviewStatus } from "../../lib/api/admin/reviews.js";
import { Btn, Card, PageHeader, Pill, SelectField, Spinner, useAsync } from "../components/kit.jsx";

const PAGE_SIZE = 25;

export default function Reviews() {
  const { can } = useAdmin();
  const canModerate = can("editor");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const list = useAsync(() => listReviews({ status, page, pageSize: PAGE_SIZE }), [status, page]);
  const pages = Math.max(1, Math.ceil((list.count ?? 0) / PAGE_SIZE));

  async function change(review, next) {
    setBusyId(review.id);
    setError(null);
    const { error: e } = await setReviewStatus(review.id, next);
    setBusyId(null);
    if (e) setError(`Couldn't update the review: ${e.message}`);
    else list.reload();
  }

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Written by verified buyers from their order history. They appear on the product page straight away — hide any that shouldn't be there."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SelectField
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="w-48"
          options={[
            { id: "", label: "All reviews" },
            { id: "approved", label: "Shown" },
            { id: "rejected", label: "Hidden" },
          ]}
        />
        <span className="text-sm text-ink-soft">{list.count ?? 0} review{list.count === 1 ? "" : "s"}</span>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {list.error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">Couldn&apos;t load reviews: {list.error.message}</p>}

      {list.loading ? (
        <div className="grid place-items-center py-16"><Spinner className="h-6 w-6" /></div>
      ) : (list.data ?? []).length === 0 ? (
        <Card><p className="text-sm text-ink-soft">No reviews yet. Buyers can review items once their order is marked Delivered.</p></Card>
      ) : (
        <div className="space-y-3">
          {list.data.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-soft">
                    {r.product ? <a href={`/product/${r.product.slug}`} target="_blank" rel="noopener" className="font-medium text-ink hover:text-magenta">{r.product.brand} — {r.product.name}</a> : "Deleted product"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex" aria-label={`${r.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className="h-3.5 w-3.5" strokeWidth={0} fill={n <= r.rating ? "var(--color-gold)" : "var(--color-line)"} />
                      ))}
                    </span>
                    {r.status === "rejected" ? <Pill tone="grey">Hidden</Pill> : <Pill tone="green">Shown</Pill>}
                  </div>
                  {r.title && <p className="mt-2 text-sm font-semibold text-ink">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {r.display_name} · {r.email} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {canModerate && (
                  r.status === "rejected"
                    ? <Btn size="sm" variant="secondary" loading={busyId === r.id} onClick={() => change(r, "approved")}>Show again</Btn>
                    : <Btn size="sm" variant="secondary" loading={busyId === r.id} onClick={() => change(r, "rejected")}>Hide</Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <Btn size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
          <span className="text-ink-soft">Page {page + 1} of {pages}</span>
          <Btn size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Btn>
        </div>
      )}
    </>
  );
}

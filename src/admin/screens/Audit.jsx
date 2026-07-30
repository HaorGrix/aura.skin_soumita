/* =================================================================== *
 * skin.script admin — audit log (owner only)
 * -------------------------------------------------------------------
 * Append-only at the database level: there is no UPDATE or DELETE policy
 * on audit_log for any role, including owner. Each entry stores only the
 * keys that changed, with before/after values.
 * =================================================================== */
import { useState } from "react";
import { listAudit } from "../../lib/api/admin/settings.js";
import {
  DataTable, Modal, PageHeader, Pill, SearchInput, SelectField, money, useAsync,
} from "../components/kit.jsx";

const TABLES = [
  "products", "product_images", "categories", "coupons", "sales",
  "content_blocks", "store_settings", "profiles", "orders",
];

const ACTION_TONE = { insert: "green", update: "sky", delete: "red" };

export default function Audit() {
  const [table, setTable] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);

  const list = useAsync(() => listAudit({ table, search, page }), [table, search, page]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change made in this panel, who made it, and what changed. This log cannot be edited or deleted by anyone."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }}
          placeholder="Filter by who made the change…" className="sm:col-span-2" />
        <SelectField value={table} onChange={(e) => { setTable(e.target.value); setPage(0); }}
          placeholder="Everything" options={TABLES.map((t) => ({ id: t, label: t.replace(/_/g, " ") }))} />
      </div>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data} total={list.count}
        page={page} pageSize={50} onPage={setPage} onRowClick={setDetail}
        empty="Nothing recorded yet."
        columns={[
          { key: "created_at", header: "When", render: (r) => (
              <span className="text-ink-soft">{new Date(r.created_at).toLocaleString()}</span>
            ) },
          { key: "actor_email", header: "Who", render: (r) => r.actor_email || "system" },
          { key: "action", header: "Action", render: (r) => (
              <Pill tone={ACTION_TONE[r.action]}>{r.action}</Pill>
            ) },
          { key: "table_name", header: "What", render: (r) => (
              <span className="text-ink-soft">{r.table_name.replace(/_/g, " ")}</span>
            ) },
          { key: "fields", header: "Fields changed", render: (r) => (
              <span className="text-xs text-ink-soft">{Object.keys(r.diff ?? {}).slice(0, 3).join(", ") || "—"}</span>
            ) },
        ]}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} wide title="Change details">
        {detail && (
          <>
            <div className="mb-4 space-y-1 text-sm">
              <p className="text-ink-soft">By <span className="text-ink">{detail.actor_email || "system"}</span></p>
              <p className="text-ink-soft">On <span className="text-ink">{new Date(detail.created_at).toLocaleString()}</span></p>
              <p className="text-ink-soft">Record <span className="font-mono text-xs text-ink">{detail.record_id}</span></p>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line">
                <tr>
                  <th className="py-2 font-semibold text-ink-soft">Field</th>
                  <th className="py-2 font-semibold text-ink-soft">Before</th>
                  <th className="py-2 font-semibold text-ink-soft">After</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(detail.diff ?? {}).map(([key, v]) => (
                  <tr key={key} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-medium text-ink">{key.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 text-red-600">{renderValue(key, v.from)}</td>
                    <td className="py-2 text-emerald-700">{renderValue(key, v.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </>
  );
}

/** Money columns are stored in paisa — showing "199900" in an audit trail
 *  is technically accurate and practically useless. */
function renderValue(key, value) {
  if (value == null) return <span className="text-ink-soft">empty</span>;
  if (key.endsWith("_minor")) return money(value);
  if (typeof value === "object") return <code className="text-[10px]">{JSON.stringify(value)}</code>;
  return String(value);
}

/* Admin session context — kept in its own module (not AdminApp.jsx) so
 * screens can import `useAdmin` without pulling the whole route table and
 * its lazy imports into their chunk. */
import { createContext, useContext } from "react";

export const AdminContext = createContext(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminApp>");
  return ctx;
}

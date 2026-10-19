import { lazy } from "react";
import { createBrowserRouter } from "react-router";

// Every route is code-split; heavy pages (React Flow, Recharts) stay out of the landing bundle.
const AppShell = lazy(() => import("@/components/app/app-shell").then((m) => ({ default: m.AppShell })));
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Transactions = lazy(() => import("@/pages/transactions"));
const RunAnalysis = lazy(() => import("@/pages/run-analysis"));
const ReviewQueue = lazy(() => import("@/pages/review-queue"));
const DecisionTrace = lazy(() => import("@/pages/decision-trace"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));
const Ask = lazy(() => import("@/pages/ask"));
const AuditLog = lazy(() => import("@/pages/audit-log"));
const Evaluation = lazy(() => import("@/pages/evaluation"));
const NotFound = lazy(() => import("@/pages/not-found"));

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "transactions", element: <Transactions /> },
      { path: "analysis", element: <RunAnalysis /> },
      { path: "review", element: <ReviewQueue /> },
      { path: "decisions/:id", element: <DecisionTrace /> },
      { path: "knowledge", element: <KnowledgeBase /> },
      { path: "ask", element: <Ask /> },
      { path: "audit", element: <AuditLog /> },
      { path: "evaluation", element: <Evaluation /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound standalone /> },
]);

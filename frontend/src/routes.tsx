import { lazy } from "react";
import { createBrowserRouter } from "react-router";

// Every route is code-split; heavy pages (React Flow, Recharts) stay out of the landing bundle.
const AppShell = lazy(() => import("@/components/app/app-shell").then((m) => ({ default: m.AppShell })));
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Transactions = lazy(() => import("@/pages/transactions"));
const RunAnalysis = lazy(() => import("@/pages/run-analysis"));
const ReviewQueue = lazy(() => import("@/pages/review-queue"));
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
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound standalone /> },
]);

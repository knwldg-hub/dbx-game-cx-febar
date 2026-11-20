import { createBrowserRouter, RouterProvider, NavLink, Navigate, Outlet } from 'react-router';
import { useState } from 'react';
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { Menu } from 'lucide-react';
import { RiskQueuePage } from './pages/console/RiskQueuePage';
import { Player360Page } from './pages/console/Player360Page';
import { FraudRingsPage } from './pages/console/FraudRingsView';
import { ExecutiveOverviewPage } from './pages/console/ExecutiveOverviewPage';
import { AskGeniePage } from './pages/console/AskGeniePage';
import { useJson, type WhoAmI } from './lib/useJson';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

type NavLinkClassFn = (props: { isActive: boolean }) => string;

function NavLinks({ className, linkClass, onClick }: { className?: string; linkClass: NavLinkClassFn; onClick?: () => void }) {
  return (
    <nav className={className}>
      <NavLink to="/" end className={linkClass} onClick={onClick}>
        Executive Overview
      </NavLink>
      <NavLink to="/risk-queue" className={linkClass} onClick={onClick}>
        Risk Queue
      </NavLink>
      <NavLink to="/fraud-rings" className={linkClass} onClick={onClick}>
        Fraud Rings
      </NavLink>
      <NavLink to="/ask/trust" className={linkClass} onClick={onClick}>
        Ask Trust &amp; Safety
      </NavLink>
      <NavLink to="/ask/experience" className={linkClass} onClick={onClick}>
        Ask Player Experience
      </NavLink>
    </nav>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const me = useJson<WhoAmI>('/api/whoami');
  const who = me.data?.email ?? me.data?.user ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">Emberline Player Console</h1>
        {/* Desktop nav — hidden below md breakpoint */}
        <NavLinks className="hidden md:flex gap-1" linkClass={navLinkClass} />
        {who && (
          <Badge variant="outline" className="hidden md:inline-flex ml-auto">
            {who}
          </Badge>
        )}
        {/* Mobile nav — visible below md breakpoint */}
        <div className="ml-auto md:hidden">
          {/* Gate on isMobile so the portaled sheet can't linger on desktop
              (replaces a set-state-in-effect reset). */}
          <Sheet open={mobileNavOpen && isMobile} onOpenChange={setMobileNavOpen}>
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <NavLinks className="flex flex-col gap-1" linkClass={mobileNavLinkClass} onClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <ExecutiveOverviewPage /> },
      { path: '/risk-queue', element: <RiskQueuePage /> },
      { path: '/player/:playerId', element: <Player360Page /> },
      { path: '/fraud-rings', element: <FraudRingsPage /> },
      { path: '/kpis', element: <Navigate to="/" replace /> },
      {
        path: '/ask/trust',
        element: (
          <AskGeniePage
            alias="trust"
            title="Ask Trust & Safety"
            spaceName="Emberline - Fraud & Trust Safety"
            description="Fraud, chargebacks, toxicity, and player reports."
            sampleQuestions={[
              'What is the chargeback rate for each game?',
              'How many players are recommended for suspension?',
              'How many open recommendations are there by action?',
              'How many moderator actions were taken by type?',
              'How many suspected cheaters are high-value players?',
              'Show me the top 10 largest fraud rings.',
            ]}
          />
        ),
      },
      {
        path: '/ask/experience',
        element: (
          <AskGeniePage
            alias="experience"
            title="Ask Player Experience"
            spaceName="Emberline - Player Experience & LiveOps"
            description="Engagement, churn, sessions, and live-ops events."
            sampleQuestions={[
              'What are DAU, MAU and stickiness for the last 30 days?',
              'How many high-value players are at risk?',
              'Which live-ops event type generates the most revenue?',
              'Which game has the highest average session duration?',
              'How many suspected cheaters are there by game?',
              'What is the top acquisition channel by player count?',
            ]}
          />
        ),
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

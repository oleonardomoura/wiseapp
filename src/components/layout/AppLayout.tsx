import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { AppHeader } from './AppHeader';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile nav */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Fixed header */}
      <AppHeader />

      {/* Main content - mobile: no margin, desktop: follow sidebar width */}
      <main className="min-h-screen transition-all duration-300 pt-16 pb-20 md:pb-0 md:[margin-left:var(--sidebar-width,256px)]">
        <div className="mx-auto max-w-7xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

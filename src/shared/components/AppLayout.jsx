import { Outlet } from 'react-router-dom';
import TopBar from './TopBar.jsx';
import BottomNavigation from '../../features/navigation/components/BottomNavigation.jsx';

/**
 * Layout for the bottom-tab pages: a fixed brand bar, a scrollable content
 * area, and a fixed bottom navigation. Full-screen wizard pages skip this.
 */
export default function AppLayout() {
  return (
    <div className="relative flex h-full flex-col bg-paper">
      <TopBar />
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}

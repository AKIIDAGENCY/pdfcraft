import type { PropsWithChildren } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Shell({ children }: PropsWithChildren) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}

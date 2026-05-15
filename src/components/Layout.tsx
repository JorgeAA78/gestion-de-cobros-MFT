import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastContainer } from './Toast';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <>
            <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="app-container">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
            <ToastContainer />
        </>
    );
}

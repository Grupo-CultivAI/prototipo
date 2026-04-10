import Sidebar from '@/components/Sidebar';

export default function AuthedLayout({ children }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-text)' }}>
            <Sidebar />
            <main style={{ flex: 1, padding: '3rem 2rem', overflowY: 'auto' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', height: '100%', animation: 'fadeIn 0.5s ease' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}

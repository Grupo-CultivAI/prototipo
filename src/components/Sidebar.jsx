"use client"
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import folha from "@/assets/leaves-of-a-plant.png";

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = async () => {
        localStorage.removeItem("usuarioLogado");
        localStorage.removeItem("usuarioNome");
        document.cookie = "authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        router.push("/login");
    };

    const isActive = (path) => pathname === path
        ? { background: 'var(--primary-dark)', color: 'white', fontWeight: '600', boxShadow: '0 4px 12px rgba(6,64,43,0.15)' }
        : { color: 'var(--text-secondary)' };

    return (
        <aside style={{
            width: '280px',
            height: '100vh',
            backgroundColor: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 40
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '2.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ background: 'var(--primary-dark)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={folha} alt="Logo CultivAI" width={24} height={24} style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>CultivAI</h2>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Premium</span>
                </div>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                <Link href="/chatbot" style={{ padding: '1rem', borderRadius: '12px', textDecoration: 'none', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem', ...isActive('/chatbot') }}
                    onMouseOver={(e) => { if (pathname !== '/chatbot') e.target.style.background = 'var(--bg)' }}
                    onMouseOut={(e) => { if (pathname !== '/chatbot') e.target.style.background = 'transparent' }}>
                    <span style={{ fontSize: '1.2rem' }}>🤖</span> Assistente AI
                </Link>
                <Link href="/perfil-propriedade" style={{ padding: '1rem', borderRadius: '12px', textDecoration: 'none', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem', ...isActive('/perfil-propriedade') }}
                    onMouseOver={(e) => { if (pathname !== '/perfil-propriedade') e.target.style.background = 'var(--bg)' }}
                    onMouseOut={(e) => { if (pathname !== '/perfil-propriedade') e.target.style.background = 'transparent' }}>
                    <span style={{ fontSize: '1.2rem' }}>🌾</span> Meu Cultivo
                </Link>
                <Link href="/conta" style={{ padding: '1rem', borderRadius: '12px', textDecoration: 'none', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem', ...isActive('/conta') }}
                    onMouseOver={(e) => { if (pathname !== '/conta') e.target.style.background = 'var(--bg)' }}
                    onMouseOut={(e) => { if (pathname !== '/conta') e.target.style.background = 'transparent' }}>
                    <span style={{ fontSize: '1.2rem' }}>👤</span> Minha Conta
                </Link>
            </nav>

            <div style={{ marginTop: 'auto' }}>
                <button
                    onClick={handleLogout}
                    style={{ width: '100%', padding: '1rem', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FEE2E2', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onMouseOver={(e) => { e.target.style.background = '#FEE2E2'; e.target.style.transform = 'translateY(-2px)' }}
                    onMouseOut={(e) => { e.target.style.background = '#FEF2F2'; e.target.style.transform = 'translateY(0)' }}
                >
                    Sair da Conta
                </button>
            </div>
        </aside>
    );
}

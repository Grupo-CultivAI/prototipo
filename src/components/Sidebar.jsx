"use client"
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { House, MessageCircle, Sprout, CircleUser, Mail, LogOut } from 'lucide-react';
import folha from "@/assets/leaves-of-a-plant.png";
import { EMAIL_DO_PROJETO, linkFaleConosco } from '@/lib/faleConosco';
import styles from './Sidebar.module.css';

// Ícones de traço (lucide), os mesmos da página inicial e do Painel: os emojis mudavam de
// desenho em cada aparelho e davam um ar pouco sério à navegação.
const LINKS = [
    { href: '/painel', icone: House, rotulo: 'Início' },
    { href: '/chatbot', icone: MessageCircle, rotulo: 'Assistente AI' },
    { href: '/meus-cultivos', icone: Sprout, rotulo: 'Meus Cultivos' },
    { href: '/conta', icone: CircleUser, rotulo: 'Minha Conta' },
];

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();

    // O cookie de sessão é httpOnly: só o servidor consegue apagá-lo (ver /api/auth/logout).
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            router.replace("/login");
            router.refresh();
        }
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.marca}>
                <div style={{ background: 'var(--primary-dark)', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={folha} alt="Logo CultivAI" width={24} height={24} style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--primary-dark)', letterSpacing: '-0.5px' }}>CultivAI</h2>
            </div>

            <nav className={styles.nav}>
                {LINKS.map(({ href, icone: Icone, rotulo }) => (
                    <Link key={href} href={href} className={`${styles.link} ${pathname === href || pathname.startsWith(`${href}/`) ? styles.ativo : ''}`}>
                        <Icone size={20} aria-hidden="true" className={styles.icone} /> <span className={styles.rotulo}>{rotulo}</span>
                    </Link>
                ))}
                {/* Para contar um problema ou uma resposta errada; o email já vai com a tela atual */}
                <a href={linkFaleConosco(pathname)} className={styles.link} title={`Escrever para ${EMAIL_DO_PROJETO}`}>
                    <Mail size={20} aria-hidden="true" className={styles.icone} /> <span className={styles.rotulo}>Fale conosco</span>
                </a>
            </nav>

            <div className={styles.rodape}>
                <button onClick={handleLogout} className={styles.sair}>
                    <LogOut size={20} aria-hidden="true" className={styles.iconeSair} />
                    <span className={styles.rotulo}>Sair da Conta</span>
                </button>
            </div>
        </aside>
    );
}

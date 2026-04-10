"use client"

import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {

  const [menuAberto, setMenuAberto] = useState(false)
  const router = useRouter()

  function redefinirFormulario() {
    localStorage.removeItem("cultivAI_user_input")
    router.push("/perfil-propriedade")
    setMenuAberto(false)
  }

  return (
    <nav style={{
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      height: "76px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 5%",
      borderBottom: "1px solid var(--border)",
      color: "var(--text-primary)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      boxShadow: "var(--shadow-sm)"
    }}>

      {/* LOGO */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
        <div style={{ background: 'var(--primary-dark)', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Image src={folha} alt="Logo CultivAI" width={28} height={28} style={{ filter: 'brightness(0) invert(1)' }} />
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-title)', color: 'var(--primary-dark)' }}>CultivAI</span>
      </Link>

      {/* NAVIGATION / RIGHT UTILS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link href="/login" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: '500', transition: 'color 0.2s', fontSize: '1rem' }}
          onMouseOver={(e) => e.target.style.color = 'var(--primary-dark)'}
          onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}>
          Entrar
        </Link>
        <Link href="/cadastro" style={{ textDecoration: 'none', background: 'var(--primary)', color: 'white', padding: '0.6rem 1.4rem', borderRadius: '30px', fontWeight: '600', transition: 'all 0.3s', boxShadow: 'var(--shadow-sm)' }}
          onMouseOver={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'var(--shadow-sm)'; }}>
          Começar
        </Link>
      </div>
    </nav>
  )
}
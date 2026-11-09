"use client"

import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Botao from "@/components/ui/Botao";
import BotaoTema from "@/components/BotaoTema";
import styles from "./Navbar.module.css";

// Seções da página inicial (src/app/(public)/page.js)
const SECOES = [
  { href: "/#o-que-faz", texto: "O que faz" },
  { href: "/#como-funciona", texto: "Como funciona" },
  { href: "/#duvidas", texto: "Dúvidas" },
  { href: "/#sobre", texto: "Sobre o projeto" },
];

export default function Navbar() {

  const [menuAberto, setMenuAberto] = useState(false)
  const router = useRouter()
  const naInicial = usePathname() === "/"

  function redefinirFormulario() {
    localStorage.removeItem("cultivAI_user_input")
    router.push("/meus-cultivos")
    setMenuAberto(false)
  }

  return (
    <nav className={styles.topo}>

      {/* LOGO: o nome some da vista quando falta espaço (ver .marcaTexto), mas segue como nome do link */}
      <Link href="/" className={styles.marca}>
        <span className={styles.logo}>
          <Image src={folha} alt="" width={28} height={28} style={{ filter: 'brightness(0) invert(1)' }} />
        </span>
        <span className={styles.marcaTexto}>CultivAI</span>
      </Link>

      {naInicial && (
        <div className={styles.secoes}>
          {SECOES.map((s) => <a key={s.href} href={s.href}>{s.texto}</a>)}
        </div>
      )}

      {/* NAVIGATION / RIGHT UTILS */}
      <div className={styles.acoes}>
        <BotaoTema variante="discreto" apenasIcone />
        <Link href="/login" className={styles.entrar}>Entrar</Link>
        <Botao href="/cadastro" pilula>Criar conta</Botao>
      </div>
    </nav>
  )
}
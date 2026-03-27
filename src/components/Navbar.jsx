"use client"

import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar(){

  const [menuAberto, setMenuAberto] = useState(false)
  const router = useRouter()

  function redefinirFormulario(){

    // remove apenas os dados do formulário
    localStorage.removeItem("cultivAI_user_input")

    // redireciona para o formulário
    router.push("/perfil-propriedade")

    // fecha o menu
    setMenuAberto(false)
  }

  return(

    <nav style={{
      background:"#06402B",
      height:"70px",
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      padding:"0 20px",
      color:"white",
      position:"relative",
      zIndex: 20
    }}>

      {/* LOGO */}
      <Link href="/">
        <Image
          src={folha}
          alt="Logo CultivAI"
          width={40}
          height={40}
        />
      </Link>

      {/* BOTÃO MENU */}
      <div 
        style={{fontSize:"24px", cursor:"pointer"}}
        onClick={()=>setMenuAberto(!menuAberto)}
      >
        ☰
      </div>

      {/* MENU */}
      {menuAberto && (
        <div style={{
          position:"absolute",
          top:"70px",
          right:"20px",
          background:"white",
          color:"#424242",
          borderRadius:"8px",
          padding:"10px",
          boxShadow:"0px 4px 10px rgba(0,0,0,0.2)",
          display:"flex",
          flexDirection:"column",
          gap:"10px",
          minWidth:"180px"
        }}>

          {/* INÍCIO */}
          <Link href="/" onClick={()=>setMenuAberto(false)}>
            🏠 Tela inicial
          </Link>

          {/* RESET FORMULÁRIO */}
          <button
            onClick={redefinirFormulario}
            style={{
              background:"none",
              border:"none",
              textAlign:"left",
              cursor:"pointer",
              fontSize:"14px"
            }}
          >
            🔄 Redefinir formulário
          </button>

        </div>
      )}

    </nav>

  )

}
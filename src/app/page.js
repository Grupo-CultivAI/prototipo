import Card from "@/components/Card";
import Button from "@/components/Button";
import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";

export default function Home(){

  return(

    <div>

       <div style={{
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        gap:"10px",
        marginBottom:"20px"
      }}>

        <Image
          src={folha}
          alt="Logo CultivAI"
          width={50}
          height={50}
        />

        <h1>CultivAI</h1>

      </div>

      <h3 style={{textAlign:"center"}}>
        Bem-vindo ao CultivAI!
      </h3>

      {/* TEXTO PEQUENO */}

      <div className="small-text" style={{
        textAlign:"center",
        marginBottom:"25px"
      }}>
        <p>Um sistema inteligente que auxilia</p>
        <p>agricultores na rotação sustentável</p> 
        <p>de culturas.</p>
      </div>

      <Link href="/login">
        <Button text="Entrar"/>
      </Link>
            <br/>
      <Link href="/cadastro">
        <Button text="Cadastrar"/>
      </Link>
    </div>

  )

}
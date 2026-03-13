import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";

export default function Navbar(){

  return(

    <nav style={{
      background:"#06402B",
      height:"70px",
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      padding:"0 20px",
      color:"white"
    }}>
      <Link href="/">
        <Image
         src={folha}
          alt="Logo CultivAI"
          width={40}
          height={40}
        />
      </Link>


      <div style={{fontSize:"24px"}}>
        ☰
      </div>

    </nav>

  )

}
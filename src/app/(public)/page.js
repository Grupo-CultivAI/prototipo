import Image from "next/image";
import folha from "@/assets/leaves-of-a-plant.png";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 70px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #06402B 0%, #1e6c4a 100%)', color: 'white', padding: '2rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
          <Image src={folha} alt="Logo CultivAI" width={80} height={80} style={{ filter: 'brightness(0) invert(1)' }} />
          <h1 style={{ fontSize: '3.5rem', fontWeight: '800', margin: 0 }}>CultivAI</h1>
        </div>

        <p style={{ fontSize: '1.2rem', textAlign: 'center', maxWidth: '600px', lineHeight: '1.6', opacity: 0.9, marginBottom: '3rem' }}>
          Bem-vindo ao sistema de inteligência agrícola que revoluciona o campo. Auxiliamos produtores e agricultores na rotação e no manejo sustentável de suas culturas utilizando os dados precisos da sua propriedade para garantir máxima eficiência! 🌱
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '450px' }}>
          <Link href="/login" style={{ flex: 1, display: 'block' }}>
            <button style={{ width: '100%', padding: '1.2rem', background: 'white', color: '#06402B', borderRadius: '8px', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0px 4px 15px rgba(0,0,0,0.1)' }}>
              Faça Login
            </button>
          </Link>
          <Link href="/cadastro" style={{ flex: 1, display: 'block' }}>
            <button style={{ width: '100%', padding: '1.2rem', background: 'transparent', color: 'white', borderRadius: '8px', border: '2px solid white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
              Criar Conta
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
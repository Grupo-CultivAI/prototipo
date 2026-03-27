"use client";
import { useRouter } from 'next/navigation';
import styles from './perfil.module.css';

export default function PerfilPropriedade() {
    const router = useRouter();

    const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const dados = {
        tamanho: formData.get("tamanho") || "Não informado",
        tipoSolo: formData.get("tipoSolo") || "Não informado",
        culturas: formData.get("culturas") || "Não informado",
        objetivo: formData.get("objetivo") || "Não informado"
    };

    localStorage.setItem(
        "cultivAI_user_input",
        JSON.stringify(dados)
    );

    router.push('/chatbot');
};

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.iconContainer}>
                    {/* Ícone opcional simulando o botão de tema da tela de login */}
                    <button className={styles.themeBtn}>📋</button>
                </div>
                
                <div className={styles.header}>
                    <h2>Perfil da Terra</h2>
                    <p>Insira as características da sua propriedade para recomendações de rotação.</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label>Tamanho da Propriedade (Hectares)</label>
                        <input type="number" name="tamanho" placeholder="Ex: 50" required />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Tipo de Solo Predominante</label>
                        <select name ="tipoSolo" required>
                            <option value="">Selecione...</option>
                            <option value="argiloso">Argiloso</option>
                            <option value="arenoso">Arenoso</option>
                            <option value="siltoso">Siltoso</option>
                            <option value="misto">Misto</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Culturas Atuais / Anteriores</label>
                        <input type="text" name="culturas" placeholder="Ex: Soja, Milho, Algodão" required />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Objetivo Principal</label>
                        <select name="objetivo" required>
                            <option value="">Selecione...</option>
                            <option value="rentabilidade">Aumento de Lucro</option>
                            <option value="recuperacao">Recuperação de Nutrientes</option>
                            <option value="pragas">Controle de Pragas</option>
                        </select>
                    </div>

                    <button type="submit" className={styles.submitBtn}>
                        Continuar para o Chatbot
                    </button>
                </form>
            </div>
        </div>
    );
}

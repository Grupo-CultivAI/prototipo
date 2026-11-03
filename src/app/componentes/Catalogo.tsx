"use client";
import { useState, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, X, Volume2, MessageCircle, ArrowRight, MapPin } from 'lucide-react';
import Botao, { type VarianteBotao, type TamanhoBotao } from '@/components/ui/Botao';
import Aviso from '@/components/ui/Aviso';
import Selo from '@/components/ui/Selo';
import ConfirmarNaTela from '@/components/ui/ConfirmarNaTela';
import { Entrada, Selecao, AreaTexto } from '@/components/ui/Campo';
import Opcoes, { Marcar } from '@/components/ui/Opcoes';
import Bloco from '@/components/ui/Bloco';
import BarraDeAcoes, { TextoAdaptavel } from '@/components/ui/BarraDeAcoes';
import styles from './catalogo.module.css';

const VARIANTES: VarianteBotao[] = ['principal', 'secundario', 'neutro', 'discreto', 'perigo', 'perigoDiscreto', 'claro'];
const TAMANHOS: TamanhoBotao[] = ['p', 'm', 'g'];
// Os tokens de cor, como em src/styles/variables.css
const CORES: Record<string, string[]> = {
    Marca: ['--primary', '--primary-dark', '--primary-medium', '--primary-tint-weak', '--primary-tint', '--primary-tint-strong', '--primary-line', '--primary-soft'],
    Neutros: ['--white', '--bg', '--surface', '--surface-muted', '--border', '--placeholder', '--text-primary', '--text-secondary'],
    Estados: ['--erro', '--erro-forte', '--erro-fundo', '--erro-borda', '--aviso', '--aviso-icone', '--aviso-fundo', '--aviso-borda', '--info'],
    Gráficos: ['--risco-20', '--risco-30', '--risco-40', '--risco-nenhum', '--mapa-destaque'],
};
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section className={styles.secao}>
            <h2>{titulo}</h2>
            {children}
        </section>
    );
}

export default function Catalogo() {
    const [confirmar, setConfirmar] = useState<'' | 'linha' | 'faixa' | 'falha'>('');
    const [culturas, setCulturas] = useState<string[]>(['Milho']);
    const [aberto, setAberto] = useState('um');
    const [ligado, setLigado] = useState(false);

    return (
        <main className={styles.pagina}>
            <h1>Componentes do CultivAI</h1>
            <p className={styles.intro}>
                Cada componente de <code>src/components/ui</code> em todas as variações. Esta página só existe no <code>npm run dev</code>.
                As regras de uso estão em <code>docs/design-system.md</code>.
            </p>

            <Secao titulo="Cores (tokens de src/styles/variables.css)">
                {Object.entries(CORES).map(([grupo, tokens]) => (
                    <div key={grupo} className={styles.grupoCores}>
                        <h3>{grupo}</h3>
                        <ul className={styles.cores}>
                            {tokens.map((t) => (
                                <li key={t}><span className={styles.amostra} style={{ background: `var(${t})` }} /><code>{t}</code></li>
                            ))}
                        </ul>
                    </div>
                ))}
            </Secao>

            <Secao titulo="Botao">
                <table className={styles.tabela}>
                    <thead><tr><th>variante</th>{TAMANHOS.map((t) => <th key={t}>tamanho {t}</th>)}</tr></thead>
                    <tbody>
                        {VARIANTES.map((v) => (
                            <tr key={v} className={v === 'claro' ? styles.fundoEscuro : undefined}>
                                <th><code>{v}</code></th>
                                {TAMANHOS.map((t) => <td key={t}><Botao variante={v} tamanho={t}>Salvar</Botao></td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className={styles.linha}>
                    <Botao icone={Plus} pilula>Com ícone e pílula</Botao>
                    <Botao variante="neutro" iconeDepois={ArrowRight}>Ícone depois</Botao>
                    <Botao variante="discreto" apenasIcone icone={Volume2} rotulo="Ouvir a resposta" />
                    <Botao variante="discreto" apenasIcone icone={X} rotulo="Tirar" tamanho="p" />
                    <Botao variante="neutro" aria-pressed={ligado} onClick={() => setLigado((x) => !x)}>{ligado ? 'Ligado' : 'Desligado'} (aria-pressed)</Botao>
                    <Botao carregando textoCarregando="Salvando...">Salvar</Botao>
                    <Botao disabled>Desativado</Botao>
                    <Botao href="/componentes" variante="secundario" icone={MessageCircle}>É um link</Botao>
                </div>
            </Secao>

            <Secao titulo="Aviso">
                <div className={styles.coluna}>
                    <Aviso tipo="erro">Não foi possível salvar. Confira a internet e tente de novo.</Aviso>
                    <Aviso tipo="alerta" papel="note">Esta resposta não consultou os documentos da Embrapa.</Aviso>
                    <Aviso tipo="sucesso">Cultivo salvo.</Aviso>
                    <Aviso tipo="info" papel={null}>Digite o CEP para preencher o estado e a cidade.</Aviso>
                </div>
            </Secao>

            <Secao titulo="Selo">
                <div className={styles.linha}>
                    <Selo tipo="ok">Completo</Selo>
                    <Selo tipo="falta">Faltam 2</Selo>
                    <Selo tipo="erro">Corrigir</Selo>
                    <Selo>Opcional</Selo>
                    <Selo tipo="destaque" icone={false}>próxima</Selo>
                </div>
            </Secao>

            <Secao titulo="ConfirmarNaTela">
                <div className={styles.coluna}>
                    {confirmar === '' && (
                        <div className={styles.linha}>
                            <Botao variante="perigoDiscreto" tamanho="p" icone={Trash2} onClick={() => setConfirmar('linha')}>Excluir (linha)</Botao>
                            <Botao variante="perigoDiscreto" tamanho="p" icone={Trash2} onClick={() => setConfirmar('faixa')}>Apagar (faixa)</Botao>
                            <Botao variante="perigoDiscreto" tamanho="p" icone={Trash2} onClick={() => setConfirmar('falha')}>Excluir (que falha)</Botao>
                        </div>
                    )}
                    {confirmar === 'linha' && <ConfirmarNaTela pergunta="Excluir este cultivo? Suas conversas continuam." rotuloConfirmar="Excluir"
                        aoConfirmar={async () => { await espera(800); setConfirmar(''); }} aoCancelar={() => setConfirmar('')} />}
                    {confirmar === 'faixa' && <ConfirmarNaTela aparencia="faixa" tamanho="m" icone={Trash2} pergunta="Apagar esta conversa? Não dá para desfazer."
                        rotuloConfirmar="Apagar" aoConfirmar={async () => { await espera(800); setConfirmar(''); }} aoCancelar={() => setConfirmar('')} />}
                    {confirmar === 'falha' && <ConfirmarNaTela pergunta="Excluir? (o servidor vai falhar)" rotuloConfirmar="Excluir"
                        aoConfirmar={async () => { await espera(600); throw new Error('Não deu para excluir agora. Tente de novo.'); }} aoCancelar={() => setConfirmar('')} />}
                </div>
            </Secao>

            <Secao titulo="Campo: Entrada, Selecao e AreaTexto">
                <div className={styles.grade}>
                    <Entrada rotulo="Nome do cultivo" obrigatorio placeholder="Ex.: Sítio Boa Vista" dica="Aparece na lista e no chat." />
                    <Entrada rotulo="CEP" opcional placeholder="00000-000" inputMode="numeric" />
                    <Entrada rotulo="Estado" obrigatorio erro="Estado é obrigatório." />
                    <Entrada rotulo="Senha" type="password" acessorio={<a href="#">Esqueci a senha</a>} />
                    <Selecao rotulo="Tipo de solo"><option>Não sei</option><option>Arenoso</option></Selecao>
                    <Entrada rotulo="Linha compacta" compacto placeholder="compacto" />
                    <AreaTexto rotulo="Observações" opcional rows={3} className={styles.inteira} />
                </div>
            </Secao>

            <Secao titulo="Opcoes e Marcar">
                <div className={styles.coluna}>
                    <Opcoes rotulo="Culturas dos últimos anos" opcoes={['Milho', 'Feijão', 'Soja', 'Mandioca']} marcadas={culturas}
                        alternar={(c) => setCulturas((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c]))} />
                    <div className={styles.grade}>
                        <Marcar defaultChecked>Recuperar solo</Marcar>
                        <Marcar>Reduzir custos</Marcar>
                    </div>
                </div>
            </Secao>

            <Secao titulo="Bloco">
                <div className={styles.coluna}>
                    <Bloco id="um" titulo="1. Localização e Clima" descricao="Aberto: verde, com o conteúdo embaixo." icone={MapPin}
                        aberto={aberto === 'um'} aoAlternar={(id) => setAberto(aberto === id ? '' : id)} situacao={{ tipo: 'falta', texto: 'Falta 1' }}>
                        <p>Conteúdo do bloco.</p>
                    </Bloco>
                    <Bloco id="dois" titulo="2. Solo" descricao="Fechado: mostra a situação sem abrir." icone={Pencil}
                        aberto={aberto === 'dois'} aoAlternar={(id) => setAberto(aberto === id ? '' : id)} situacao={{ tipo: 'ok', texto: 'Completo' }}>
                        <p>Outro conteúdo.</p>
                    </Bloco>
                </div>
            </Secao>

            <Secao titulo="BarraDeAcoes (presa no pé da tela ao rolar)">
                <BarraDeAcoes mensagem="Dados salvos!">
                    <Botao variante="secundario" tamanho="g" pilula>Cadastrar</Botao>
                    <Botao tamanho="g" pilula><TextoAdaptavel longo="Salvar e pedir análise à IA" curto="Salvar e analisar" /></Botao>
                </BarraDeAcoes>
            </Secao>
        </main>
    );
}

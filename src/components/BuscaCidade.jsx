"use client";
import { useEffect, useId, useMemo, useState } from "react";
import styles from "@/app/(authed)/paginas.module.css";

// Campo de cidade com busca, filtrado pelo estado. A lista vem de public/municipios/<UF>.json
// (gerada do IBGE por scripts/gerar-municipios.mjs). Só aceita cidade da lista: o código do
// IBGE é o que o ZARC usa para achar o município.

const listas = new Map(); // UF → Promise da lista, para não baixar duas vezes
const carregar = (uf) => {
  if (!listas.has(uf)) {
    listas.set(uf, fetch(`/municipios/${uf}.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).catch((e) => { listas.delete(uf); throw e; }));
  }
  return listas.get(uf);
};

const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const NA_LISTA = 50;
const VAZIA = [];

export default function BuscaCidade({ uf, valor, codigo, aoEscolher, estilo, invalido }) {
  const id = useId();
  const [municipios, setMunicipios] = useState({ uf: null, lista: [], erro: false });
  // null = mostrando a cidade escolhida; texto = o produtor está digitando
  const [digitando, setDigitando] = useState(null);
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    if (!uf) return;
    let vale = true;
    carregar(uf)
      .then((lista) => vale && setMunicipios({ uf, lista, erro: false }))
      .catch(() => vale && setMunicipios({ uf, lista: [], erro: true }));
    return () => { vale = false; };
  }, [uf]);

  const lista = municipios.uf === uf ? municipios.lista : VAZIA;

  // Perfil antigo, com a cidade digitada: se o nome bate com um da lista, ganha o código.
  useEffect(() => {
    if (!valor || codigo || !lista.length) return;
    const igual = lista.find((m) => semAcento(m.n) === semAcento(valor));
    if (igual) aoEscolher({ nome: igual.n, codigo: igual.c, automatico: true });
  }, [valor, codigo, lista, aoEscolher]);

  const texto = digitando ?? valor ?? "";
  const encontradas = useMemo(() => {
    const busca = semAcento(digitando ?? "");
    if (!busca) return lista;
    const comeca = [], contem = [];
    for (const m of lista) {
      const nome = semAcento(m.n);
      if (nome.startsWith(busca)) comeca.push(m);
      else if (nome.includes(busca)) contem.push(m);
    }
    return [...comeca, ...contem];
  }, [lista, digitando]);
  const visiveis = encontradas.slice(0, NA_LISTA);

  const escolher = (m) => {
    aoEscolher({ nome: m.n, codigo: m.c });
    setDigitando(null);
    setAberta(false);
  };

  // Ao sair do campo: nome digitado igual a um da lista vale como escolha; senão fica o texto,
  // sem código, e o formulário pede para escolher na lista.
  const sair = () => {
    setAberta(false);
    if (digitando === null) return;
    const igual = lista.find((m) => semAcento(m.n) === semAcento(digitando));
    if (igual) escolher(igual);
    else {
      aoEscolher({ nome: digitando.trim(), codigo: "" });
      setDigitando(null);
    }
  };

  const teclado = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAberta(true); setAtivo((a) => Math.min(a + 1, visiveis.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && aberta && visiveis[ativo]) { e.preventDefault(); escolher(visiveis[ativo]); }
    else if (e.key === "Escape") { setAberta(false); setDigitando(null); }
  };

  const idLista = `${id}-cidades`;
  return (
    <div className={styles.buscaCidade}>
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberta && visiveis.length > 0}
        aria-controls={idLista}
        aria-activedescendant={aberta && visiveis[ativo] ? `${id}-${visiveis[ativo].c}` : undefined}
        aria-invalid={invalido || undefined}
        autoComplete="off"
        disabled={!uf}
        placeholder={!uf ? "Escolha o estado primeiro" : "Digite para buscar a cidade"}
        value={texto}
        onChange={(e) => { setDigitando(e.target.value); setAberta(true); setAtivo(0); }}
        // Seleciona a cidade atual: o que for digitado substitui, em vez de ir para o meio dela
        onFocus={(e) => { e.target.select(); if (uf) setAberta(true); }}
        onBlur={sair}
        onKeyDown={teclado}
        style={estilo}
      />
      {aberta && uf && (
        <ul id={idLista} role="listbox" className={styles.listaCidades}>
          {municipios.erro && <li className={styles.semCidade}>Não foi possível carregar as cidades. Confira a internet e tente de novo.</li>}
          {!municipios.erro && municipios.uf !== uf && <li className={styles.semCidade}>Carregando cidades...</li>}
          {!municipios.erro && municipios.uf === uf && !visiveis.length && <li className={styles.semCidade}>Nenhuma cidade de {uf} com esse nome.</li>}
          {visiveis.map((m, i) => (
            <li
              key={m.c}
              id={`${id}-${m.c}`}
              role="option"
              aria-selected={i === ativo}
              className={i === ativo ? styles.cidadeAtiva : undefined}
              // mousedown, e não click: o click chegaria depois do blur, com a lista já fechada
              onMouseDown={(e) => { e.preventDefault(); escolher(m); }}
              onMouseEnter={() => setAtivo(i)}
            >
              {m.n}
            </li>
          ))}
          {encontradas.length > NA_LISTA && <li className={styles.semCidade}>Mais {encontradas.length - NA_LISTA} cidades: continue digitando.</li>}
        </ul>
      )}
    </div>
  );
}

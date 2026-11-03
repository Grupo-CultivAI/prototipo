"use client";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import Botao from "@/components/ui/Botao";
import styles from "./MapaDoPonto.module.css";

// Mapa do formulário do cultivo para marcar o ponto exato da área (opcional). Mapa do
// OpenStreetMap, pelo Leaflet. Abre na cidade escolhida; o produtor toca no lugar, arrasta o
// marcador ou usa a localização do celular (bom quando ele está na própria área).
// valor: { lat, lng } ou null. centro: { lat, lng } do município, ou null.
const BRASIL = { lat: -14.2, lng: -51.9 };
const arredondar = ({ lat, lng }) => ({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });

export default function MapaDoPonto({ valor, centro, aoMudar }) {
  const caixaRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorRef = useRef(null);
  const leafletRef = useRef(null);
  const aoMudarRef = useRef(aoMudar);
  // O mapa abre antes de o cultivo carregar: quando o ponto salvo chega, o mapa vai até ele uma
  // vez. Depois disso (ou depois de um toque no mapa), ele não muda de lugar sozinho.
  const posicionadoRef = useRef(false);
  const [status, setStatus] = useState("");

  useEffect(() => { aoMudarRef.current = aoMudar; });

  // O Leaflet usa window: é carregado só no navegador.
  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !caixaRef.current || mapaRef.current) return;
      leafletRef.current = L;
      const inicio = valor ?? centro ?? BRASIL;
      posicionadoRef.current = Boolean(valor);
      const mapa = L.map(caixaRef.current, { scrollWheelZoom: false }).setView([inicio.lat, inicio.lng], valor ? 15 : centro ? 11 : 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      mapa.on("click", (e) => {
        posicionadoRef.current = true;
        aoMudarRef.current(arredondar(e.latlng));
      });
      mapaRef.current = mapa;
    });
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // Só na montagem: depois, valor e centro são acompanhados pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcador acompanha o valor (clique, arrasto, localização, ou o cultivo carregado).
  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    if (!valor) {
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      return;
    }
    if (!marcadorRef.current) {
      const icone = L.divIcon({ className: styles.marcador, iconSize: [22, 22], iconAnchor: [11, 11] });
      marcadorRef.current = L.marker([valor.lat, valor.lng], { icon: icone, draggable: true, keyboard: false })
        .on("dragend", (e) => aoMudarRef.current(arredondar(e.target.getLatLng())))
        .addTo(mapa);
    } else {
      marcadorRef.current.setLatLng([valor.lat, valor.lng]);
    }
    if (!posicionadoRef.current) {
      mapa.setView([valor.lat, valor.lng], 15);
      posicionadoRef.current = true;
    }
  }, [valor]);

  // Cidade escolhida (ou trocada) sem ponto marcado: o mapa vai até ela.
  useEffect(() => {
    if (centro && !valor && mapaRef.current) mapaRef.current.setView([centro.lat, centro.lng], 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro?.lat, centro?.lng]);

  const usarLocalizacao = () => {
    if (!navigator.geolocation) { setStatus("Este aparelho não informa a localização."); return; }
    setStatus("Buscando a sua localização...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const ponto = arredondar({ lat: coords.latitude, lng: coords.longitude });
        posicionadoRef.current = true;
        aoMudarRef.current(ponto);
        mapaRef.current?.setView([ponto.lat, ponto.lng], 16);
        setStatus(`Ponto marcado onde você está (precisão de uns ${Math.round(coords.accuracy)} m).`);
      },
      () => setStatus("Não deu para pegar a localização. Confira se o navegador tem permissão, ou toque no mapa."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className={styles.caixa}>
      <div ref={caixaRef} className={styles.mapa} role="application" aria-label="Mapa para marcar o ponto da área" />
      <div className={styles.acoes}>
        <Botao variante="secundario" tamanho="p" icone={LocateFixed} onClick={usarLocalizacao}>Usar minha localização</Botao>
        {valor && (
          <Botao variante="neutro" tamanho="p" icone={X} onClick={() => { aoMudarRef.current(null); setStatus(""); }}>Tirar o ponto</Botao>
        )}
        <span className={styles.status} role="status">
          {status || (valor ? `Ponto marcado: ${valor.lat.toFixed(5)}, ${valor.lng.toFixed(5)}. Arraste para ajustar.` : "Toque no mapa no lugar da sua área.")}
        </span>
      </div>
    </div>
  );
}

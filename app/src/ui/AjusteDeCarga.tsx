import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ajustarCargaVezes, ATRASO_DO_REPEAT_MS, INTERVALO_DO_REPEAT_MS } from '../dominio/marcarSerie';
import { textoDoPasso } from '../dominio/unidadeDeCarga';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { CampoDeCarga } from './CampoDeCarga';
import { sobre } from './sobre';
import { useUnidadeDeCarga } from './unidadeDeCargaEmUso';

/**
 * "−" e "+" da carga, de passo em passo do arredondamento da metodologia. `passo` é esse arredondamento em kg; o rótulo mostra o
 * passo na unidade do aluno (`passoNaTela`: em libra, múltiplo de 2,5 lb) e quem chama soma o mesmo passo com `ajustarCarga(..., unidade)`.
 * O sinal fica só no ícone (o rótulo "− 0,5 kg" com o ícone de menos mostrava o sinal duas vezes).
 */
export function AjusteDeCarga({ passo, rotulo, aoAjustar }: { passo: number; rotulo: string; aoAjustar: (sentido: 1 | -1) => void }) {
  const texto = textoDoPasso(passo, useUnidadeDeCarga());
  return (
    <View style={estilos.linha}>
      <Botao rotulo={texto} rotuloAcessivel={`Diminuir ${texto} em ${rotulo}`} tipo="secundario" Icone={Minus} aoTocar={() => aoAjustar(-1)} />
      <Botao rotulo={texto} rotuloAcessivel={`Aumentar ${texto} em ${rotulo}`} tipo="secundario" Icone={Plus} aoTocar={() => aoAjustar(1)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  passo: { width: 52, height: 52, borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  passoEstreito: { width: 44 },
  stepper: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5), minWidth: 0 },
  campo: { flex: 1, minWidth: 0 },
});

/**
 * Um lado do ajuste, quadrado e só com o ícone, para ficar ao lado do campo (carga de trabalho): `[−] campo [+]` cabe
 * numa linha em 360 px, e o leitor de tela ouve "Diminuir 0,5 kg em …".
 */
export function BotaoDePasso({ sentido, passo, rotulo, aoAjustar, aoPressionar, aoSoltar, estreito }: {
  sentido: 1 | -1; passo: number; rotulo: string; aoAjustar: (sentido: 1 | -1) => void;
  /** Segurar para repetir (`StepperDeCarga`): começo e fim do toque; o `aoAjustar` continua sendo o do toque comum. */
  aoPressionar?: () => void;
  aoSoltar?: () => void;
  /** 44 × 52 (ao lado do campo da série, onde a linha de 390 px não cabe com 52 × 52). */
  estreito?: boolean;
}) {
  const { cores } = useTema();
  const texto = textoDoPasso(passo, useUnidadeDeCarga());
  const Icone = sentido === 1 ? Plus : Minus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sentido === 1 ? 'Aumentar' : 'Diminuir'} ${texto} em ${rotulo}`}
      onPress={() => aoAjustar(sentido)}
      onPressIn={aoPressionar}
      onPressOut={aoSoltar}
      style={(estado) => [estilos.passo, estreito && estilos.passoEstreito, { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) ? cores.sobre : cores.campo }]}>
      <Icone size={22} color={cores.texto} strokeWidth={2.5} />
    </Pressable>
  );
}

/**
 * `[−] campo [+]` da carga (tela do exercício, 25/11): cada toque soma um passo; segurar repete (espera
 * `ATRASO_DO_REPEAT_MS`, depois um passo a cada `INTERVALO_DO_REPEAT_MS`). Durante o segurar o número só muda na tela e
 * vai uma vez para quem grava, ao soltar: cada passo gravado seria um registro ou um rascunho a cada 100 ms. A conta parte
 * do valor do começo do toque (`ajustarCargaVezes`), nunca do estado da tela (que chega atrasado).
 *
 * Teclado e leitor de tela: o react-native-web chama `onPressIn` no keydown e `onPress` no keyup; o TalkBack só o
 * `onPress`. O passo do toque é dado uma vez só: no `onPressIn` quando ele vem, senão no `onPress`.
 */
export function StepperDeCarga({ valorKg, sugestaoKg, passo, rotulo, rotuloDoCampo, aoMudarKg, aoValidade, placeholder, ajuda, estreito }: {
  valorKg: number | null;
  /** De onde o primeiro passo parte com o campo vazio (a sugestão; sem ela, 0). */
  sugestaoKg: number | null;
  /** `null` = sem botões (só o campo). */
  passo: number | null;
  /** "carga da série 2" (nome dos botões: "Aumentar 0,5 kg em carga da série 2"). */
  rotulo: string;
  /** Nome acessível do campo ("Carga da série 2"); a unidade por extenso entra no `CampoDeCarga`. */
  rotuloDoCampo: string;
  aoMudarKg: (kg: number | null) => void;
  aoValidade?: (valido: boolean) => void;
  placeholder?: string;
  ajuda?: string;
  estreito?: boolean;
}) {
  const unidade = useUnidadeDeCarga();
  // O que a tela mostra enquanto o botão está apertado (`null` = o valor de fora).
  const [naTela, setNaTela] = useState<number | null>(null);
  const toque = useRef<{ sentido: 1 | -1; valor: number; soltoEm: number | null } | null>(null);
  const relogios = useRef<{ espera?: ReturnType<typeof setTimeout>; repete?: ReturnType<typeof setInterval> }>({});
  const parar = () => {
    clearTimeout(relogios.current.espera);
    clearInterval(relogios.current.repete);
    relogios.current = {};
  };
  useEffect(() => parar, []);
  const conta = (inicio: number | null, sentido: 1 | -1, vezes: number) => ajustarCargaVezes(inicio, sugestaoKg, passo ?? 0, sentido, vezes, unidade);
  const pressionar = (sentido: 1 | -1) => {
    parar();
    const inicio = valorKg;
    const t: { sentido: 1 | -1; valor: number; soltoEm: number | null } = { sentido, valor: conta(inicio, sentido, 1), soltoEm: null };
    toque.current = t;
    setNaTela(t.valor);
    let vezes = 1;
    relogios.current.espera = setTimeout(() => {
      relogios.current.repete = setInterval(() => {
        vezes += 1;
        t.valor = conta(inicio, sentido, vezes);
        setNaTela(t.valor);
      }, INTERVALO_DO_REPEAT_MS);
      vezes += 1;
      t.valor = conta(inicio, sentido, vezes);
      setNaTela(t.valor);
    }, ATRASO_DO_REPEAT_MS);
  };
  const soltar = () => {
    parar();
    if (toque.current) toque.current.soltoEm = Date.now();
    setNaTela(null);
  };
  const tocar = (sentido: 1 | -1) => {
    const t = toque.current;
    toque.current = null;
    // O toque cancelado (o dedo saiu rolando a tela) deixa o `toque` sem `onPress`: depois de meio segundo ele não vale mais.
    const valeOToque = t && t.sentido === sentido && (t.soltoEm === null || Date.now() - t.soltoEm < 500);
    aoMudarKg(valeOToque ? t.valor : conta(valorKg, sentido, 1));
  };
  return (
    <View style={estilos.stepper}>
      {passo !== null ? <BotaoDePasso sentido={-1} passo={passo} rotulo={rotulo} estreito={estreito} aoPressionar={() => pressionar(-1)} aoSoltar={soltar} aoAjustar={tocar} /> : null}
      <View style={estilos.campo}>
        <CampoDeCarga rotulo={rotuloDoCampo} rotuloOculto rotuloAcessivel={rotuloDoCampo} valorKg={naTela ?? valorKg} aoMudarKg={aoMudarKg}
          aoValidade={aoValidade} placeholder={placeholder} ajuda={ajuda} />
      </View>
      {passo !== null ? <BotaoDePasso sentido={1} passo={passo} rotulo={rotulo} estreito={estreito} aoPressionar={() => pressionar(1)} aoSoltar={soltar} aoAjustar={tocar} /> : null}
    </View>
  );
}

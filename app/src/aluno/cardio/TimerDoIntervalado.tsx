import { Pause, Play, SkipForward, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, View } from 'react-native';

import type { Cardio } from '../../api/tipos';
import {
  anuncioDaFase, esforcoDaFase, fasesDoBloco, iniciarTimer, nomeDaFase, pausarTimer, pularFase, relogioDoTimer, retomarTimer,
  tempoCurto, voltaDaFase, type TimerDoBloco,
} from '../../dominio/cardio';
import { textoDoTempo } from '../../dominio/descanso';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Botao } from '../../ui/Botao';
import { useEmPrevia } from '../../ui/emPrevia';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';
import { vibrar } from '../../ui/vibrar';

/** Relógio de parede lido nos toques e no intervalo (fora da renderização). */
const instante = () => Date.now();

/**
 * Timer do bloco intervalado (pedido 27, passo P3): contagem regressiva de cada fase de `fasesDoBloco` (aquecimento,
 * estímulo, recuperação, desaquecimento), com a volta ("Volta 3 de 10"), pausar, retomar, pular e parar. Desenho da
 * `BarraDescanso`: painel pintado de azul (`informacao`), tempo grande e a barra da fase. Só no aparelho: nada vai à API, e
 * ao chegar ao fim marca o bloco como feito pelo mesmo caminho do ✓ (`aoTerminar`), uma vez.
 *
 * O relógio é o de parede (`dominio/cardio.relogioDoTimer`); o `setInterval` de 250 ms e o `AppState` só redesenham, como
 * na barra de descanso, então a aba em segundo plano não atrasa nada. A tela acesa é da rota do exercício (`useTelaAcesa`,
 * etiqueta única): chamar de novo aqui soltaria a trava da rota ao parar o timer. A vibração e o anúncio do leitor de tela
 * acontecem só na troca de fase, nunca a cada segundo. O estado é do cartão: sair da tela do exercício descarta o timer.
 */
export function TimerDoIntervalado({ cardio, numero, feita, aoTerminar }: {
  cardio: Cardio;
  /** Número do bloco, para os nomes acessíveis. */
  numero: number;
  feita: boolean;
  /** Marca o bloco como feito (o mesmo registro do ✓). */
  aoTerminar: () => void;
}) {
  const { cores, variante } = useTema();
  const emPrevia = useEmPrevia();
  const [timer, setTimer] = useState<TimerDoBloco | null>(null);
  const [agora, setAgora] = useState(instante);
  const [anuncio, setAnuncio] = useState('');
  const faseAnunciada = useRef(-1);
  const principal = useRef<View>(null);
  // O que o intervalo lê na hora de terminar, sempre o da última renderização.
  const atual = useRef({ feita, emPrevia, aoTerminar });
  useEffect(() => {
    atual.current = { feita, emPrevia, aoTerminar };
  });

  const anunciar = (texto: string) => {
    setAnuncio(texto);
    // No iOS a região viva não é lida; no Android e na web, sim (anunciar nos dois repetiria).
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(texto);
  };
  const terminar = () => {
    setTimer(null);
    faseAnunciada.current = -1;
    vibrar.sucesso();
    anunciar(`Bloco ${numero} concluído`);
    // Na prévia do treinador o timer roda, mas nada é marcado.
    const { feita: jaFeita, emPrevia: previa, aoTerminar: marcar } = atual.current;
    if (!jaFeita && !previa) marcar();
  };

  useEffect(() => {
    if (!timer || timer.pausadoEm != null) return;
    const fases = fasesDoBloco(cardio);
    // O intervalo e a volta do `AppState` podem disparar antes do redesenho que desliga o efeito: termina uma vez só.
    let acabou = false;
    const tique = () => {
      if (acabou) return;
      const t = instante();
      const r = relogioDoTimer(timer, fases, t);
      if (r.terminado) {
        acabou = true;
        return terminar();
      }
      if (r.indice !== faseAnunciada.current) {
        // Voltando do segundo plano depois de várias fases, vibra e anuncia uma vez só, a fase de agora.
        faseAnunciada.current = r.indice;
        vibrar.leve();
        if (r.fase) anunciar(anuncioDaFase(r.fase, cardio));
      }
      setAgora(t);
    };
    const intervalo = setInterval(tique, 250);
    const app = AppState.addEventListener('change', tique);
    return () => {
      clearInterval(intervalo);
      app.remove();
    };
    // `terminar` só lê refs e setters estáveis; entrar nas dependências recriaria o intervalo a cada redesenho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, cardio]);

  const fases = fasesDoBloco(cardio);
  const relogio = timer ? relogioDoTimer(timer, fases, timer.pausadoEm ?? agora) : null;
  const ativo = relogio && !relogio.terminado && relogio.fase ? relogio : null;
  const pintada = superficiePintada(cores.informacao, cores.superficie, variante, cores);

  const iniciar = () => {
    const t = instante();
    faseAnunciada.current = 0;
    setTimer(iniciarTimer(t));
    setAgora(t);
    if (fases[0]) anunciar(anuncioDaFase(fases[0], cardio));
  };
  const pausarOuRetomar = () => {
    if (!timer) return iniciar();
    const t = instante();
    if (timer.pausadoEm != null) {
      setTimer(retomarTimer(timer, t));
      setAgora(t);
      anunciar('Timer retomado');
    } else {
      setTimer(pausarTimer(timer, t));
      setAgora(t);
      anunciar('Timer pausado');
    }
  };
  const pular = () => {
    if (!timer) return;
    const t = instante();
    const novo = pularFase(timer, fases, t);
    const r = relogioDoTimer(novo, fases, t);
    if (r.terminado) {
      terminar();
      principal.current?.focus();
      return;
    }
    faseAnunciada.current = r.indice;
    setTimer(novo);
    setAgora(t);
    if (r.fase) anunciar(anuncioDaFase(r.fase, cardio));
  };
  const parar = () => {
    setTimer(null);
    faseAnunciada.current = -1;
    anunciar('Timer parado');
    // O "Parar timer" some ao parar: o foco volta ao botão que fica ("Iniciar timer").
    principal.current?.focus();
  };

  const pausado = !!timer && timer.pausadoEm != null;
  const rotuloPrincipal = !timer ? 'Iniciar timer' : pausado ? 'Retomar' : 'Pausar';
  const fase = ativo?.fase ?? null;
  const volta = fase ? voltaDaFase(fase, cardio) : null;
  const esforco = fase ? esforcoDaFase(fase, cardio) : null;
  const depois = ativo ? (ativo.proxima ? `Depois: ${nomeDaFase(ativo.proxima, cardio)} ${tempoCurto(ativo.proxima.segundos)}` : 'Depois: fim do bloco') : null;

  return (
    <View
      style={[estilos.timer, ativo ? [estilos.painel, fundoPintado(pintada), { borderColor: pintada.borda }] : null]}
      accessibilityRole={ativo ? 'timer' : undefined}
      aria-label={ativo ? `Timer do bloco ${numero}` : undefined}>
      {/* Região viva separada do relógio: anuncia a troca de fase e o fim, nunca cada segundo. */}
      <Texto style={estilos.soParaLeitor} accessibilityLiveRegion="polite">{anuncio}</Texto>
      {ativo && fase ? (
        <>
          <View style={estilos.linha}>
            <View style={estilos.fase}>
              <Texto variante="bloco" style={estilos.nomeDaFase}>{nomeDaFase(fase, cardio)}</Texto>
              {esforco || pausado ? (
                <Texto variante="pequeno" numerico>{[esforco, pausado ? 'Pausado' : null].filter(Boolean).join(' · ')}</Texto>
              ) : null}
            </View>
            {volta ? <Texto numerico style={estilos.volta}>Volta {volta}</Texto> : null}
          </View>
          <Texto numerico style={estilos.numero} cor={cores.texto} accessibilityLabel={`${ativo.segundos} segundos restantes`}>{ativo.texto}</Texto>
          <BarraProgresso feitas={ativo.segundos} total={fase.segundos} cor={cores.informacao} trilho={cores.superficie2}
            rotulo={`Tempo restante de ${nomeDaFase(fase, cardio).toLowerCase()}`} valorEmTexto={`${ativo.texto} de ${textoDoTempo(fase.segundos)}`} />
          {depois ? <Texto variante="pequeno" numerico>{depois}</Texto> : null}
        </>
      ) : null}
      <View style={estilos.acoes}>
        <Botao
          ref={principal}
          rotulo={rotuloPrincipal}
          rotuloAcessivel={`${!timer ? 'Iniciar timer' : pausado ? 'Retomar timer' : 'Pausar timer'} do bloco ${numero}`}
          Icone={timer && !pausado ? Pause : Play}
          tipo="secundario"
          aoTocar={pausarOuRetomar}
        />
        {timer ? (
          pausado
            ? <Botao rotulo="Parar timer" rotuloAcessivel={`Parar timer do bloco ${numero}`} Icone={Square} tipo="secundario" aoTocar={parar} />
            : <Botao rotulo="Pular fase" rotuloAcessivel={`Pular fase do bloco ${numero}`} Icone={SkipForward} tipo="secundario" aoTocar={pular} />
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  timer: { gap: espaco(1) },
  painel: { borderWidth: 1, borderRadius: RAIO_CONTROLE, padding: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1) },
  fase: { flex: 1, minWidth: 0, gap: 2 },
  nomeDaFase: { fontFamily: fontes.semi, fontSize: 16 },
  volta: { fontFamily: fontes.semi },
  numero: { fontFamily: fontes.negrito, fontSize: 32, lineHeight: 38 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});

import { ChevronDown, ChevronUp, CircleAlert, Copy, Ellipsis, Plus, TriangleAlert } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { Cardio, MedidaDeCardio, Serie } from '../../api/tipos';
import { avisoForaDaFaixa, blocoContinuo, erroDoBloco, partesDaPrevia } from '../../dominio/cardio';
import { alterarBlocoDeCardio, duplicarSerie, LIMITE_SERIES, mover, novaSerieDeCardio } from '../../dominio/editorTreino';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CamadaDaSerie, fundoDaSerie } from '../../ui/CamadaDaSerie';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { pinturaDaSerie } from '../../ui/pinturaDaSerie';
import { Selo } from '../../ui/Selo';
import { sobre as comMouse } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { BlocoDeCardio } from './BlocoDeCardio';
import type { Nivel } from './EditorDoGrupoDeSeries';

/** Nenhum bloco aberto ("Fechar edição" ou tocar no aberto): nunca é uid de série (`novoUid` gera UUID). */
const NENHUM_BLOCO_ABERTO = 'nenhum-bloco-aberto';
const RAIO_DA_LINHA = 12;
const RAIO_DO_BLOCO = 14;
/** Altura de uma linha fechada (título e resumo, mais os vãos): a do "+ Novo bloco de cardio". */
const ALTURA_DA_LINHA = 21 + 18 + 2 + 2 * espaco(1.25);

const cardioDe = (s: Serie): Cardio => s.cardio ?? blocoContinuo();

/** Situação do bloco pela mesma regra do servidor (`erroDoBloco`); fora da faixa do protocolo só avisa. */
function nivelDoBloco(c: Cardio): Nivel {
  if (Object.keys(erroDoBloco(c)).length) return 'perigo';
  return avisoForaDaFaixa(c) ? 'atencao' : 'sucesso';
}

/**
 * A prescrição do exercício de cardio no editor de treino (docs/planos/cardio-e-hiit.md, P2): cada série é um bloco (D1),
 * sem a tabela de séries da musculação. Uma linha por bloco ("Bloco 1", o modo ou o protocolo num selo neutro e a prévia
 * do aluno embaixo), em sanfona como a `TabelaDeBlocos`: tocar abre o bloco logo abaixo da linha (`BlocoDeCardio`), tocar
 * no aberto fecha; o ⋯ move e duplica. "+ Novo bloco de cardio" é a última linha tracejada e nasce contínuo e vazio. O
 * bloco aberto é controlado por quem usa (`blocoAbertoUid`, o mesmo estado da aba de séries, para o "ir ao primeiro").
 */
export function EditorDoCardio({ series, medidas, aoMudar, blocoAbertoUid, aoAbrirBloco }: {
  series: Serie[];
  /** Medidas do exercício na biblioteca (D12); nulo = cardio manual ou exercício antigo: as duas. */
  medidas: readonly MedidaDeCardio[] | null | undefined;
  aoMudar: (series: Serie[]) => void;
  blocoAbertoUid?: string | null;
  aoAbrirBloco?: (uid: string | null) => void;
}) {
  const { cores, variante, bordas } = useTema();
  const { cardioIntervaladoHabilitado } = useSessao();
  const [abertoInterno, setAbertoInterno] = useState<string | null>(null);
  const guardado = aoAbrirBloco ? blocoAbertoUid ?? null : abertoInterno;
  // Como as séries: nulo ou desconhecido = o primeiro bloco aberto; o sentinela = todos fechados.
  const aberto = guardado === NENHUM_BLOCO_ABERTO ? null : (series.find((s) => s.uid === guardado) ?? series[0] ?? null);
  const abrir = (uid: string | null) => (aoAbrirBloco ? aoAbrirBloco(uid) : setAbertoInterno(uid));
  const [menuDe, setMenuDe] = useState<number | null>(null);
  const cheio = series.length >= LIMITE_SERIES;
  const motivoCheio = cheio ? `O exercício já tem ${LIMITE_SERIES} blocos, o máximo.` : undefined;
  const idDoDetalhe = `detalhe-do-bloco-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // "Fechar edição" e "Excluir bloco" (web) somem com o botão e o foco cairia no corpo da página: ele volta à linha do bloco
  // que ficou aberto, ou à do que fechou (WCAG 2.4.3, como na `TabelaDeBlocos`). Só quando o foco se perdeu.
  const linhasRef = useRef(new Map<string, View | null>());
  const uidAberto = aberto?.uid ?? null;
  const anterior = useRef(uidAberto);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = uidAberto;
    if (Platform.OS !== 'web' || antes === uidAberto || typeof document === 'undefined') return;
    const foco = document.activeElement;
    if (foco && foco !== document.body) return;
    linhasRef.current.get(uidAberto ?? antes ?? '')?.focus();
  }, [uidAberto]);

  const novo = () => {
    if (cheio) return;
    const serie = novaSerieDeCardio();
    aoMudar([...series, serie]);
    abrir(serie.uid);
  };
  const duplicar = (i: number) => {
    const novas = duplicarSerie(series, i);
    if (novas === series) return;
    aoMudar(novas);
    abrir(novas[i + 1].uid);
  };
  const remover = (i: number) => {
    const novas = series.filter((_, j) => j !== i);
    aoMudar(novas);
    // O vizinho fica aberto (o que ocupa o lugar, ou o novo último); sem bloco, nada.
    abrir(novas[Math.min(i, novas.length - 1)]?.uid ?? NENHUM_BLOCO_ABERTO);
  };
  const mudarBloco = (i: number, c: Cardio) => aoMudar(alterarBlocoDeCardio(series, i, c));

  const acoesDoMenu = menuDe !== null && menuDe < series.length ? [
    ...acoesDeMover({ nome: `bloco ${menuDe + 1}`, posicao: menuDe, total: series.length, aoMover: (d) => aoMudar(mover(series, menuDe, d)) }),
    { rotulo: 'Duplicar bloco', detalhe: cheio ? motivoCheio : `Uma cópia do bloco ${menuDe + 1} logo depois dele.`, Icone: Copy, desabilitado: cheio, aoTocar: () => duplicar(menuDe) },
  ] : [];

  const linha = (s: Serie, i: number) => {
    const c = cardioDe(s);
    const sel = aberto?.uid === s.uid;
    const nivel = nivelDoBloco(c);
    const [modo, ...resto] = partesDaPrevia(c);
    const detalhe = resto.join(' · ') || 'Sem prescrição';
    const Icone = nivel === 'perigo' ? CircleAlert : TriangleAlert;
    // ⌄ fechado, ⌃ aberto: o mesmo chevron da `TabelaDeBlocos` (quadro de 27/11).
    const Seta = sel ? ChevronUp : ChevronDown;
    // O aberto com a borda de ação, como a série aberta da `TabelaDeBlocos` (28/11).
    const p = pinturaDaSerie(null, sel ? 'ATIVA' : 'CHEIA', cores, variante, bordas.item);
    const rotulo = [`Bloco ${i + 1} · ${modo}`, detalhe, nivel === 'perigo' ? 'com problema a corrigir' : nivel === 'atencao' ? 'com aviso' : null].filter(Boolean).join(', ');
    return (
      <View key={s.uid} testID={sel ? 'bloco-de-cardio-aberto' : undefined}
        style={[estilos.item, sel ? estilos.bloco : null, fundoDaSerie(p, cores.superficie)]}>
        <View style={estilos.cabecaDaLinha}>
          <Pressable ref={(n) => { linhasRef.current.set(s.uid, n); }} accessibilityRole="button" accessibilityLabel={rotulo} aria-expanded={sel}
            {...(Platform.OS === 'web' && sel ? ({ 'aria-controls': idDoDetalhe } as object) : {})}
            onPress={() => abrir(sel ? NENHUM_BLOCO_ABERTO : s.uid)}
            style={(st) => [estilos.caixa, { backgroundColor: !sel && comMouse(st) ? cores.superficie2 : 'transparent' }]}>
            <View style={estilos.linha}>
              <View style={estilos.textos}>
                <View style={estilos.titulo}>
                  {nivel !== 'sucesso' ? <Icone size={16} color={cores[nivel]} strokeWidth={2.5} aria-hidden /> : null}
                  <Texto style={estilos.forte}>{`Bloco ${i + 1}`}</Texto>
                  <Selo texto={modo} tipo="neutro" />
                </View>
                <Texto variante="pequeno" numerico cor={resto.length ? undefined : 'suave'}>{detalhe}</Texto>
              </View>
              <View style={estilos.chevron} aria-hidden><Seta size={18} color={sel ? cores.acao : cores.textoSuave} strokeWidth={2} /></View>
            </View>
          </Pressable>
          <View style={estilos.menu}><IconeBotao Icone={Ellipsis} rotulo={`Mais ações do bloco ${i + 1}`} aoTocar={() => setMenuDe(i)} /></View>
        </View>
        {sel ? (
          <View nativeID={idDoDetalhe} role="region" aria-label={`Editando bloco ${i + 1}`}>
            <BlocoDeCardio key={s.uid} cardio={c} numero={i + 1} erros={erroDoBloco(c)} medidas={medidas} nivel={nivel} intervaladoLiberado={cardioIntervaladoHabilitado}
              aoMudar={(nc) => mudarBloco(i, nc)} aoRemover={() => remover(i)} aoFechar={() => abrir(NENHUM_BLOCO_ABERTO)} />
          </View>
        ) : null}
        <CamadaDaSerie pintura={p} ativa={sel} raio={sel ? RAIO_DO_BLOCO : RAIO_DA_LINHA} />
      </View>
    );
  };

  return (
    <View style={estilos.lista}>
      {series.length ? null : <Texto variante="suave">{`Nenhum bloco ainda. O aluno vê cada bloco na ordem, com a prescrição${cardioIntervaladoHabilitado ? ' e o timer do intervalado' : ''}.`}</Texto>}
      <View style={estilos.blocos} role="group" aria-label="Blocos de cardio">
        {series.map(linha)}
        {cheio ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Novo bloco de cardio" onPress={novo} testID="novo-bloco-de-cardio"
            style={(st) => [estilos.novo, { borderColor: cores.bordaCampo, backgroundColor: comMouse(st) ? cores.superficie2 : 'transparent' }]}>
            <Plus size={18} color={cores.textoSuave} strokeWidth={2} />
            <Texto style={[estilos.forte, { color: cores.textoSuave }]}>Novo bloco de cardio</Texto>
          </Pressable>
        )}
      </View>
      {cheio ? <LinhaDeAcoes><Botao rotulo="Novo bloco de cardio" tipo="secundario" Icone={Plus} desabilitado motivo={motivoCheio} aoTocar={novo} /></LinhaDeAcoes> : null}
      {acoesDoMenu.length ? <FolhaDeAcoes titulo={`Bloco ${(menuDe ?? 0) + 1}`} aoFechar={() => setMenuDe(null)} acoes={acoesDoMenu} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  blocos: { width: '100%', gap: espaco(0.75) },
  item: { width: '100%', borderRadius: RAIO_DA_LINHA },
  bloco: { borderRadius: RAIO_DO_BLOCO },
  cabecaDaLinha: { flexDirection: 'row', alignItems: 'stretch' },
  caixa: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.25), borderRadius: RAIO_DA_LINHA },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(2) },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.25) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  forte: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  chevron: { width: 20, alignItems: 'center' },
  menu: { justifyContent: 'center', marginHorizontal: espaco(0.5) },
  novo: { width: '100%', minHeight: ALTURA_DA_LINHA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(0.75), borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RAIO_DA_LINHA, paddingHorizontal: espaco(1.5) },
});

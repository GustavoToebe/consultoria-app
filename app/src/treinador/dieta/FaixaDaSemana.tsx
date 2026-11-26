import { Check, Info } from 'lucide-react-native';
import { useId, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoDieta, VariacaoDaDieta } from '../../api/tipos';
import { DIAS_CURTOS, DIAS_SEMANA } from '../../dominio/editorTreino';
import { DIAS_DA_SEMANA, numeroDaVariacaoNoDia } from '../../dominio/variacoesDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, misturar, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCliqueFora, useTeclado } from '../../ui/usoWeb';

const DICA = 'Marcar um dia o tira da outra variação.';

interface Props {
  conteudo: ConteudoDieta;
  aberta: VariacaoDaDieta;
  nomeDe: (v: VariacaoDaDieta) => string;
  aoAlternar: (dia: number) => void;
}

/**
 * A faixa da semana da variação aberta: sete botões iguais (Seg…Dom), cada um com o número da variação que vale no dia
 * ("—" sem nenhuma). Os da aberta em tonal da cor de ação com ✓; os outros neutros, com o número da outra. Tocar alterna
 * o dia na aberta (marcar o tira da outra, `alternarDia`). Sete cabem numa linha em 390 px (44 px cada).
 */
export function FaixaDaSemana({ conteudo: c, aberta, nomeDe, aoAlternar }: Props) {
  return (
    <View style={estilos.raiz}>
      <RotuloComDica rotulo="Dias desta variação" dica={DICA} />
      <View style={estilos.linha} role="group" accessibilityLabel={`Dias da variação ${nomeDe(aberta)}`}>
        {DIAS_DA_SEMANA.map((dia) => {
          const marcado = aberta.dias.includes(dia);
          const outra = marcado ? undefined : c.variacoes.find((v) => v.dias.includes(dia));
          return (
            <Dia key={dia} curto={DIAS_CURTOS[dia - 1]} numero={numeroDaVariacaoNoDia(c, dia)} marcado={marcado}
              nome={`${DIAS_SEMANA[dia - 1]}${outra ? `, está em ${nomeDe(outra)}` : marcado ? '' : ', sem variação'}`}
              dica={outra ? `Marcar tira o dia de ${nomeDe(outra)}.` : undefined}
              aoTocar={() => aoAlternar(dia)} />
          );
        })}
      </View>
    </View>
  );
}

function Dia({ curto, numero, nome, dica, marcado, aoTocar }: {
  curto: string; numero: number | null; nome: string; dica?: string; marcado: boolean; aoTocar: () => void;
}) {
  const { cores } = useTema();
  const texto = marcado ? cores.acao : cores.texto;
  const borda = marcado ? misturar(cores.acaoSuave, cores.acao, 0.35) : cores.bordaCampo;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      aria-checked={marcado}
      accessibilityLabel={nome}
      accessibilityHint={dica}
      onPress={aoTocar}
      style={(st) => [estilos.dia, {
        borderColor: sobre(st) && marcado ? cores.acao : borda,
        backgroundColor: marcado ? cores.acaoSuave : sobre(st) ? cores.sobre : cores.superficie,
      }]}>
      <Texto style={[estilos.curto, { color: texto }]}>{curto}</Texto>
      <View style={estilos.numero} aria-hidden>
        {marcado ? <Check size={12} color={texto} strokeWidth={3} /> : null}
        <Texto numerico style={[estilos.digito, { color: marcado ? texto : cores.textoSuave }]}>{numero ?? '—'}</Texto>
      </View>
    </Pressable>
  );
}

/** Na web, o `ref` de uma `View` é o elemento do DOM. */
const elementoDaWeb = (no: unknown): HTMLElement | null => (typeof HTMLElement !== 'undefined' && no instanceof HTMLElement ? no : null);

/**
 * Rótulo do grupo com o ⓘ ao lado: a explicação curta sai da tela e vira dica. Abre com o mouse em cima, no foco do
 * teclado e no toque (alterna); Esc, tocar fora, o mouse sair (pode entrar no balão, WCAG 1.4.13) e o foco sair fecham.
 * O balão sobe por cima do que vem antes (quem vem depois no desenho fica por cima sem `zIndex`). O texto é a descrição
 * acessível do ⓘ; o balão fica fora da leitura para não ser lido duas vezes.
 */
function RotuloComDica({ rotulo, dica }: { rotulo: string; dica: string }) {
  const { cores, bordas } = useTema();
  const web = Platform.OS === 'web';
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<View>(null);
  const botao = useRef<View>(null);
  // O clique de quem já abriu pelo mouse não fecha o balão que ele está lendo.
  const mouseEmCima = useRef(false);
  useTeclado(web && aberto, ({ key }) => {
    if (key !== 'Escape') return undefined;
    setAberto(false);
    return true;
  });
  useCliqueFora(caixa, web && aberto, () => setAberto(false));
  return (
    <View ref={caixa} style={estilos.rotulo}
      {...(web ? { onPointerLeave: (e: { nativeEvent: { pointerType?: string } }) => { if (e.nativeEvent.pointerType === 'mouse') setAberto(false); } } : null)}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <Pressable ref={botao} accessibilityRole="button" accessibilityLabel={`Sobre ${rotulo.toLowerCase()}`}
        accessibilityHint={web ? undefined : dica} aria-describedby={web ? id : undefined}
        aria-expanded={aberto} accessibilityState={{ expanded: aberto }}
        onPress={() => setAberto((a) => mouseEmCima.current || !a)}
        onHoverIn={() => { mouseEmCima.current = true; setAberto(true); }}
        onHoverOut={() => { mouseEmCima.current = false; }}
        onFocus={() => { if (elementoDaWeb(botao.current)?.matches(':focus-visible')) setAberto(true); }}
        onBlur={() => setAberto(false)}
        style={estilos.alvo}>
        {(st) => (
          <View style={[estilos.desenho, { backgroundColor: sobre(st) || aberto ? cores.sobre : 'transparent' }]}>
            <Info size={16} color={aberto ? cores.texto : cores.textoSuave} strokeWidth={2} />
          </View>
        )}
      </Pressable>
      {web ? <View id={id} style={estilos.oculto}><Texto>{dica}</Texto></View> : null}
      {aberto ? (
        <View aria-hidden={web} style={[estilos.balao, { backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
          <Texto>{dica}</Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(0.5) },
  rotulo: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 2 },
  // O alvo de 44 px centrado na linha do rótulo (18 px), sem deixar a linha mais alta.
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, marginVertical: (18 - ALVO_TOQUE) / 2, alignItems: 'center', justifyContent: 'center' },
  desenho: { width: 28, height: 28, borderRadius: RAIO_CONTROLE, alignItems: 'center', justifyContent: 'center' },
  oculto: { display: 'none' },
  balao: { position: 'absolute', bottom: '100%', left: 0, maxWidth: 320, marginBottom: espaco(1.5), borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1.5) },
  // Em 390 px sobram 324 px: sete dias com 2 px entre eles dão ~44,5 px cada. Mais estreito (zoom, fonte grande), quebra
  // a linha em vez de encolher abaixo de 44.
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  dia: {
    flex: 1,
    minWidth: ALVO_TOQUE,
    maxWidth: 64,
    minHeight: ALVO_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RAIO_CONTROLE,
    borderWidth: 1,
  },
  curto: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16 },
  numero: { flexDirection: 'row', alignItems: 'center', gap: 1, height: 16 },
  digito: { fontSize: 12, lineHeight: 16, fontFamily: fontes.semi },
});

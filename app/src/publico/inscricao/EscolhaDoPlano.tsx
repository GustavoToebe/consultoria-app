import { Check } from 'lucide-react-native';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import type { PlanoDaPagina } from '../../api/inscricoesTipos';
import { AVISO_DO_OUTRO_SEM_CAMPO, PLANO_OUTRO, precoDoPlano, ROTULO_DO_OUTRO, textoDoPeriodo } from '../../dominio/planosDaInscricao';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, marcaParaPeca, RAIO_CONTROLE, textoSobre } from '../../tema/tokens';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

type Focavel = { focus: () => void };
interface Opcao { valor: string; titulo: string; periodo: string | null; preco: string | null }

/**
 * "Qual plano combinou?" em cartões de escolha única (27/11): um por plano comercial ativo (nome, período e, só com a opção
 * do link ligada, o preço) e, por último, "Outro / ainda não sei", que abre o campo de texto logo abaixo quando a página tem
 * onde guardá-lo (`outro`). Cartões na largura da coluna, 44 px de altura mínima; o escolhido ganha borda e ✓ na cor da
 * marca da consultoria (peça a 3:1, `marcaParaPeca`; pedido do Gustavo para as páginas públicas) e fundo neutro `sobre`.
 * Teclado: o `radiogroup` da APG, como `EscolhaDoQueImportar` (um cartão no Tab, setas movem foco e escolha).
 */
export function EscolhaDoPlano({ rotulo, planos, mostrarPreco, valor, aoMudar, cor, outro, refDoOutro, erro, ref }: {
  rotulo: string;
  planos: readonly PlanoDaPagina[];
  mostrarPreco: boolean;
  /** A escolha efetiva (`escolhaEfetiva`): id do plano, `PLANO_OUTRO` ou `null`. */
  valor: string | null;
  aoMudar: (valor: string) => void;
  cor: string;
  /** Texto de "Outro" (a resposta da pergunta do plano); sem ele (página completa), "Outro" não abre campo, só o aviso. */
  outro?: { valor: string; aoMudar: (t: string) => void; erro?: string; maxLength: number } | null;
  refDoOutro?: Ref<TextInput>;
  erro?: string;
  ref?: Ref<Focavel | null>;
}) {
  const { cores } = useTema();
  const refs = useRef<(Focavel | null)[]>([]);
  const opcoes: Opcao[] = [
    ...planos.map((p) => ({ valor: p.id, titulo: p.nome, periodo: textoDoPeriodo(p.periodicidade), preco: precoDoPlano(p, mostrarPreco) })),
    { valor: PLANO_OUTRO, titulo: ROTULO_DO_OUTRO, periodo: null, preco: null },
  ];
  const marcada = opcoes.findIndex((o) => o.valor === valor);
  // Sem nada marcado, o primeiro cartão recebe o Tab (APG).
  const noTab = marcada >= 0 ? marcada : 0;
  useImperativeHandle(ref, () => ({ focus: () => refs.current[noTab]?.focus() }), [noTab]);
  const peca = marcaParaPeca(cor, [cores.superficie, cores.sobre]);

  const mover = (passo: number) => {
    const n = opcoes.length;
    const proximo = ((marcada >= 0 ? marcada : passo > 0 ? -1 : 0) + passo + n) % n;
    aoMudar(opcoes[proximo].valor);
    refs.current[proximo]?.focus();
  };
  const aoTeclar = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') mover(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') mover(-1);
    else return;
    e.preventDefault();
  };
  const teclado = Platform.OS === 'web' ? { onKeyDown: aoTeclar } : {};

  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto} nativeID="rotulo-do-plano">{`${rotulo} (opcional)`}</Texto>
      <View role="radiogroup" aria-labelledby="rotulo-do-plano" accessibilityLabel={`${rotulo} (opcional)`} aria-invalid={!!erro}
        style={estilos.lista} {...teclado}>
        {opcoes.map((o, i) => {
          const escolhida = i === marcada;
          const descricao = [o.periodo, o.preco].filter(Boolean).join('. ');
          return (
            <Pressable
              key={o.valor}
              ref={(no) => { refs.current[i] = no as Focavel | null; }}
              accessibilityRole="radio"
              accessibilityState={{ checked: escolhida }}
              aria-checked={escolhida}
              accessibilityLabel={descricao ? `${o.titulo}. ${descricao}` : o.titulo}
              tabIndex={i === noTab ? 0 : -1}
              onPress={() => aoMudar(o.valor)}
              style={(estado) => [estilos.cartao, {
                backgroundColor: escolhida ? cores.sobre : sobre(estado) ? cores.superficie2 : cores.superficie,
                borderColor: escolhida ? peca : erro ? cores.perigo : cores.bordaCampo,
                // A borda cresce 1 px para dentro: o conteúdo não pula ao escolher.
                borderWidth: escolhida ? 2 : 1,
                padding: espaco(1.5) - (escolhida ? 1 : 0),
              }]}>
              <View aria-hidden style={[estilos.radio, escolhida
                ? { backgroundColor: peca, borderColor: peca }
                : { borderColor: cores.bordaCampo }]}>
                {escolhida ? <Check size={14} color={textoSobre(peca)} strokeWidth={3} /> : null}
              </View>
              <View style={estilos.textos}>
                <View style={estilos.linhaDoNome}>
                  <Texto variante="bloco" style={estilos.nome}>{o.titulo}</Texto>
                  {o.preco ? <Texto variante="rotulo" numerico cor={cores.texto}>{o.preco}</Texto> : null}
                </View>
                {o.periodo ? <Texto variante="suave">{o.periodo}</Texto> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {erro ? <MensagemDeErro erro={erro} /> : null}
      {valor === PLANO_OUTRO && outro ? (
        <Campo ref={refDoOutro} rotulo="Qual plano? (opcional)" valor={outro.valor} aoMudar={outro.aoMudar} erro={outro.erro}
          maxLength={outro.maxLength} ajuda="Se ainda não sabe, pode deixar em branco." />
      ) : valor === PLANO_OUTRO ? (
        <Texto variante="suave" accessibilityLiveRegion="polite">{AVISO_DO_OUTRO_SEM_CAMPO}</Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  lista: { gap: espaco(1) },
  cartao: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderRadius: RAIO_CONTROLE, alignSelf: 'stretch' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  linhaDoNome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: espaco(1.5), rowGap: 2 },
  nome: { flexShrink: 1 },
});

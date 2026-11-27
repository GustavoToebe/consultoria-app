import { ChevronDown, ChevronRight, Ellipsis, Plus, Trash2, TriangleAlert } from 'lucide-react-native';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { ConteudoDieta } from '../../api/tipos';
import {
  abertaDepoisDeMover, abertaDepoisDeRemover, type ArranjoDosComplementos, avisoDoTitulo, comecoDoTexto, LIMITES_DOS_COMPLEMENTOS, problemaDaOrientacao,
  selecionadaDepoisDeRemover, selecionadaValida,
} from '../../dominio/complementosDaDieta';
import { inteiroComMilhar } from '../../dominio/formatos';
import { mover, substituir } from '../../dominio/editorTreino';
import { moverPara } from '../../dominio/reordenar';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { coresDaEdicao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { ContadorDeCaracteres } from './ContadorDeCaracteres';
import { PreviaDasOrientacoes } from './PreviaDosComplementos';

type Orientacao = ConteudoDieta['orientacoes'][number];

/** Abaixo disto (lista medida), o começo do texto desce para baixo do título: lado a lado, os dois ficavam curtos demais. */
const LARGURA_EM_LINHA = 520;

const VAZIA = 'Nenhuma orientação ainda. Escreva o que o aluno deve ler junto com a dieta (água, preparo, trocas).';

/**
 * Aba Orientações do cartão Complementos (25/11). Lista compacta e reordenável, uma linha por orientação com a alça, o
 * título em negrito, o começo do texto em secundário (uma linha, reticências) e o ⋯ (mover e excluir, com Desfazer).
 *
 * `lista` (abaixo da faixa `larga`): tocar na linha abre a edição ali mesmo, em largura de leitura; uma aberta por vez.
 * `lado` e `ladoComPrevia` (27/11, faixa `larga` em diante): a lista à esquerda (40%) é uma `listbox` (↑↓, Home e End
 * trocam a selecionada) e à direita (60%) o editor da selecionada e "Como o aluno vê" (`PreviaDasOrientacoes`), embaixo do
 * editor na `larga` e ao lado dele na `ultralarga`. Sempre há uma selecionada enquanto há orientação.
 *
 * As orientações não têm uid: a aberta/selecionada é um índice só (um dono, nos dois arranjos) que segue o item ao mover;
 * ao remover, na lista fecha e lado a lado passa à vizinha (`selecionadaDepoisDeRemover`). A nova nasce aberta com o foco
 * no título. "Sem título" avisa só no campo Título (`avisoDoTitulo`), não na linha nem na aba.
 */
export function OrientacoesDaDieta({ orientacoes, arranjo, aoMudar, aoRemover }: {
  orientacoes: Orientacao[];
  arranjo: ArranjoDosComplementos;
  aoMudar: (lista: Orientacao[]) => void;
  /** Remove com a barra "Desfazer" do editor. */
  aoRemover: (indice: number) => void;
}) {
  const lado = arranjo !== 'lista';
  const [aberta, setAberta] = useState<number | null>(null);
  const [focarNova, setFocarNova] = useState(false);
  const [largura, setLargura] = useState(0);
  const opcoes = useRef<(View | null)[]>([]);
  const total = orientacoes.length;
  // Desfazer devolveu ou tirou itens por fora: na lista, o índice que ficou para fora fecha; lado a lado, vale a última.
  const selecionada = selecionadaValida(aberta, total, lado);
  const moverDe = (de: number, para: number) => {
    // Mover remonta o editor ao lado (chave = posição): sem isto o `autoFocus` da nova puxaria o foco de novo para o Título.
    setFocarNova(false);
    aoMudar(moverPara(orientacoes, de, para));
    setAberta(abertaDepoisDeMover(selecionada, de, para));
  };
  const arraste = useArrasteDaLista({ total, folga: 3, aoSoltar: moverDe });
  const emLinha = largura >= LARGURA_EM_LINHA;
  const adicionar = (
    <LinhaDeAcoes>
      <Botao rotulo="Adicionar orientação" tipo="acao" Icone={Plus} aoTocar={() => {
        aoMudar([...orientacoes, { titulo: '', texto: '' }]);
        setAberta(total);
        setFocarNova(true);
      }} />
    </LinhaDeAcoes>
  );
  const linhaDe = (o: Orientacao, i: number) => ({
    orientacao: o, posicao: i, total, emLinha,
    alca: <AlcaDeArraste arraste={arraste} indice={i} />,
    aoMover: (d: -1 | 1) => { setFocarNova(false); aoMudar(mover(orientacoes, i, d)); setAberta(abertaDepoisDeMover(selecionada, i, i + d)); },
    aoRemover: () => { setAberta(lado ? selecionadaDepoisDeRemover(selecionada, i, total) : abertaDepoisDeRemover(selecionada, i)); aoRemover(i); },
  });
  const aoMedir = (e: { nativeEvent: { layout: { width: number } } }) => setLargura(e.nativeEvent.layout.width);

  if (!lado) {
    return (
      // Vazia, sem o teto de leitura: a frase cabe numa linha na tela larga (com o teto quebrava em duas).
      <View style={total === 0 ? estilos.abaVazia : estilos.aba}>
        {total === 0 ? <Texto variante="suave">{VAZIA}</Texto> : (
          <View style={estilos.itens} role="group" accessibilityLabel="Orientações da dieta" onLayout={aoMedir}>
            {orientacoes.map((o, i) => (
              <ItemArrastavel key={i} arraste={arraste} indice={i}>
                <LinhaDaOrientacao {...linhaDe(o, i)} aberta={selecionada === i} focar={focarNova && selecionada === i}
                  aoAlternar={() => { setFocarNova(false); setAberta(selecionada === i ? null : i); }}
                  aoMudar={(nova) => aoMudar(substituir(orientacoes, i, nova))} />
              </ItemArrastavel>
            ))}
          </View>
        )}
        {adicionar}
      </View>
    );
  }

  const escolher = (i: number) => {
    if (i < 0 || i >= total) return;
    setFocarNova(false);
    setAberta(i);
    opcoes.current[i]?.focus();
  };
  const atual = selecionada === null ? null : orientacoes[selecionada];
  return (
    <View style={estilos.lado}>
      <View style={estilos.colunaDaLista}>
        {total === 0 ? <Texto variante="suave">{VAZIA}</Texto> : (
          <View style={estilos.itens} {...({ role: 'listbox' } as object)} aria-label="Orientações da dieta" onLayout={aoMedir}>
            {orientacoes.map((o, i) => (
              <ItemArrastavel key={i} arraste={arraste} indice={i}>
                <OpcaoDaOrientacao {...linhaDe(o, i)} selecionada={selecionada === i}
                  registrar={(no) => { opcoes.current[i] = no; }} aoEscolher={() => escolher(i)}
                  aoTeclar={(tecla) => escolher(tecla === 'ArrowDown' ? i + 1 : tecla === 'ArrowUp' ? i - 1 : tecla === 'Home' ? 0 : total - 1)} />
              </ItemArrastavel>
            ))}
          </View>
        )}
        {adicionar}
      </View>
      <View style={[estilos.colunaDoEditor, arranjo === 'ladoComPrevia' ? estilos.editorComPreviaAoLado : null]}>
        {atual && selecionada !== null ? (
          <View style={[estilos.editorAoLado, arranjo === 'ladoComPrevia' ? estilos.metade : null]} role="group" accessibilityLabel={`Editando orientação ${selecionada + 1}`}>
            {/* A chave troca o editor junto com a seleção: o campo que cresce mede de novo e o foco não fica no da anterior. */}
            <EditorDaOrientacao key={selecionada} orientacao={atual} n={selecionada + 1} focar={focarNova} linhas={8}
              aoMudar={(nova) => aoMudar(substituir(orientacoes, selecionada, nova))} />
          </View>
        ) : null}
        <View style={arranjo === 'ladoComPrevia' ? estilos.metade : null}>
          <PreviaDasOrientacoes orientacoes={orientacoes} selecionada={selecionada} />
        </View>
      </View>
    </View>
  );
}

interface PropsDaLinha {
  orientacao: Orientacao;
  posicao: number;
  total: number;
  emLinha: boolean;
  alca: ReactNode;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
}

/** O ⋯ da linha (mover e excluir) e a folha dele, iguais nos dois arranjos. */
function useMaisAcoes({ orientacao: o, posicao, total, aoMover, aoRemover }: PropsDaLinha) {
  const [menu, setMenu] = useState(false);
  const titulo = o.titulo.trim();
  const nome = titulo || `orientação ${posicao + 1}`;
  const acoes = [
    ...acoesDeMover({ nome, posicao, total, aoMover }),
    { rotulo: 'Excluir orientação', detalhe: `Remover ${nome}. Dá para desfazer logo depois.`, Icone: Trash2, perigo: true, aoTocar: aoRemover },
  ];
  return {
    botao: <View style={estilos.colunaDoMais}><IconeBotao Icone={Ellipsis} rotulo={`Mais ações de ${nome}`} aoTocar={() => setMenu(true)} /></View>,
    folha: menu ? <FolhaDeAcoes titulo={titulo || 'Orientação sem título'} aoFechar={() => setMenu(false)} acoes={acoes} /> : null,
  };
}

/** Título e começo do texto da linha (o começo some com a edição aberta na própria linha). */
function ResumoDaLinha({ orientacao: o, emLinha, semComeco, antes, fundo }: { orientacao: Orientacao; emLinha: boolean; semComeco?: boolean; antes?: ReactNode; fundo?: string }) {
  const { cores } = useTema();
  const titulo = o.titulo.trim();
  return (
    <View style={[estilos.resumo, emLinha ? estilos.resumoEmLinha : null, fundo ? { backgroundColor: fundo } : null]}>
      <View style={[estilos.titulo, emLinha ? estilos.tituloEmLinha : null]}>
        {antes}
        <Texto numberOfLines={1} style={[estilos.textoDoTitulo, titulo ? null : { color: cores.textoSuave }]}>{titulo || 'Sem título'}</Texto>
      </View>
      {semComeco ? null : (
        <Texto variante="suave" numberOfLines={1} style={[antes ? estilos.comeco : null, emLinha ? estilos.comecoEmLinha : null]}>{comecoDoTexto(o.texto) || '—'}</Texto>
      )}
    </View>
  );
}

const PERIGO_NO_ROTULO = ', texto acima do limite';

/** Linha do arranjo `lista`: botão que abre e fecha a edição na própria linha. */
function LinhaDaOrientacao(props: PropsDaLinha & { aberta: boolean; focar: boolean; aoAlternar: () => void; aoMudar: (o: Orientacao) => void }) {
  const { orientacao: o, posicao, total, emLinha, alca, aberta, focar, aoAlternar, aoMudar } = props;
  const { cores } = useTema();
  const mais = useMaisAcoes(props);
  const n = posicao + 1;
  const problema = problemaDaOrientacao(o);
  const Seta = aberta ? ChevronDown : ChevronRight;
  const fundo = aberta ? coresDaEdicao(cores).fundoDoBloco : cores.superficie2;
  return (
    <View style={[estilos.faixa, { backgroundColor: fundo, borderColor: problema === 'perigo' ? cores.perigo : 'transparent' }]}>
      <View style={estilos.linha}>
        <View style={estilos.colunaDaAlca}>{alca}</View>
        <Pressable accessibilityRole="button" aria-expanded={aberta}
          accessibilityLabel={`Orientação ${n} de ${total}: ${o.titulo.trim() || 'sem título'}${problema === 'perigo' ? PERIGO_NO_ROTULO : ''}. ${aberta ? 'Fechar edição' : 'Editar'}`}
          onPress={aoAlternar} style={estilos.botaoDaLinha}>
          {(estado) => (
            <ResumoDaLinha orientacao={o} emLinha={emLinha} semComeco={aberta} fundo={sobre(estado) && !aberta ? cores.superficie3 : undefined}
              antes={<Seta size={16} color={aberta ? cores.acao : cores.textoSuave} strokeWidth={2.25} aria-hidden />} />
          )}
        </Pressable>
        {mais.botao}
      </View>
      {aberta ? (
        <View style={estilos.edicao} role="group" accessibilityLabel={`Editando orientação ${n}`}>
          <EditorDaOrientacao orientacao={o} n={n} focar={focar} linhas={5} aoMudar={aoMudar} />
        </View>
      ) : null}
      {mais.folha}
    </View>
  );
}

/**
 * Linha dos arranjos lado a lado: uma `option` da `listbox` (só o resumo; a alça e o ⋯ ficam fora dela). Selecionada =
 * a moldura de edição (fundo e contorno de ação, o nível da lista mestre); foco móvel: só a selecionada entra no Tab.
 */
function OpcaoDaOrientacao(props: PropsDaLinha & { selecionada: boolean; registrar: (no: View | null) => void; aoEscolher: () => void; aoTeclar: (tecla: string) => void }) {
  const { orientacao: o, posicao, total, emLinha, alca, selecionada, registrar, aoEscolher, aoTeclar } = props;
  const { cores } = useTema();
  const mais = useMaisAcoes(props);
  const edicao = coresDaEdicao(cores);
  const problema = problemaDaOrientacao(o);
  const teclado = Platform.OS === 'web' ? {
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      aoTeclar(e.key);
    },
  } : null;
  const contorno = problema === 'perigo' ? cores.perigo : selecionada ? edicao.borda : 'transparent';
  return (
    <View style={[estilos.faixa, { backgroundColor: selecionada ? edicao.fundo : cores.superficie2, borderColor: contorno }]}>
      <View style={estilos.linha}>
        <View style={estilos.colunaDaAlca}>{alca}</View>
        <Pressable ref={registrar} role="option" aria-selected={selecionada} tabIndex={selecionada ? 0 : -1} {...(teclado as object)}
          accessibilityLabel={`Orientação ${posicao + 1} de ${total}: ${o.titulo.trim() || 'sem título'}${problema === 'perigo' ? PERIGO_NO_ROTULO : ''}`}
          onPress={aoEscolher} style={estilos.botaoDaLinha}>
          {(estado) => <ResumoDaLinha orientacao={o} emLinha={emLinha} fundo={sobre(estado) && !selecionada ? cores.superficie3 : undefined} />}
        </Pressable>
        {mais.botao}
      </View>
      {mais.folha}
    </View>
  );
}

/**
 * Título (com o aviso "Sem título" embaixo, só aqui) e Texto, que cresce com o que se escreve (de `linhas` até 30, depois
 * rola), com o contador no canto, que o campo aponta como descrição.
 */
function EditorDaOrientacao({ orientacao: o, n, focar, linhas, aoMudar }: { orientacao: Orientacao; n: number; focar: boolean; linhas: number; aoMudar: (o: Orientacao) => void }) {
  const { cores } = useTema();
  const id = useId();
  const L = LIMITES_DOS_COMPLEMENTOS;
  const aviso = avisoDoTitulo(o);
  const idDoAviso = `${id}-aviso`;
  const idDoContador = `${id}-contador`;
  return (
    <>
      <View style={estilos.campoComNota}>
        <Campo rotulo="Título" rotuloAcessivel={`Título da orientação ${n}`} valor={o.titulo} maxLength={L.tituloDaOrientacao} autoFocus={focar}
          placeholder="Ex.: Hidratação" ajudaForaDoCampo={aviso ? { id: idDoAviso, texto: aviso } : undefined} aoMudar={(t) => aoMudar({ ...o, titulo: t })} />
        {aviso ? (
          <View style={estilos.aviso}>
            <View aria-hidden style={estilos.iconeDoAviso}><TriangleAlert size={14} color={cores.atencao} strokeWidth={2.5} /></View>
            <Texto variante="pequeno" nativeID={idDoAviso} style={estilos.textoDoAviso}>{aviso}</Texto>
          </View>
        ) : null}
      </View>
      <View style={estilos.campoComNota}>
        <CampoQueCresce rotulo="Texto" rotuloAcessivel={`Texto da orientação ${n}`} valor={o.texto} linhas={linhas} maximoDeLinhas={30} maxLength={L.textoDaOrientacao}
          ajudaForaDoCampo={{ id: idDoContador, texto: `${inteiroComMilhar(o.texto.length)} de ${inteiroComMilhar(L.textoDaOrientacao)} caracteres` }}
          erro={o.texto.length > L.textoDaOrientacao ? `Até ${inteiroComMilhar(L.textoDaOrientacao)} caracteres.` : null}
          aoMudar={(t) => aoMudar({ ...o, texto: t })} />
        <ContadorDeCaracteres nativeID={idDoContador} usados={o.texto.length} maximo={L.textoDaOrientacao} />
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  // Largura de leitura (~72 caracteres), à esquerda do cartão: a lista, a edição aberta e o botão (26/11).
  aba: { gap: espaco(2), maxWidth: LARGURA_TEXTO_CORRIDO },
  abaVazia: { gap: espaco(2) },
  // Lado a lado (27/11): 40% a lista e 60% o editor com a prévia; o vão sai das duas.
  lado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  colunaDaLista: { flexGrow: 4, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: espaco(2) },
  colunaDoEditor: { flexGrow: 6, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: espaco(3) },
  editorComPreviaAoLado: { flexDirection: 'row', alignItems: 'flex-start' },
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  editorAoLado: { gap: espaco(1.5) },
  itens: { gap: 6 },
  faixa: { borderRadius: 12, borderWidth: 1, paddingHorizontal: espaco(1), paddingVertical: espaco(0.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  colunaDaAlca: { width: LARGURA_DA_ALCA },
  colunaDoMais: { width: ALVO_TOQUE },
  botaoDaLinha: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, justifyContent: 'center', borderRadius: 8 },
  resumo: { gap: 2, paddingHorizontal: espaco(1), paddingVertical: espaco(0.75), borderRadius: 8 },
  resumoEmLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), minWidth: 0 },
  // Em linha, o título fica com no máximo 40% e o começo do texto com o resto (nenhum dos dois empurra o ⋯).
  tituloEmLinha: { flexShrink: 0, maxWidth: '40%' },
  textoDoTitulo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  comeco: { paddingLeft: 16 + espaco(0.75) },
  comecoEmLinha: { flex: 1, minWidth: 0, paddingLeft: 0 },
  edicao: { gap: espaco(1.5), paddingTop: espaco(1), paddingBottom: espaco(1.5), paddingLeft: LARGURA_DA_ALCA + espaco(1.5), paddingRight: espaco(1) },
  campoComNota: { gap: espaco(0.5) },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.5) },
  iconeDoAviso: { paddingTop: 2 },
  textoDoAviso: { flexShrink: 1 },
});

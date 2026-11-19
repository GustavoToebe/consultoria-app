import { Ellipsis, Plus, Trash2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { remover, substituir } from '../../dominio/editorTreino';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import {
  adicionarItem, type ConteudoMobilidade, excluirSecaoPedeConfirmacao, moverItem, moverSecao, novaSecaoMobilidade, removerItem,
  resumoDaSecao, type SecaoMobilidade, secaoValida,
} from '../../dominio/mobilidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR_DE_CAMPOS } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { AlcaDeArraste, type ArrasteDaLista, ItemArrastavel, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { acoesDeMover } from '../acoesDeMover';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { useDuasColunas } from '../plano/ColunasDoEditor';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { mostrarAbaixoDaBarra } from '../plano/TelaDoEditor';
import { ESPERA_DA_SELECAO } from '../treino/ContadoresDoTreino';
import { ItensDaSecao } from './ItemDeMobilidade';

const MAXIMO_DE_SECOES = 10;
const MAXIMO_DE_ITENS = 40;

/**
 * Largura da faixa de ação do painel em edição: a mesma 6 do exercício aberto (`CartaoExercicio`) e da refeição
 * (`CartaoRefeicao`). shortcut: valor repetido nos três editores; se mudar, extrair um token e usar nos três.
 */
const FAIXA_DO_PAINEL = 6;

/** Id no DOM (web) do cartão da seção: `mostrarAbaixoDaBarra` rola até ele ao adicionar uma seção. */
const idDaSecao = (uid: string) => `secao-${uid}`;

type DesfazerDaTela = Desfazer<ConteudoMobilidade> & { voltarPara?: string; secaoDoItem?: string; indiceDaSecao?: number };

/**
 * Seções e itens da mobilidade, no padrão do editor de treino e de dieta (19/11). Usado pelo editor do plano do aluno e
 * pelo do modelo do Planejamento (o topo, configuração ou "Sobre o modelo", fica com cada um). Em duas colunas
 * (`TelaDoEditor colunas`) as seções são a lista à esquerda (`ItemDaListaDoEditor`, com a alça de arrastar) e a escolhida
 * abre à direita, com a faixa de ação; empilhado (celular), cada seção é um cartão, com a alça no cabeçalho. Mover fica
 * na alça e no ⋯ ("Mover para cima/baixo"); excluir seção com itens confirma; remover tem "Desfazer". Nada salva sozinho.
 */
export function SecoesDeMobilidade({ conteudo: mob, aoMudar, irPara, acoes }: {
  conteudo: ConteudoMobilidade;
  aoMudar: (c: ConteudoMobilidade) => void;
  /** "Ir ao primeiro" da lista de problemas: os uids do primeiro problema; `vez` muda a cada pedido. */
  irPara?: { uids: string[]; vez: number } | null;
  /** Botões ao lado de "Seções (N)": o "Modelos" do plano do aluno (o modelo do Planejamento não passa). */
  acoes?: ReactNode;
}) {
  const [desfazer, setDesfazer] = useState<DesfazerDaTela | null>(null);
  const duas = useDuasColunas();
  const { rolarAte } = useRolagem();
  // Seção do inspetor; a que sumiu (removida, modelo recarregado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  // Seção que espera o "Excluir seção" confirmado (só a que tem itens pergunta).
  const [excluir, setExcluir] = useState<string | null>(null);
  // Item recém-adicionado: o Nome dele nasce com o foco (trocar de seção esquece, para voltar não roubar o foco).
  const [itemNovo, setItemNovo] = useState<string | null>(null);
  // Ajuste durante o render (estado derivado): um pedido novo de "ir ao primeiro" escolhe a seção do problema.
  const [vezVista, setVezVista] = useState(irPara?.vez);
  if (irPara && irPara.vez !== vezVista) {
    setVezVista(irPara.vez);
    const alvo = mob.secoes.find((x) => irPara.uids.includes(x.uid) || x.itens.some((i) => irPara.uids.includes(i.uid)));
    if (alvo) setEscolhidaUid(alvo.uid);
  }
  const escolhida = mob.secoes.find((x) => x.uid === escolhidaUid) ?? mob.secoes[0];
  // Arrastar a seção pela alça (na lista ou no cartão empilhado): a mesma regra do ⋯; o Desfazer devolve a ordem.
  // A escolhida segue a seção, não a posição: mover a primeira não troca o que está no inspetor.
  const moverA = (de: number, para: number) => { setEscolhidaUid(escolhida?.uid ?? null); aoMudar(moverSecao(mob, de, para)); };
  const arraste = useArrasteDaLista({ total: mob.secoes.length, aoSoltar: moverA });

  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) =>
    aoMudar({ ...mob, secoes: substituir(mob.secoes, si, mudanca(mob.secoes[si])) });
  const comDesfazer = (rotulo: string, depois: ConteudoMobilidade, onde: Omit<DesfazerDaTela, 'rotulo' | 'conteudo'>) => {
    setDesfazer({ rotulo, conteudo: mob, ...onde });
    aoMudar(depois);
  };
  const removerSecao = (si: number) => {
    const sec = mob.secoes[si];
    const secoes = remover(mob.secoes, si);
    setEscolhidaUid(proximaSelecao(mob.secoes.map((x) => x.uid), secoes.map((x) => x.uid), escolhida?.uid ?? null));
    comDesfazer(`Seção “${sec.titulo.trim() || si + 1}” removida${sec.itens.length ? `, com ${sec.itens.length} ${sec.itens.length === 1 ? 'item' : 'itens'}` : ''}.`, { ...mob, secoes }, { voltarPara: sec.uid, indiceDaSecao: si });
  };
  const pedirExclusao = (si: number) => (excluirSecaoPedeConfirmacao(mob.secoes[si]) ? setExcluir(mob.secoes[si].uid) : removerSecao(si));
  const tirarItem = (si: number, ii: number) => {
    const it = mob.secoes[si].itens[ii];
    comDesfazer(`Item “${it.nome.trim() || ii + 1}” removido.`, removerItem(mob, si, ii), { secaoDoItem: mob.secoes[si].uid });
  };
  const adicionarSecao = () => {
    const nova = novaSecaoMobilidade();
    aoMudar({ ...mob, secoes: [...mob.secoes, nova] });
    setEscolhidaUid(nova.uid);
    // C61: o cartão novo nasce abaixo do botão; sem rolar, o título ficava cortado na borda (web: a barra grudada é da rolagem).
    if (Platform.OS === 'web') setTimeout(() => mostrarAbaixoDaBarra(idDaSecao(nova.uid), true), ESPERA_DA_SELECAO);
    else rolarAte([nova.uid]);
  };

  const barra = desfazer ? (
    <BarraDesfazer key="desfazer" desfazer={desfazer}
      aoDesfazer={() => { const anterior = desfazer; setDesfazer(null); aoMudar(anterior.conteudo); if (anterior.voltarPara) setEscolhidaUid(anterior.voltarPara); }}
      aoFechar={() => setDesfazer(null)} />
  ) : null;
  // No celular as seções são cartões um embaixo do outro: o aviso no topo ficava longe do que saiu. Item removido: o aviso
  // fica na seção dele (se ela está à vista); seção removida, empilhado: no lugar dela. O resto, no topo.
  const avisoNaSecao = desfazer?.secaoDoItem !== undefined
    && (duas ? escolhida?.uid === desfazer.secaoDoItem : mob.secoes.some((x) => x.uid === desfazer.secaoDoItem));
  const avisoNoLugar = !duas && desfazer?.indiceDaSecao !== undefined ? Math.min(desfazer.indiceDaSecao, mob.secoes.length) : null;

  const painel = (sec: SecaoMobilidade, si: number, noInspetor: boolean) => (
    <PainelDaSecao key={sec.uid} secao={sec} posicao={si} total={mob.secoes.length} noInspetor={noInspetor} itemNovo={itemNovo}
      // Empilhado a alça fica no cabeçalho do cartão; em duas colunas ela é do item da lista.
      alca={noInspetor || mob.secoes.length < 2 ? null : <AlcaDeArraste arraste={arraste} indice={si} />}
      aviso={avisoNaSecao && desfazer?.secaoDoItem === sec.uid ? barra : null}
      aoMudarTitulo={(titulo) => alterarSecao(si, (x) => ({ ...x, titulo }))}
      aoMover={(d) => moverA(si, si + d)}
      aoExcluir={mob.secoes.length > 1 ? () => pedirExclusao(si) : undefined}
      aoMudarItem={(ii, parcial) => alterarSecao(si, (x) => ({ ...x, itens: substituir(x.itens, ii, { ...x.itens[ii], ...parcial }) }))}
      aoMoverItem={(de, para) => aoMudar(moverItem(mob, si, de, para))}
      aoRemoverItem={(ii) => tirarItem(si, ii)}
      aoAdicionarItem={() => { const { conteudo, uid } = adicionarItem(mob, si); aoMudar(conteudo); setItemNovo(uid); }} />
  );

  // O único lugar de adicionar seção: no fim da lista (PC) ou dos cartões (celular), como "Adicionar próxima refeição".
  const adicionar = (
    <BlocoAdicionar titulo="Adicionar próxima seção" descricao="Um bloco do plano, como Aquecimento ou Alongamento.">
      <Botao rotulo="Adicionar seção" tipo="acao" Icone={Plus} desabilitado={mob.secoes.length >= MAXIMO_DE_SECOES}
        motivo={`No máximo ${MAXIMO_DE_SECOES} seções.`} aoTocar={adicionarSecao} />
    </BlocoAdicionar>
  );
  const aExcluir = mob.secoes.find((x) => x.uid === excluir);
  const nItens = aExcluir?.itens.length ?? 0;

  return <>
    <View style={estilos.cabecalhoSecoes}>
      <Texto variante="bloco" nivel={2}>Seções ({mob.secoes.length})</Texto>
      {acoes ? <View style={estilos.linha}>{acoes}</View> : null}
    </View>
    {avisoNaSecao || avisoNoLugar !== null ? null : barra}
    {duas && escolhida ? <View style={estilos.colunas}>
      <View style={estilos.lista}>
        <View style={estilos.itensDaLista} role="group" accessibilityLabel="Seções da mobilidade">
          {mob.secoes.map((sec, si) => <ItemDaLista key={sec.uid} secao={sec} posicao={si} total={mob.secoes.length} arraste={arraste}
            escolhida={sec.uid === escolhida.uid} aoEscolher={() => { setEscolhidaUid(sec.uid); setItemNovo(null); }} />)}
        </View>
        {adicionar}
      </View>
      <View style={estilos.inspetor}>{painel(escolhida, mob.secoes.indexOf(escolhida), true)}</View>
    </View> : <>
      {mob.secoes.flatMap((sec, si) => {
        const cartao = <ItemArrastavel key={sec.uid} arraste={arraste} indice={si}>{painel(sec, si, false)}</ItemArrastavel>;
        return si === avisoNoLugar ? [barra, cartao] : [cartao];
      })}
      {avisoNoLugar === mob.secoes.length ? barra : null}
      {adicionar}
    </>}
    <PainelConfirmacao
      visivel={!!aExcluir}
      titulo={`Excluir a seção “${aExcluir ? aExcluir.titulo.trim() || `Seção ${mob.secoes.indexOf(aExcluir) + 1}` : ''}”?`}
      mensagem={`${nItens === 1 ? 'O item dela sai' : `Os ${nItens} itens dela saem`} junto. Dá para desfazer logo depois.`}
      rotuloConfirmar="Excluir seção"
      perigo
      aoConfirmar={() => { const si = aExcluir ? mob.secoes.indexOf(aExcluir) : -1; setExcluir(null); if (si >= 0) removerSecao(si); }}
      aoCancelar={() => setExcluir(null)}
    />
  </>;
}

/** A seção na lista (mestre): o `ItemDaListaDoEditor` com a alça, o "Corrigir" e o resumo dos itens. */
function ItemDaLista({ secao: sec, posicao, total, arraste, escolhida, aoEscolher }: {
  secao: SecaoMobilidade; posicao: number; total: number; arraste: ArrasteDaLista; escolhida: boolean; aoEscolher: () => void;
}) {
  const titulo = sec.titulo.trim() || `Seção ${posicao + 1}`;
  const linha = resumoDaSecao(sec);
  const problema = !secaoValida(sec);
  return (
    <ItemArrastavel arraste={arraste} indice={posicao}>
      <ItemDaListaDoEditor numero={posicao + 1} titulo={titulo} linha={linha} escolhido={escolhida}
        comProblema={problema} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
        rotulo={`Seção ${posicao + 1} de ${total}: ${titulo}${problema ? ', corrigir' : ''}. ${linha}`}
        alca={<AlcaDeArraste arraste={arraste} indice={posicao} />} aoEscolher={aoEscolher} />
    </ItemArrastavel>
  );
}

/**
 * A seção aberta: no cabeçalho (faixa `superficie3`), "Seção N de M", o título editável ali mesmo, o ⋯ (mover) e
 * "Excluir seção"; no corpo, os itens em tabela e "Adicionar item". No inspetor ganha a faixa de ação à esquerda (o
 * único destaque de ação do painel: o selo "Editando" fica só no item da lista). Com problema, o contorno fica vermelho.
 */
function PainelDaSecao({ secao: sec, posicao, total, noInspetor, itemNovo, alca, aviso, aoMudarTitulo, aoMover, aoExcluir, aoMudarItem, aoMoverItem, aoRemoverItem, aoAdicionarItem }: {
  secao: SecaoMobilidade;
  posicao: number;
  total: number;
  noInspetor: boolean;
  itemNovo: string | null;
  alca: ReactNode;
  aviso: ReactNode;
  aoMudarTitulo: (titulo: string) => void;
  aoMover: (delta: -1 | 1) => void;
  /** Sem ele (a única seção), não há "Excluir seção": o plano precisa de ao menos uma. */
  aoExcluir?: () => void;
  aoMudarItem: Parameters<typeof ItensDaSecao>[0]['aoMudar'];
  aoMoverItem: (de: number, para: number) => void;
  aoRemoverItem: (indice: number) => void;
  aoAdicionarItem: () => void;
}) {
  const { cores, bordas } = useTema();
  const [menu, setMenu] = useState(false);
  const n = posicao + 1;
  const titulo = sec.titulo.trim() || `Seção ${n}`;
  const problema = !secaoValida(sec);
  const acoesDoMenu = acoesDeMover({ nome: titulo, posicao, total, aoMover });
  return (
    <AlvoDeRolagem chave={sec.uid}><View nativeID={idDaSecao(sec.uid)}><Cartao
      style={[noInspetor ? { borderLeftWidth: FAIXA_DO_PAINEL, borderLeftColor: cores.acao } : null, problema ? { borderColor: cores.perigo } : null]}
      cabecalho={
        <View style={[estilos.cabecalho, alca ? estilos.cabecalhoComAlca : null, { backgroundColor: cores.superficie3, borderBottomColor: cores.divisor, borderBottomWidth: bordas.bloco }]}>
          {alca}
          <View style={estilos.tituloDaSecao}>
            {/* Em cima, a posição e as ações (no celular não roubam a largura do título); embaixo, o título na largura toda. */}
            <View style={estilos.linhaDoContexto}>
              <View style={estilos.contexto}>
                <Texto variante="pequeno" numerico>{`Seção ${n} de ${total}`}</Texto>
                {problema ? <Selo texto="Corrigir" tipo="perigo" /> : null}
              </View>
              {acoesDoMenu.length || aoExcluir ? (
                <View style={estilos.acoesDaSecao}>
                  {acoesDoMenu.length ? <IconeBotao moldura Icone={Ellipsis} rotulo={`Mais ações de ${titulo}`} aoTocar={() => setMenu(true)} /> : null}
                  {aoExcluir ? <Botao tipo="perigoTexto" rotulo="Excluir seção" rotuloAcessivel={`Excluir seção ${titulo}`} Icone={Trash2} aoTocar={aoExcluir} /> : null}
                </View>
              ) : null}
            </View>
            <Campo rotulo="Título da seção" rotuloOculto rotuloAcessivel={`Título da seção ${n}`} valor={sec.titulo} maxLength={80}
              placeholder="Ex.: Aquecimento" aoMudar={aoMudarTitulo} />
          </View>
        </View>
      }>
      <View style={estilos.corpo}>
        <Texto variante="secao">Itens ({sec.itens.length})</Texto>
        {sec.itens.length === 0 ? <Texto variante="suave">Seção sem item. Adicione ao menos um.</Texto> : (
          <ItensDaSecao itens={sec.itens} focarUid={itemNovo} aoMudar={aoMudarItem} aoMover={aoMoverItem} aoRemover={aoRemoverItem} />
        )}
        {aviso}
        <View style={estilos.linha}>
          <Botao rotulo="Adicionar item" rotuloAcessivel={`Adicionar item em ${titulo}`} tipo="acao" Icone={Plus}
            desabilitado={sec.itens.length >= MAXIMO_DE_ITENS} motivo={`No máximo ${MAXIMO_DE_ITENS} itens por seção.`} aoTocar={aoAdicionarItem} />
        </View>
      </View>
    </Cartao>
    {menu ? <FolhaDeAcoes titulo={titulo} aoFechar={() => setMenu(false)} acoes={acoesDoMenu} /> : null}
    </View></AlvoDeRolagem>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  // Lista de 280 px (a mesma da dieta): em 1280 com o menu aberto o painel fica com ~710 px e os itens em tabela.
  lista: { width: 280, flexShrink: 0, gap: espaco(2) },
  itensDaLista: { gap: espaco(1) },
  // Na tela larga o painel para em ~1400 px, à esquerda junto da lista; a sobra fica vazia (nunca campo esticado).
  inspetor: { flex: 1, minWidth: 0, maxWidth: LARGURA_EDITOR_DE_CAMPOS },
  cabecalhoSecoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  cabecalho: { flexDirection: 'row', alignItems: 'stretch', gap: espaco(0.5), paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
  // Com a alça, o recuo da esquerda fica com ela (a alça já tem a largura do vão), como no exercício.
  cabecalhoComAlca: { paddingLeft: espaco(0.5) },
  tituloDaSecao: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  linhaDoContexto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1) },
  contexto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexGrow: 1, flexShrink: 1 },
  acoesDaSecao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), marginLeft: 'auto' },
  corpo: { gap: espaco(1.5) },
});

import { ChevronsDownUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mover, remover, substituir } from '../../dominio/editorTreino';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { type ConteudoMobilidade, type ItemMobilidade, type SecaoMobilidade, novaSecaoMobilidade, novoItemMobilidade, secaoValida } from '../../dominio/mobilidade';
import { videoValido } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Divisor } from '../../ui/Divisor';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { useDuasColunas } from '../plano/ColunasDoEditor';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';
import { ItemDeMobilidade } from './ItemDeMobilidade';

const MAXIMO_DE_SECOES = 10;
const MAXIMO_DE_ITENS = 40;

/** Item que trava o salvar: sem nome ou com link que não é do YouTube (a mesma regra de `secaoValida`). */
const itemComProblema = (i: ItemMobilidade) => !i.nome.trim() || (!!i.videoUrl.trim() && !videoValido(i.videoUrl));

/**
 * Orientações, seções e itens da mobilidade (nome, prescrição em texto e vídeo). Usado pelo editor do plano do aluno e
 * pelo editor do modelo do Planejamento: a edição é a mesma, só muda onde salva. Em duas colunas (`TelaDoEditor
 * colunas`) as seções viram a lista à esquerda e a escolhida abre à direita com os itens sempre abertos; o cartão do
 * plano (`aoLado`: a configuração no plano do aluno, nome e descrição no modelo) e as Orientações dividem a linha de
 * cima. Empilhado (celular e telas estreitas), cada seção é um cartão e os itens abrem e fecham no lugar. Remover
 * seção ou item tem "Desfazer" (revisão dos editores, 04/11).
 */
export function SecoesDeMobilidade({ conteudo: mob, aoMudar, irPara, aoLado, acoes }: {
  conteudo: ConteudoMobilidade;
  aoMudar: (c: ConteudoMobilidade) => void;
  /** "Ir ao primeiro" da lista de problemas: os uids do primeiro problema; `vez` muda a cada pedido. */
  irPara?: { uids: string[]; vez: number } | null;
  /** O cartão do plano que fica ao lado das Orientações em duas colunas (e em cima delas, empilhado). */
  aoLado?: ReactNode;
  /** Botões ao lado de "Seções (N)": o "Modelos" do plano do aluno (o modelo do Planejamento não passa). */
  acoes?: ReactNode;
}) {
  const { cores } = useTema();
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  // `secaoDoItem`/`indiceDaSecao`: onde o aviso aparece (no lugar do que saiu, para o Desfazer ficar à vista).
  const [desfazer, setDesfazer] = useState<(Desfazer<ConteudoMobilidade> & { voltarPara?: string; secaoDoItem?: string; indiceDaSecao?: number }) | null>(null);
  const duas = useDuasColunas();
  // Seção do inspetor; a que sumiu (removida, modelo recarregado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  // Ajuste durante o render (estado derivado): um pedido novo de "ir ao primeiro" escolhe a seção do problema.
  const [vezVista, setVezVista] = useState(irPara?.vez);
  if (irPara && irPara.vez !== vezVista) {
    setVezVista(irPara.vez);
    const alvo = mob.secoes.find((x) => irPara.uids.includes(x.uid) || x.itens.some((i) => irPara.uids.includes(i.uid)));
    if (alvo) {
      setEscolhidaUid(alvo.uid);
      setAbertos((a) => new Set([...a, ...alvo.itens.filter((i) => irPara.uids.includes(i.uid) || itemComProblema(i)).map((i) => i.uid)]));
    }
  }
  const escolhida = mob.secoes.find((x) => x.uid === escolhidaUid) ?? mob.secoes[0];
  const alternar = (uid: string) => setAbertos((a) => { const novo = new Set(a); if (novo.has(uid)) novo.delete(uid); else novo.add(uid); return novo; });
  // Em duas colunas os itens da escolhida já estão abertos: "Abrir todos" só existe empilhado.
  const todos = mob.secoes.flatMap((x) => x.itens.map((i) => i.uid));
  const todosAbertos = todos.length > 0 && todos.every((u) => abertos.has(u));
  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) =>
    aoMudar({ ...mob, secoes: substituir(mob.secoes, si, mudanca(mob.secoes[si])) });
  const comDesfazer = (rotulo: string, depois: ConteudoMobilidade, onde: { voltarPara?: string; secaoDoItem?: string; indiceDaSecao?: number }) => {
    setDesfazer({ rotulo, conteudo: mob, ...onde });
    aoMudar(depois);
  };
  const removerSecao = (si: number) => {
    const sec = mob.secoes[si];
    const secoes = remover(mob.secoes, si);
    setEscolhidaUid(proximaSelecao(mob.secoes.map((x) => x.uid), secoes.map((x) => x.uid), escolhida?.uid ?? null));
    comDesfazer(`Seção “${sec.titulo.trim() || si + 1}” removida${sec.itens.length ? `, com ${sec.itens.length} ${sec.itens.length === 1 ? 'item' : 'itens'}` : ''}.`, { ...mob, secoes }, { voltarPara: sec.uid, indiceDaSecao: si });
  };
  const removerItem = (si: number, ii: number) => {
    const it = mob.secoes[si].itens[ii];
    comDesfazer(`Item “${it.nome.trim() || ii + 1}” removido.`, { ...mob, secoes: substituir(mob.secoes, si, { ...mob.secoes[si], itens: remover(mob.secoes[si].itens, ii) }) }, { secaoDoItem: mob.secoes[si].uid });
  };
  const adicionarSecao = () => {
    const nova = novaSecaoMobilidade();
    aoMudar({ ...mob, secoes: [...mob.secoes, nova] });
    setEscolhidaUid(nova.uid);
    setAbertos((a) => new Set(a).add(nova.itens[0].uid));
  };

  const barra = desfazer ? (
    <BarraDesfazer key="desfazer" desfazer={desfazer}
      aoDesfazer={() => { const anterior = desfazer; setDesfazer(null); aoMudar(anterior.conteudo); if (anterior.voltarPara) setEscolhidaUid(anterior.voltarPara); }}
      aoFechar={() => setDesfazer(null)} />
  ) : null;
  // No celular as seções são cartões abertos um embaixo do outro: o aviso no topo ficava longe do que saiu. Item removido:
  // o aviso fica na seção dele (se ela está à vista); seção removida, empilhado: no lugar dela. O resto, no topo.
  const avisoNaSecao = desfazer?.secaoDoItem !== undefined
    && (duas ? escolhida?.uid === desfazer.secaoDoItem : mob.secoes.some((x) => x.uid === desfazer.secaoDoItem));
  const avisoNoLugar = !duas && desfazer?.indiceDaSecao !== undefined ? Math.min(desfazer.indiceDaSecao, mob.secoes.length) : null;

  const cartaoDaSecao = (sec: SecaoMobilidade, si: number, noInspetor: boolean) => {
    const titulo = sec.titulo.trim() || `Seção ${si + 1}`;
    const problema = !secaoValida(sec);
    return (
      <Cartao key={sec.uid} style={problema ? { borderColor: cores.perigo } : undefined}
        cabecalho={
          <CabecalhoDoItem faixa
            // A posição por extenso só no inspetor: empilhadas, a ordem já está à vista.
            contexto={noInspetor ? `Seção ${si + 1} de ${mob.secoes.length}` : undefined}
            titulo={titulo} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined} aberto
            nomeDoItem={titulo} posicao={si} total={mob.secoes.length}
            aoMover={(d) => aoMudar({ ...mob, secoes: mover(mob.secoes, si, d) })}
            // A única seção não sai: o plano precisa de ao menos uma.
            remover={mob.secoes.length > 1 ? <IconeBotao Icone={Trash2} rotulo={`Remover ${titulo}`} cor={cores.perigo} aoTocar={() => removerSecao(si)} /> : undefined} />
        }>
        <View style={estilos.corpo}>
          <View style={estilos.medida}>
            <Campo rotulo="Título da seção" rotuloAcessivel={`Título da seção ${si + 1}`} valor={sec.titulo} maxLength={80} placeholder="Ex.: Aquecimento"
              aoMudar={(t) => alterarSecao(si, (x) => ({ ...x, titulo: t }))} />
          </View>
          <Divisor />
          <Texto variante="secao">Itens ({sec.itens.length})</Texto>
          {sec.itens.length === 0 ? <Texto variante="suave">Seção sem item. Adicione ao menos um.</Texto> : null}
          <View style={estilos.itens}>
            {sec.itens.map((it, ii) => (
              <ItemDeMobilidade key={it.uid} item={it} posicao={ii} total={sec.itens.length} comProblema={itemComProblema(it)}
                aberto={noInspetor || abertos.has(it.uid)} aoAlternar={noInspetor ? undefined : () => alternar(it.uid)}
                aoMudar={(parcial) => alterarSecao(si, (x) => ({ ...x, itens: substituir(x.itens, ii, { ...it, ...parcial }) }))}
                aoMover={(d) => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, d) }))}
                aoRemover={() => removerItem(si, ii)} />
            ))}
          </View>
          {avisoNaSecao && desfazer?.secaoDoItem === sec.uid ? barra : null}
          <View style={estilos.linha}>
            <Botao rotulo="Adicionar item" rotuloAcessivel={`Adicionar item em ${titulo}`} tipo="secundario" Icone={Plus}
              desabilitado={sec.itens.length >= MAXIMO_DE_ITENS} motivo={`No máximo ${MAXIMO_DE_ITENS} itens por seção.`}
              aoTocar={() => { const novo = novoItemMobilidade(); alterarSecao(si, (x) => ({ ...x, itens: [...x.itens, novo] })); setAbertos((a) => new Set(a).add(novo.uid)); }} />
          </View>
        </View>
      </Cartao>
    );
  };

  // O único lugar de adicionar seção: no fim da lista (PC) ou dos cartões (celular), como "Adicionar próxima refeição".
  const adicionar = (
    <BlocoAdicionar titulo="Adicionar próxima seção" descricao="Um bloco do plano, como Aquecimento ou Alongamento.">
      <Botao rotulo="Adicionar seção" tipo="secundario" Icone={Plus} desabilitado={mob.secoes.length >= MAXIMO_DE_SECOES}
        motivo={`No máximo ${MAXIMO_DE_SECOES} seções.`} aoTocar={adicionarSecao} />
    </BlocoAdicionar>
  );

  const orientacoes = (
    // Opcional: vazio, nasce recolhido para as seções subirem (o título continua dizendo que existe).
    <Cartao titulo="Orientações" descricao="O aluno lê antes das seções (opcional)." faixa recolhivel recolhido={!mob.orientacoes.trim()}
      style={duas ? estilos.metade : undefined}>
      <View style={estilos.medida}>
        <Campo rotulo="Orientações" rotuloOculto rotuloAcessivel="Orientações (opcional)" valor={mob.orientacoes} linhas={4} maxLength={2000}
          aoMudar={(orientacoes) => aoMudar({ ...mob, orientacoes })} />
      </View>
    </Cartao>
  );

  return <>
    {/* A mesma árvore nas duas larguras (só o estilo muda): cruzar os 960 px não remonta as Orientações nem tira o foco. */}
    <View style={duas ? estilos.linhaDeCima : estilos.empilhados}>
      {aoLado ? <View style={duas ? estilos.metade : undefined}>{aoLado}</View> : null}
      {orientacoes}
    </View>
    <View style={estilos.cabecalhoSecoes}>
      <Texto variante="bloco" nivel={2}>Seções ({mob.secoes.length})</Texto>
      <View style={estilos.linha}>
        {!duas && todos.length > 1 ? <Botao rotulo={todosAbertos ? 'Fechar todos' : 'Abrir todos'} tipo="fantasma" Icone={todosAbertos ? ChevronsDownUp : ChevronsUpDown}
          aoTocar={() => setAbertos(todosAbertos ? new Set() : new Set(todos))} /> : null}
        {acoes}
      </View>
    </View>
    {avisoNaSecao || avisoNoLugar !== null ? null : barra}
    {duas && escolhida ? <View style={estilos.colunas}>
      <View style={estilos.lista}>
        <View style={estilos.itensDaLista} role="group" accessibilityLabel="Seções da mobilidade">
          {mob.secoes.map((sec, si) => {
            const titulo = sec.titulo.trim() || `Seção ${si + 1}`;
            const linha = resumoDaSecao(sec);
            const problema = !secaoValida(sec);
            return <ItemDaListaDoEditor key={sec.uid} numero={si + 1} titulo={titulo} linha={linha} escolhido={sec.uid === escolhida.uid}
              comProblema={problema} selo={problema ? { texto: 'Corrigir', tipo: 'perigo' } : undefined}
              rotulo={`Seção ${si + 1} de ${mob.secoes.length}: ${titulo}${problema ? ', corrigir' : ''}. ${linha}`}
              aoEscolher={() => setEscolhidaUid(sec.uid)} />;
          })}
        </View>
        {adicionar}
      </View>
      <View style={estilos.inspetor}>{cartaoDaSecao(escolhida, mob.secoes.indexOf(escolhida), true)}</View>
    </View> : <>
      {mob.secoes.flatMap((sec, si) => (si === avisoNoLugar ? [barra, cartaoDaSecao(sec, si, false)] : [cartaoDaSecao(sec, si, false)]))}
      {avisoNoLugar === mob.secoes.length ? barra : null}
      {adicionar}
    </>}
  </>;
}

/** "3 itens: Gato-vaca, Lunge…" na lista de seções; sem item, "Nenhum item". */
function resumoDaSecao(sec: SecaoMobilidade): string {
  if (sec.itens.length === 0) return 'Nenhum item';
  const nomes = sec.itens.map((i) => i.nome.trim()).filter(Boolean).join(', ');
  return `${sec.itens.length} ${sec.itens.length === 1 ? 'item' : 'itens'}${nomes ? `: ${nomes}` : ''}`;
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  // Configuração (ou nome do modelo) e Orientações lado a lado: os dois são do plano inteiro.
  linhaDeCima: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  // Empilhados, o mesmo espaço entre blocos da tela (`TelaDoEditor`).
  empilhados: { gap: espaco(3) },
  metade: { flex: 1, minWidth: 0 },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  lista: { width: 280, flexShrink: 0, gap: espaco(2) },
  itensDaLista: { gap: espaco(1) },
  inspetor: { flex: 1, minWidth: 0 },
  cabecalhoSecoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  corpo: { gap: espaco(1.5) },
  // Campos de texto na medida do editor (em 1920 o inspetor passa de 1300 px), como a configuração e os dados da refeição.
  medida: { width: '100%', maxWidth: LARGURA_EDITOR },
  itens: { gap: espaco(1) },
});

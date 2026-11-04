import { ArrowDown, ArrowUp, ChevronsDownUp, ChevronsUpDown, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mover } from '../../dominio/editorTreino';
import { proximaSelecao } from '../../dominio/inspetorDoTreino';
import { type ConteudoMobilidade, type ItemMobilidade, type SecaoMobilidade, novaSecaoMobilidade, novoItemMobilidade, secaoValida } from '../../dominio/mobilidade';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { useDuasColunas } from '../plano/ColunasDoEditor';
import { ItemDaListaDoEditor } from '../plano/ItemDaListaDoEditor';

/**
 * Orientações, seções e itens da mobilidade (nome, prescrição em texto e vídeo). Usado pelo editor do plano do aluno e
 * pelo editor do modelo do Planejamento: a edição é a mesma, só muda onde salva. Cada item fechado é uma linha
 * ("1. Gato-vaca · 2×10 · com vídeo") com a gramática dos outros editores (setas movem, chevron abre); "Abrir todos" no
 * topo das seções. O título da seção é o próprio campo, no cabeçalho do cartão. Em duas colunas (`TelaDoEditor colunas`,
 * 960 px de conteúdo, como o treino e a dieta) as seções viram uma lista à esquerda e a escolhida abre à direita, com os
 * itens; "Abrir todos" vale para os itens dela.
 */
export function SecoesDeMobilidade({ conteudo: mob, aoMudar }: { conteudo: ConteudoMobilidade; aoMudar: (c: ConteudoMobilidade) => void }) {
  const { cores } = useTema();
  const [removerSecao, setRemoverSecao] = useState<number | null>(null);
  const [removerItem, setRemoverItem] = useState<{ secao: number; item: number } | null>(null);
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const duas = useDuasColunas();
  // Seção do inspetor; a que sumiu (removida, modelo recarregado) cai na primeira.
  const [escolhidaUid, setEscolhidaUid] = useState<string | null>(null);
  const escolhida = mob.secoes.find((x) => x.uid === escolhidaUid) ?? mob.secoes[0];
  const alternar = (uid: string) => setAbertos((a) => { const novo = new Set(a); if (novo.has(uid)) novo.delete(uid); else novo.add(uid); return novo; });
  const todos = (duas ? (escolhida ? [escolhida] : []) : mob.secoes).flatMap((x) => x.itens.map((i) => i.uid));
  const todosAbertos = todos.length > 0 && todos.every((u) => abertos.has(u));
  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) =>
    aoMudar({ ...mob, secoes: mob.secoes.map((x, n) => (n === si ? mudanca(x) : x)) });
  const alterarItem = (si: number, ii: number, parcial: Partial<ItemMobilidade>) =>
    alterarSecao(si, (x) => ({ ...x, itens: x.itens.map((y, m) => (m === ii ? { ...y, ...parcial } : y)) }));
  const secaoAremover = removerSecao === null ? null : mob.secoes[removerSecao];
  const itemAremover = removerItem ? mob.secoes[removerItem.secao]?.itens[removerItem.item] : undefined;
  const cartaoDaSecao = (sec: SecaoMobilidade, si: number) => <Cartao key={sec.uid}>
    <View style={estilos.tituloSecao}>
      <View style={estilos.campoTitulo}>
        <Campo rotulo={`Seção ${si + 1}`} valor={sec.titulo} maxLength={80} placeholder="Ex.: Aquecimento" aoMudar={(titulo) => alterarSecao(si, (x) => ({ ...x, titulo }))} />
      </View>
      <View style={estilos.acoesSecao}>
        {mob.secoes.length > 1 ? <>
          <IconeBotao Icone={ArrowUp} rotulo={`Subir a seção ${si + 1}`} desabilitado={si === 0} aoTocar={() => aoMudar({ ...mob, secoes: mover(mob.secoes, si, -1) })} />
          <IconeBotao Icone={ArrowDown} rotulo={`Descer a seção ${si + 1}`} desabilitado={si === mob.secoes.length - 1} aoTocar={() => aoMudar({ ...mob, secoes: mover(mob.secoes, si, 1) })} />
          <IconeBotao Icone={Trash2} rotulo={`Remover a seção ${sec.titulo || si + 1}`} aoTocar={() => setRemoverSecao(si)} />
        </> : null}
      </View>
    </View>
    {sec.itens.map((it, ii) => <View key={it.uid} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <CabecalhoDoItem titulo={`${ii + 1}. ${it.nome || 'Item sem nome'}`} resumo={abertos.has(it.uid) ? undefined : resumoDoItem(it)}
        aberto={abertos.has(it.uid)} aoAlternar={() => alternar(it.uid)} nomeDoItem="item" posicao={ii} total={sec.itens.length}
        aoMover={(d) => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, d) }))}
        remover={<IconeBotao Icone={Trash2} rotulo={`Remover ${it.nome || 'item'}`} aoTocar={() => setRemoverItem({ secao: si, item: ii })} />} />
      {abertos.has(it.uid) ? <View style={estilos.corpoItem}>
        <Campo rotulo="Nome do exercício" valor={it.nome} maxLength={120} aoMudar={(nome) => alterarItem(si, ii, { nome })} />
        <Campo rotulo="Prescrição (ex.: 2 x 20s cada lado)" valor={it.prescricao} maxLength={120} aoMudar={(prescricao) => alterarItem(si, ii, { prescricao })} />
        <Campo rotulo="Vídeo (link do YouTube, opcional)" valor={it.videoUrl} maxLength={500} autoCapitalize="none" erro={erroDoVideo(it.videoUrl)} aoMudar={(videoUrl) => alterarItem(si, ii, { videoUrl })} />
      </View> : null}
    </View>)}
    {sec.itens.length === 0 ? <Texto variante="suave">Seção sem item. Adicione ao menos um.</Texto> : null}
    <View style={estilos.linha}>
      <Botao rotulo="Adicionar item" tipo="secundario" Icone={Plus} desabilitado={sec.itens.length >= 40} motivo="No máximo 40 itens por seção."
        aoTocar={() => { const novo = novoItemMobilidade(); alterarSecao(si, (x) => ({ ...x, itens: [...x.itens, novo] })); setAbertos((a) => new Set(a).add(novo.uid)); }} />
    </View>
  </Cartao>;
  const adicionarSecao = <View style={estilos.linha}>
    <Botao rotulo="Adicionar seção" tipo="secundario" Icone={Plus} desabilitado={mob.secoes.length >= 10} motivo="No máximo 10 seções."
      aoTocar={() => { const nova = novaSecaoMobilidade(); aoMudar({ ...mob, secoes: [...mob.secoes, nova] }); setEscolhidaUid(nova.uid); }} />
  </View>;
  return <>
    <Cartao titulo="Orientações" descricao="Texto geral que o aluno lê antes das seções (opcional).">
      <Campo rotulo="Orientações (opcional)" valor={mob.orientacoes} aoMudar={(orientacoes) => aoMudar({ ...mob, orientacoes })} linhas={3} maxLength={2000} />
    </Cartao>
    <View style={estilos.cabecalhoSecoes}>
      <Texto variante="bloco" nivel={2}>Seções ({mob.secoes.length})</Texto>
      {todos.length > 1 ? <Botao rotulo={todosAbertos ? 'Fechar todos' : 'Abrir todos'} tipo="fantasma" Icone={todosAbertos ? ChevronsDownUp : ChevronsUpDown}
        aoTocar={() => setAbertos(todosAbertos ? new Set() : new Set(todos))} /> : null}
    </View>
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
        {adicionarSecao}
      </View>
      <View style={estilos.inspetor}>{cartaoDaSecao(escolhida, mob.secoes.indexOf(escolhida))}</View>
    </View> : <>
      {mob.secoes.map(cartaoDaSecao)}
      {adicionarSecao}
    </>}
    <PainelConfirmacao visivel={removerSecao !== null} titulo={`Remover a seção “${secaoAremover?.titulo || (removerSecao ?? 0) + 1}”?`}
      mensagem={secaoAremover?.itens.length ? `Os ${secaoAremover.itens.length} itens dela saem junto. Nada é salvo até você salvar.` : undefined}
      rotuloConfirmar="Remover seção" perigo aoCancelar={() => setRemoverSecao(null)}
      aoConfirmar={() => {
        const n = removerSecao; setRemoverSecao(null); if (n === null) return;
        const depois = mob.secoes.filter((_, m) => m !== n);
        setEscolhidaUid(proximaSelecao(mob.secoes.map((x) => x.uid), depois.map((x) => x.uid), escolhida?.uid ?? null));
        aoMudar({ ...mob, secoes: depois });
      }} />
    <PainelConfirmacao visivel={itemAremover !== undefined} titulo={`Remover o item “${itemAremover?.nome || (removerItem?.item ?? 0) + 1}”?`} mensagem="O item sai da seção. Nada é salvo até você salvar."
      rotuloConfirmar="Remover item" perigo aoCancelar={() => setRemoverItem(null)}
      aoConfirmar={() => { const alvo = removerItem; setRemoverItem(null); if (alvo) alterarSecao(alvo.secao, (x) => ({ ...x, itens: x.itens.filter((_, m) => m !== alvo.item) })); }} />
  </>;
}

/** "3 itens: Gato-vaca, Lunge…" na lista de seções; sem item, "Nenhum item". */
function resumoDaSecao(sec: SecaoMobilidade): string {
  if (sec.itens.length === 0) return 'Nenhum item';
  const nomes = sec.itens.map((i) => i.nome.trim()).filter(Boolean).join(', ');
  return `${sec.itens.length} ${sec.itens.length === 1 ? 'item' : 'itens'}${nomes ? `: ${nomes}` : ''}`;
}

/** "2 x 20s cada lado · com vídeo"; sem nada, "Sem prescrição". */
function resumoDoItem(it: ItemMobilidade): string {
  return [it.prescricao.trim() || 'Sem prescrição', it.videoUrl.trim() ? 'com vídeo' : null].filter(Boolean).join(' · ');
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  lista: { width: 280, flexShrink: 0, gap: espaco(1.5) },
  itensDaLista: { gap: espaco(1) },
  inspetor: { flex: 1, minWidth: 0 },
  cabecalhoSecoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  tituloSecao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoTitulo: { flex: 1 },
  acoesSecao: { flexDirection: 'row' },
  item: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), gap: espaco(1) },
  corpoItem: { gap: espaco(1.5), paddingBottom: espaco(1) },
});

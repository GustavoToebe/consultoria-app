import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { mover } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, type ItemMobilidade, type SecaoMobilidade, novaSecaoMobilidade, novoItemMobilidade } from '../../dominio/mobilidade';
import { erroDoVideo } from '../../dominio/video';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';

/**
 * Orientações, seções e itens da mobilidade (nome, prescrição em texto e vídeo). Usado pelo editor do plano do aluno e
 * pelo editor do modelo do Planejamento: a edição é a mesma, só muda onde salva.
 */
export function SecoesDeMobilidade({ conteudo: mob, aoMudar }: { conteudo: ConteudoMobilidade; aoMudar: (c: ConteudoMobilidade) => void }) {
  const [removerSecao, setRemoverSecao] = useState<number | null>(null);
  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) =>
    aoMudar({ ...mob, secoes: mob.secoes.map((x, n) => (n === si ? mudanca(x) : x)) });
  const alterarItem = (si: number, ii: number, parcial: Partial<ItemMobilidade>) =>
    alterarSecao(si, (x) => ({ ...x, itens: x.itens.map((y, m) => (m === ii ? { ...y, ...parcial } : y)) }));
  const secaoAremover = removerSecao === null ? null : mob.secoes[removerSecao];
  return <>
    <Cartao titulo="Orientações" descricao="Texto geral que o aluno lê antes das seções (opcional).">
      <Campo rotulo="Orientações (opcional)" valor={mob.orientacoes} aoMudar={(orientacoes) => aoMudar({ ...mob, orientacoes })} linhas={3} maxLength={2000} />
    </Cartao>
    {mob.secoes.map((sec, si) => <Cartao key={sec.uid} titulo={sec.titulo || `Seção ${si + 1}`}
      acoes={<Botao rotulo="Remover seção" tipo="perigoTexto" Icone={Trash2} desabilitado={mob.secoes.length <= 1} aoTocar={() => setRemoverSecao(si)} />}>
      <Campo rotulo="Título da seção" valor={sec.titulo} maxLength={80} aoMudar={(titulo) => alterarSecao(si, (x) => ({ ...x, titulo }))} />
      {sec.itens.map((it, ii) => <ItemDaSecao key={it.uid} item={it} posicao={ii} total={sec.itens.length}
        aoMudar={(parcial) => alterarItem(si, ii, parcial)}
        aoMover={(d) => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, d) }))}
        aoRemover={() => alterarSecao(si, (x) => ({ ...x, itens: x.itens.filter((_, m) => m !== ii) }))} />)}
      <View style={estilos.linha}>
        <Botao rotulo="Adicionar item" tipo="secundario" Icone={Plus} desabilitado={sec.itens.length >= 40} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: [...x.itens, novoItemMobilidade()] }))} />
      </View>
    </Cartao>)}
    <View style={estilos.linha}>
      <Botao rotulo="Adicionar seção" tipo="secundario" Icone={Plus} desabilitado={mob.secoes.length >= 10} aoTocar={() => aoMudar({ ...mob, secoes: [...mob.secoes, novaSecaoMobilidade()] })} />
    </View>
    <PainelConfirmacao visivel={removerSecao !== null} titulo={`Remover a seção “${secaoAremover?.titulo || (removerSecao ?? 0) + 1}”?`}
      mensagem={secaoAremover?.itens.length ? `Os ${secaoAremover.itens.length} itens dela saem junto. Nada é salvo até você publicar.` : undefined}
      rotuloConfirmar="Remover seção" perigo aoCancelar={() => setRemoverSecao(null)}
      aoConfirmar={() => { const n = removerSecao; setRemoverSecao(null); if (n !== null) aoMudar({ ...mob, secoes: mob.secoes.filter((_, m) => m !== n) }); }} />
  </>;
}

/** Um item: nome e prescrição no mesmo bloco, ordem nas setas do cabeçalho e o vídeo recolhido até ter link. */
function ItemDaSecao({ item: it, posicao, total, aoMudar, aoMover, aoRemover }: {
  item: ItemMobilidade; posicao: number; total: number; aoMudar: (parcial: Partial<ItemMobilidade>) => void; aoMover: (d: -1 | 1) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const [videoAberto, setVideoAberto] = useState(!!it.videoUrl);
  const [removendo, setRemovendo] = useState(false);
  return <Cartao titulo={`${posicao + 1}. ${it.nome || 'Item sem nome'}`} style={{ backgroundColor: cores.superficie2 }}
    acoes={<View style={estilos.setas}>
      <IconeBotao Icone={ArrowUp} rotulo="Subir item" desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
      <IconeBotao Icone={ArrowDown} rotulo="Descer item" desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
    </View>}>
    <Campo rotulo="Nome do exercício" valor={it.nome} maxLength={120} aoMudar={(nome) => aoMudar({ nome })} />
    <Campo rotulo="Prescrição (ex.: 2 x 20s cada lado)" valor={it.prescricao} maxLength={120} aoMudar={(prescricao) => aoMudar({ prescricao })} />
    <CabecalhoDeGrupo titulo="Vídeo" aberto={videoAberto} aoAlternar={() => setVideoAberto((v) => !v)} />
    {videoAberto ? <Campo rotulo="Link do vídeo (YouTube)" valor={it.videoUrl} maxLength={500} autoCapitalize="none" erro={erroDoVideo(it.videoUrl)} aoMudar={(videoUrl) => aoMudar({ videoUrl })} /> : null}
    <View style={estilos.linha}>
      <Botao rotulo="Remover item" tipo="perigoTexto" Icone={Trash2} aoTocar={() => setRemovendo(true)} />
    </View>
    <PainelConfirmacao visivel={removendo} titulo={`Remover o item “${it.nome || posicao + 1}”?`} mensagem="O item sai da seção. Nada é salvo até você publicar."
      rotuloConfirmar="Remover item" perigo aoCancelar={() => setRemovendo(false)} aoConfirmar={() => { setRemovendo(false); aoRemover(); }} />
  </Cartao>;
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  setas: { flexDirection: 'row' },
});

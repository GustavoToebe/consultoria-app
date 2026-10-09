import { mover } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, type ItemMobilidade, type SecaoMobilidade, novaSecaoMobilidade, novoItemMobilidade } from '../../dominio/mobilidade';
import { erroDoVideo } from '../../dominio/video';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';

/**
 * Orientações, seções e itens da mobilidade (nome, prescrição em texto e vídeo). Usado pelo editor do plano do aluno e
 * pelo editor do modelo do Planejamento: a edição é a mesma, só muda onde salva.
 */
export function SecoesDeMobilidade({ conteudo: mob, aoMudar }: { conteudo: ConteudoMobilidade; aoMudar: (c: ConteudoMobilidade) => void }) {
  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) =>
    aoMudar({ ...mob, secoes: mob.secoes.map((x, n) => (n === si ? mudanca(x) : x)) });
  const alterarItem = (si: number, ii: number, parcial: Partial<ItemMobilidade>) =>
    alterarSecao(si, (x) => ({ ...x, itens: x.itens.map((y, m) => (m === ii ? { ...y, ...parcial } : y)) }));
  return <>
    <Campo rotulo="Orientações (opcional)" valor={mob.orientacoes} aoMudar={(orientacoes) => aoMudar({ ...mob, orientacoes })} linhas={3} maxLength={2000} />
    {mob.secoes.map((sec, si) => <Cartao key={sec.uid} titulo={sec.titulo || `Seção ${si + 1}`}>
      <Campo rotulo="Título da seção" valor={sec.titulo} maxLength={80} aoMudar={(titulo) => alterarSecao(si, (x) => ({ ...x, titulo }))} />
      {sec.itens.map((it, ii) => <Cartao key={it.uid} titulo={`${ii + 1}. ${it.nome || 'Item sem nome'}`}>
        <Campo rotulo="Nome do exercício" valor={it.nome} maxLength={120} aoMudar={(nomeItem) => alterarItem(si, ii, { nome: nomeItem })} />
        <Campo rotulo="Prescrição (ex.: 2 x 20s cada lado)" valor={it.prescricao} maxLength={120} aoMudar={(prescricao) => alterarItem(si, ii, { prescricao })} />
        <Campo rotulo="Link do vídeo (YouTube)" valor={it.videoUrl} maxLength={500} autoCapitalize="none" erro={erroDoVideo(it.videoUrl)} aoMudar={(videoUrl) => alterarItem(si, ii, { videoUrl })} />
        <Botao rotulo="Subir item" tipo="secundario" desabilitado={ii === 0} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, -1) }))} />
        <Botao rotulo="Descer item" tipo="secundario" desabilitado={ii === sec.itens.length - 1} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, 1) }))} />
        <Botao rotulo="Remover item" tipo="perigoTexto" aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: x.itens.filter((_, m) => m !== ii) }))} />
      </Cartao>)}
      <Botao rotulo="Adicionar item" tipo="secundario" desabilitado={sec.itens.length >= 40} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: [...x.itens, novoItemMobilidade()] }))} />
      <Botao rotulo="Remover seção" tipo="perigoTexto" desabilitado={mob.secoes.length <= 1} aoTocar={() => aoMudar({ ...mob, secoes: mob.secoes.filter((_, n) => n !== si) })} />
    </Cartao>)}
    <Botao rotulo="Adicionar seção" tipo="secundario" desabilitado={mob.secoes.length >= 10} aoTocar={() => aoMudar({ ...mob, secoes: [...mob.secoes, novaSecaoMobilidade()] })} />
  </>;
}

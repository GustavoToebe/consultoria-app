import { useState } from 'react';
import { alterarReceita, consultoria } from '../../api/rotas';
import type { Configuracao, ConteudoPastaModelo, Receita } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { mover, normalizarTreino, seriesDaReceita, seriesParaReceita } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, type ItemMobilidade, type SecaoMobilidade, mobilidadeParaApi, mobilidadeValida, normalizarMobilidade, novaSecaoMobilidade, novoItemMobilidade } from '../../dominio/mobilidade';
import { erroDoVideo } from '../../dominio/video';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaReceitas } from '../FolhaReceitas';
import { CartaoMetodologia } from '../marca/CartaoMetodologia';
import { EditorSeries } from '../treino/EditorSeries';

export function EditorModelo({ receita: r, aoRecarregar }: { receita: Receita; aoRecarregar: () => void }) {
  const [nome, setNome] = useState(r.nome); const [descricao, setDescricao] = useState(r.descricao ?? '');
  const [conteudo, setConteudo] = useState(r.tipo === 'SERIES' ? { series: seriesDaReceita(r.conteudo) } : r.tipo === 'MOBILIDADE' ? normalizarMobilidade(r.conteudo) : r.conteudo);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  const [adicionar, setAdicionar] = useState<'PLANO_TREINO' | 'PLANO_DIETA' | null>(null);
  const { avisar } = useAviso();
  const consultoriaAtual = useCarregar('config-modelo', consultoria);
  const salvar = async (novoConteudo = conteudo) => {
    if (!nome.trim()) throw new Error('Preencha o nome do modelo.');
    setSalvando(true); setErro(null);
    try { await alterarReceita(r.id, { ...r, nome: nome.trim(), descricao: descricao.trim() || null, conteudo: r.tipo === 'SERIES' ? seriesParaReceita((novoConteudo as { series: ReturnType<typeof seriesDaReceita> }).series) : r.tipo === 'MOBILIDADE' ? mobilidadeParaApi(novoConteudo as ConteudoMobilidade) : novoConteudo }); avisar('Modelo salvo.', 'sucesso'); aoRecarregar(); }
    catch (e) { setErro(e); throw e; } finally { setSalvando(false); }
  };
  const pasta = conteudo as ConteudoPastaModelo;
  const mob = r.tipo === 'MOBILIDADE' ? (conteudo as ConteudoMobilidade) : null;
  const alterarMob = (mudanca: (c: ConteudoMobilidade) => ConteudoMobilidade) => setConteudo(mudanca(conteudo as ConteudoMobilidade));
  const alterarSecao = (si: number, mudanca: (x: SecaoMobilidade) => SecaoMobilidade) => alterarMob((c) => ({ ...c, secoes: c.secoes.map((x, n) => (n === si ? mudanca(x) : x)) }));
  const alterarItem = (si: number, ii: number, parcial: Partial<ItemMobilidade>) => alterarSecao(si, (x) => ({ ...x, itens: x.itens.map((y, m) => (m === ii ? { ...y, ...parcial } : y)) }));
  return <Tela bordas={['top']} largura={960}>
    <Cabecalho titulo={r.nome} subtitulo="Modelo reutilizável" voltar="/treinador/planejamento" />
    <Texto variante="suave">Salve as alterações antes de sair. Os planos dos alunos permanecem iguais.</Texto>
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={2} maxLength={400} />
    {r.tipo === 'METODOLOGIA' ? <CartaoMetodologia configuracao={conteudo as Configuracao} aoSalvar={salvar} /> : null}
    {r.tipo === 'SERIES' ? <EditorSeries series={(conteudo as { series: ReturnType<typeof seriesDaReceita> }).series} config={consultoriaAtual.dados?.configuracao ?? null} aoMudar={(series) => setConteudo({ series })} /> : null}
    {mob ? <>
      <Campo rotulo="Orientações (opcional)" valor={mob.orientacoes} aoMudar={(orientacoes) => alterarMob((c) => ({ ...c, orientacoes }))} linhas={3} maxLength={2000} />
      {mob.secoes.map((sec, si) => <Cartao key={sec.uid} titulo={sec.titulo || `Seção ${si + 1}`}>
        <Campo rotulo="Título da seção" valor={sec.titulo} maxLength={80} aoMudar={(titulo) => alterarSecao(si, (x) => ({ ...x, titulo }))} />
        {sec.itens.map((it, ii) => <Cartao key={it.uid} titulo={`${ii + 1}. ${it.nome || 'Item sem nome'}`}>
          <Campo rotulo="Nome do exercício" valor={it.nome} maxLength={120} aoMudar={(nomeItem) => alterarItem(si, ii, { nome: nomeItem })} />
          <Campo rotulo="Prescrição (ex.: 2 x 20s cada lado)" valor={it.prescricao} maxLength={120} aoMudar={(prescricao) => alterarItem(si, ii, { prescricao })} />
          <Campo rotulo="Link do vídeo (YouTube)" valor={it.videoUrl} maxLength={500} autoCapitalize="none" erro={erroDoVideo(it.videoUrl)} aoMudar={(videoUrl) => alterarItem(si, ii, { videoUrl })} />
          <Botao rotulo="Subir item" tipo="secundario" desabilitado={ii === 0} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, -1) }))} />
          <Botao rotulo="Descer item" tipo="secundario" desabilitado={ii === sec.itens.length - 1} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: mover(x.itens, ii, 1) }))} />
          <Botao rotulo="Remover item" tipo="fantasma" aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: x.itens.filter((_, m) => m !== ii) }))} />
        </Cartao>)}
        <Botao rotulo="Adicionar item" tipo="secundario" desabilitado={sec.itens.length >= 40} aoTocar={() => alterarSecao(si, (x) => ({ ...x, itens: [...x.itens, novoItemMobilidade()] }))} />
        <Botao rotulo="Remover seção" tipo="fantasma" desabilitado={mob.secoes.length <= 1} aoTocar={() => alterarMob((c) => ({ ...c, secoes: c.secoes.filter((_, n) => n !== si) }))} />
      </Cartao>)}
      <Botao rotulo="Adicionar seção" tipo="secundario" desabilitado={mob.secoes.length >= 10} aoTocar={() => alterarMob((c) => ({ ...c, secoes: [...c.secoes, novaSecaoMobilidade()] }))} />
    </> : null}
    {r.tipo === 'PASTA_PLANO' ? <>
      <Texto variante="suave">Adicione cópias dos modelos de semana e dieta. Alterar o modelo original depois não modifica esta pasta. Para atualizar um item, remova e adicione a versão desejada.</Texto>
      {pasta.planos.map((p, i) => <Cartao key={i} titulo={`${i + 1}. ${p.treino ? 'Semana de treino' : 'Dieta'}`}>
        <Campo rotulo="Título do plano" valor={p.titulo} maxLength={120} aoMudar={(titulo) => setConteudo({ planos: pasta.planos.map((x, n) => n === i ? { ...x, titulo } : x) })} />
        <Texto variante="pequeno">{p.treino ? p.treino.sessoes.map((s) => s.nome || 'Sessão').join(' · ') : p.dieta?.refeicoes.map((ref) => ref.nome || 'Refeição').join(' · ')}</Texto>
        <Botao rotulo="Subir plano" tipo="secundario" desabilitado={i === 0} aoTocar={() => setConteudo({ planos: mover(pasta.planos, i, -1) })} />
        <Botao rotulo="Descer plano" tipo="secundario" desabilitado={i === pasta.planos.length - 1} aoTocar={() => setConteudo({ planos: mover(pasta.planos, i, 1) })} />
        <Botao rotulo="Remover da pasta" tipo="fantasma" aoTocar={() => setConteudo({ planos: pasta.planos.filter((_, n) => n !== i) })} />
      </Cartao>)}
      <Botao rotulo="Adicionar semana de treino" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_TREINO')} />
      <Botao rotulo="Adicionar dieta" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_DIETA')} />
      {adicionar ? <FolhaReceitas tipo={adicionar} titulo="Adicionar modelo à pasta" aoFechar={() => setAdicionar(null)} aoUsar={(modelo) => {
        setConteudo({ planos: [...pasta.planos, { titulo: modelo.nome, treino: adicionar === 'PLANO_TREINO' ? normalizarTreino(modelo.conteudo) : null, dieta: adicionar === 'PLANO_DIETA' ? normalizarDieta(modelo.conteudo) : null }] }); setAdicionar(null);
      }} /> : null}
    </> : null}
    {erro ? <><MensagemErro texto={textoDoErro(erro)} /><Botao rotulo="Recarregar modelo (descartar alterações)" tipo="secundario" aoTocar={aoRecarregar} /></> : null}
    {r.tipo !== 'METODOLOGIA' ? <Botao rotulo="Salvar modelo" carregando={salvando} desabilitado={!nome.trim() || (r.tipo === 'SERIES' && !(conteudo as { series: unknown[] }).series.length) || (mob !== null && !mobilidadeValida(mob))} aoTocar={() => { void salvar().catch(() => {}); }} /> : null}
  </Tela>;
}

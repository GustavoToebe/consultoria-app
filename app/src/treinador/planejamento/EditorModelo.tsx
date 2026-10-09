import { LARGURA_EDITOR } from '../../tema/tokens';
import { useState } from 'react';
import { alterarReceita, consultoria } from '../../api/rotas';
import type { Configuracao, ConteudoPastaModelo, Receita } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { mover, normalizarTreino, seriesDaReceita, seriesParaReceita } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, mobilidadeParaApi, mobilidadeValida, normalizarMobilidade } from '../../dominio/mobilidade';
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
import { SecoesDeMobilidade } from '../mobilidade/SecoesDeMobilidade';
import { EditorSeries } from '../treino/EditorSeries';

export function EditorModelo({ receita: r, aoRecarregar }: { receita: Receita; aoRecarregar: () => void }) {
  const [nome, setNome] = useState(r.nome); const [descricao, setDescricao] = useState(r.descricao ?? '');
  const [conteudo, setConteudo] = useState(r.tipo === 'SERIES' ? { series: seriesDaReceita(r.conteudo) } : r.tipo === 'MOBILIDADE' ? normalizarMobilidade(r.conteudo) : r.conteudo);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  const [adicionar, setAdicionar] = useState<'PLANO_TREINO' | 'PLANO_DIETA' | 'MOBILIDADE' | null>(null);
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
  return <Tela bordas={['top']} largura={LARGURA_EDITOR}>
    <Cabecalho titulo={r.nome} trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: r.nome }]} subtitulo="Modelo reutilizável" voltar="/treinador/planejamento" />
    <Texto variante="suave">Salve as alterações antes de sair. Os planos dos alunos permanecem iguais.</Texto>
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={2} maxLength={400} />
    {r.tipo === 'METODOLOGIA' ? <CartaoMetodologia configuracao={conteudo as Configuracao} aoSalvar={salvar} /> : null}
    {r.tipo === 'SERIES' ? <EditorSeries series={(conteudo as { series: ReturnType<typeof seriesDaReceita> }).series} config={consultoriaAtual.dados?.configuracao ?? null} aoMudar={(series) => setConteudo({ series })} /> : null}
    {mob ? <SecoesDeMobilidade conteudo={mob} aoMudar={setConteudo} /> : null}
    {r.tipo === 'PASTA_PLANO' ? <>
      <Texto variante="suave">Adicione cópias dos modelos de semana, dieta e mobilidade. Alterar o modelo original depois não modifica este pacote. Para atualizar um item, remova e adicione a versão desejada.</Texto>
      {pasta.planos.map((p, i) => <Cartao key={i} titulo={`${i + 1}. ${p.treino ? 'Semana de treino' : p.mobilidade ? 'Mobilidade' : 'Dieta'}`}>
        <Campo rotulo="Título do plano" valor={p.titulo} maxLength={120} aoMudar={(titulo) => setConteudo({ planos: pasta.planos.map((x, n) => n === i ? { ...x, titulo } : x) })} />
        <Texto variante="pequeno">{p.treino ? p.treino.sessoes.map((s) => s.nome || 'Sessão').join(' · ') : p.mobilidade ? p.mobilidade.secoes.map((sec) => sec.titulo || 'Seção').join(' · ') : p.dieta?.refeicoes.map((ref) => ref.nome || 'Refeição').join(' · ')}</Texto>
        <Botao rotulo="Subir plano" tipo="secundario" desabilitado={i === 0} aoTocar={() => setConteudo({ planos: mover(pasta.planos, i, -1) })} />
        <Botao rotulo="Descer plano" tipo="secundario" desabilitado={i === pasta.planos.length - 1} aoTocar={() => setConteudo({ planos: mover(pasta.planos, i, 1) })} />
        <Botao rotulo="Remover do pacote" tipo="perigoTexto" aoTocar={() => setConteudo({ planos: pasta.planos.filter((_, n) => n !== i) })} />
      </Cartao>)}
      <Botao rotulo="Adicionar semana de treino" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_TREINO')} />
      <Botao rotulo="Adicionar dieta" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_DIETA')} />
      <Botao rotulo="Adicionar mobilidade" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('MOBILIDADE')} />
      {adicionar ? <FolhaReceitas tipo={adicionar} titulo="Adicionar modelo ao pacote" aoFechar={() => setAdicionar(null)} aoUsar={(modelo) => {
        setConteudo({ planos: [...pasta.planos, { titulo: modelo.nome, treino: adicionar === 'PLANO_TREINO' ? normalizarTreino(modelo.conteudo) : null, dieta: adicionar === 'PLANO_DIETA' ? normalizarDieta(modelo.conteudo) : null, mobilidade: adicionar === 'MOBILIDADE' ? mobilidadeParaApi(normalizarMobilidade(modelo.conteudo)) : null }] }); setAdicionar(null);
      }} /> : null}
    </> : null}
    {erro ? <><MensagemErro texto={textoDoErro(erro)} /><Botao rotulo="Recarregar modelo (descartar alterações)" tipo="secundario" aoTocar={aoRecarregar} /></> : null}
    {r.tipo !== 'METODOLOGIA' ? <Botao rotulo="Salvar modelo" carregando={salvando} desabilitado={!nome.trim() || (r.tipo === 'SERIES' && !(conteudo as { series: unknown[] }).series.length) || (mob !== null && !mobilidadeValida(mob))} aoTocar={() => { void salvar().catch(() => {}); }} /> : null}
  </Tela>;
}

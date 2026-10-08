import { useCallback, useRef, useState } from 'react';
import { alterarReceita, consultoria } from '../../api/rotas';
import type { Configuracao, ConteudoPastaModelo, Receita } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { mover, normalizarTreino, seriesDaReceita, seriesParaReceita } from '../../dominio/editorTreino';
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
import { useAutosalvar } from '../plano/useAutosalvar';
import { EditorSeries } from '../treino/EditorSeries';

export function EditorModelo({ receita: r, aoRecarregar }: { receita: Receita; aoRecarregar: () => void }) {
  const [nome, setNome] = useState(r.nome); const [descricao, setDescricao] = useState(r.descricao ?? '');
  const [conteudo, setConteudo] = useState(r.tipo === 'SERIES' ? { series: seriesDaReceita(r.conteudo) } : r.conteudo);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  const [adicionar, setAdicionar] = useState<'PLANO_TREINO' | 'PLANO_DIETA' | null>(null);
  const { avisar } = useAviso();
  const consultoriaAtual = useCarregar('config-modelo', consultoria);
  const seriesAtuais = r.tipo === 'SERIES' ? (conteudo as { series: ReturnType<typeof seriesDaReceita> }).series : null;
  // O modelo tem controle de versão: cada gravação devolve a nova versão, e as gravações saem uma de cada vez.
  const versao = useRef(r.versao);
  const gravado = useRef<{ nome: string; descricao: string | null; conteudo: unknown }>({ nome: r.nome, descricao: r.descricao ?? null, conteudo: r.conteudo });
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const gravar = useCallback((parcial: { nome?: string; descricao?: string | null; conteudo?: unknown }) => {
    const proxima = fila.current.then(async () => {
      const dados = { ...gravado.current, ...parcial };
      const resposta = await alterarReceita(r.id, { ...r, nome: dados.nome, descricao: dados.descricao, conteudo: dados.conteudo, versao: versao.current });
      versao.current = resposta.versao;
      gravado.current = dados;
    });
    fila.current = proxima.catch(() => undefined);
    return proxima;
  }, [r]);
  const conteudoParaGravar = (c = conteudo) => (r.tipo === 'SERIES' ? seriesParaReceita((c as { series: ReturnType<typeof seriesDaReceita> }).series) : c);
  const valido = !!nome.trim() && (seriesAtuais === null || seriesAtuais.length > 0);
  // Metodologia grava o conteúdo pelo próprio cartão; aqui só nome e descrição.
  const auto = useAutosalvar(
    { nome: nome.trim(), descricao: descricao.trim() || null, conteudo: r.tipo === 'METODOLOGIA' ? null : conteudoParaGravar() },
    valido,
    ({ conteudo: c, ...resto }) => gravar(c === null ? resto : { ...resto, conteudo: c }),
  );
  const salvar = async () => {
    setSalvando(true); setErro(null);
    try { await gravar({ nome: nome.trim(), descricao: descricao.trim() || null, conteudo: r.tipo === 'METODOLOGIA' ? undefined : conteudoParaGravar() }); avisar('Modelo salvo.', 'sucesso'); aoRecarregar(); }
    catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  const pasta = conteudo as ConteudoPastaModelo;
  return <Tela bordas={['top']} largura={960}>
    <Cabecalho titulo={r.nome} subtitulo="Modelo reutilizável" voltar="/treinador/planejamento" />
    <Texto variante="suave">As alterações são salvas sozinhas. Os planos dos alunos permanecem iguais.</Texto>
    {auto.salvando ? <Texto variante="pequeno">Salvando…</Texto> : null}
    {auto.erro ? <MensagemErro texto={textoDoErro(auto.erro)} tentarDeNovo={() => { void auto.salvarAgora(); }} /> : null}
    <Campo rotulo="Nome do modelo" valor={nome} aoMudar={setNome} maxLength={120} />
    <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} linhas={2} maxLength={400} />
    {r.tipo === 'METODOLOGIA' ? <CartaoMetodologia configuracao={conteudo as Configuracao} aoSalvar={(c) => gravar({ conteudo: c })} autosalvar /> : null}
    {r.tipo === 'SERIES' ? <EditorSeries series={(conteudo as { series: ReturnType<typeof seriesDaReceita> }).series} config={consultoriaAtual.dados?.configuracao ?? null} aoMudar={(series) => setConteudo({ series })} /> : null}
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
    {r.tipo !== 'METODOLOGIA' ? <Botao rotulo="Salvar modelo" carregando={salvando} desabilitado={!nome.trim() || (r.tipo === 'SERIES' && !(conteudo as { series: unknown[] }).series.length)} aoTocar={() => { void salvar(); }} /> : null}
  </Tela>;
}

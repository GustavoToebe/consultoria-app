import { useTema } from '../../tema/TemaProvider';
import { LARGURA_EDITOR } from '../../tema/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { alterarReceita } from '../../api/rotas';
import type { Configuracao, ConteudoPastaModelo, Receita } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { tituloDoModelo } from '../../dominio/planoDoAluno';
import { mover, normalizarTreino, seriesDaReceita, seriesParaReceita } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, mobilidadeParaApi, mobilidadeValida, normalizarMobilidade } from '../../dominio/mobilidade';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { textoDoSalvo } from '../../dominio/estadoDoRascunho';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { FolhaReceitas } from '../FolhaReceitas';
import { CartaoMetodologia } from '../marca/CartaoMetodologia';
import { FaixaDoModelo } from '../plano/FaixaDoPlano';
import { SecoesDeMobilidade } from '../mobilidade/SecoesDeMobilidade';
import { EditorSeries } from '../treino/EditorSeries';

export function EditorModelo({ receita: r, aoRecarregar, salvoAs, aoSalvar }: { receita: Receita; aoRecarregar: () => void; salvoAs: Date | null; aoSalvar: (quando: Date) => void }) {
  const [nome, setNome] = useState(r.nome); const [descricao, setDescricao] = useState(r.descricao ?? '');
  const [conteudo, setConteudo] = useState(r.tipo === 'SERIES' ? { series: seriesDaReceita(r.conteudo) } : r.tipo === 'MOBILIDADE' ? normalizarMobilidade(r.conteudo) : r.conteudo);
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<unknown>(null);
  // Nada é salvo sozinho: qualquer mudança fica pendente até "Salvar modelo" e sair da tela pergunta antes.
  const [pendente, setPendente] = useState(false);
  useGuardaDeSaida(pendente);
  const mudarConteudo: typeof setConteudo = (c) => { setConteudo(c); setPendente(true); };
  const [adicionar, setAdicionar] = useState<'PLANO_TREINO' | 'PLANO_DIETA' | 'MOBILIDADE' | null>(null);
  const { avisar } = useAviso();
  const salvar = async (novoConteudo = conteudo) => {
    if (!nome.trim()) throw new Error('Preencha o nome do modelo.');
    setSalvando(true); setErro(null);
    try { await alterarReceita(r.id, { ...r, nome: nome.trim(), descricao: descricao.trim() || null, conteudo: r.tipo === 'SERIES' ? seriesParaReceita((novoConteudo as { series: ReturnType<typeof seriesDaReceita> }).series) : r.tipo === 'MOBILIDADE' ? mobilidadeParaApi(novoConteudo as ConteudoMobilidade) : novoConteudo }); setPendente(false); aoSalvar(new Date()); avisar('Modelo salvo.', 'sucesso'); aoRecarregar(); }
    catch (e) { setErro(e); throw e; } finally { setSalvando(false); }
  };
  const pasta = conteudo as ConteudoPastaModelo;
  const mob = r.tipo === 'MOBILIDADE' ? (conteudo as ConteudoMobilidade) : null;
  return <Tela bordas={['top']} largura={LARGURA_EDITOR}>
    <Cabecalho titulo={tituloDoModelo(r.tipo)} trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: tituloDoModelo(r.tipo) }]} subtitulo={r.nome} voltar="/treinador/planejamento" />
    <FaixaDoModelo />
    <Cartao titulo="Modelo reutilizável" descricao="Salve as alterações antes de sair. Os planos dos alunos permanecem iguais.">
      <Campo rotulo="Nome do modelo" valor={nome} aoMudar={(v) => { setNome(v); setPendente(true); }} maxLength={120} />
      <Campo rotulo="Descrição" valor={descricao} aoMudar={(v) => { setDescricao(v); setPendente(true); }} linhas={2} maxLength={400} />
      <Selo texto={salvando ? 'Salvando…' : pendente ? 'Alterações não salvas' : textoDoSalvo(salvoAs)} tipo={salvando ? 'neutro' : pendente ? 'atencao' : 'sucesso'} />
    </Cartao>
    {r.tipo === 'METODOLOGIA' ? <CartaoMetodologia configuracao={conteudo as Configuracao} aoSalvar={salvar} /> : null}
    {r.tipo === 'SERIES' ? <EditorSeries series={(conteudo as { series: ReturnType<typeof seriesDaReceita> }).series} config={CONFIGURACAO_PADRAO} aoMudar={(series) => mudarConteudo({ series })} /> : null}
    {mob ? <SecoesDeMobilidade conteudo={mob} aoMudar={mudarConteudo} /> : null}
    {r.tipo === 'PASTA_PLANO' ? <Cartao titulo="Planos do pacote" descricao="Adicione cópias dos modelos de semana, dieta e mobilidade. Alterar o modelo original depois não modifica este pacote. Para atualizar um item, remova e adicione a versão desejada.">
      {pasta.planos.map((p, i) => <ItemDoPacote key={i} posicao={i} total={pasta.planos.length} plano={p}
        aoTitulo={(titulo) => mudarConteudo({ planos: pasta.planos.map((x, n) => n === i ? { ...x, titulo } : x) })}
        aoMover={(d) => mudarConteudo({ planos: mover(pasta.planos, i, d) })}
        aoRemover={() => mudarConteudo({ planos: pasta.planos.filter((_, n) => n !== i) })} />)}
      <View style={estilos.acoes}>
        <Botao rotulo="Adicionar semana de treino" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_TREINO')} />
        <Botao rotulo="Adicionar dieta" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('PLANO_DIETA')} />
        <Botao rotulo="Adicionar mobilidade" tipo="secundario" desabilitado={pasta.planos.length >= 30} aoTocar={() => setAdicionar('MOBILIDADE')} />
      </View>
      {adicionar ? <FolhaReceitas tipo={adicionar} titulo="Adicionar modelo ao pacote" aoFechar={() => setAdicionar(null)} aoUsar={(modelo) => {
        mudarConteudo({ planos: [...pasta.planos, { titulo: modelo.nome, treino: adicionar === 'PLANO_TREINO' ? normalizarTreino(modelo.conteudo) : null, dieta: adicionar === 'PLANO_DIETA' ? normalizarDieta(modelo.conteudo) : null, mobilidade: adicionar === 'MOBILIDADE' ? mobilidadeParaApi(normalizarMobilidade(modelo.conteudo)) : null }] }); setAdicionar(null);
      }} /> : null}
    </Cartao> : null}
    {erro ? <><MensagemErro texto={textoDoErro(erro)} /><Botao rotulo="Recarregar modelo (descartar alterações)" tipo="secundario" aoTocar={aoRecarregar} /></> : null}
    {r.tipo !== 'METODOLOGIA' ? <Botao rotulo="Salvar modelo" carregando={salvando} desabilitado={!nome.trim() || (r.tipo === 'SERIES' && !(conteudo as { series: unknown[] }).series.length) || (mob !== null && !mobilidadeValida(mob))} aoTocar={() => { void salvar().catch(() => {}); }} /> : null}
  </Tela>;
}

type PlanoDoPacote = ConteudoPastaModelo['planos'][number];

/** Um plano do pacote: título editável, resumo do conteúdo, ordem e remoção (com confirmação). */
function ItemDoPacote({ posicao, total, plano: p, aoTitulo, aoMover, aoRemover }: {
  posicao: number; total: number; plano: PlanoDoPacote; aoTitulo: (t: string) => void; aoMover: (d: -1 | 1) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const [removendo, setRemovendo] = useState(false);
  const tipo = p.treino ? 'Semana de treino' : p.mobilidade ? 'Mobilidade' : 'Dieta';
  return <Cartao titulo={`${posicao + 1}. ${tipo}`} style={{ backgroundColor: cores.superficie2 }}>
    <Campo rotulo="Título do plano" valor={p.titulo} maxLength={120} aoMudar={aoTitulo} />
    <Texto variante="suave">{p.treino ? p.treino.sessoes.map((x) => x.nome || 'Sessão').join(' · ') : p.mobilidade ? p.mobilidade.secoes.map((sec) => sec.titulo || 'Seção').join(' · ') : p.dieta?.refeicoes.map((ref) => ref.nome || 'Refeição').join(' · ')}</Texto>
    <View style={estilos.acoes}>
      <Botao rotulo="Subir plano" tipo="secundario" desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
      <Botao rotulo="Descer plano" tipo="secundario" desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
      <Botao rotulo="Remover do pacote" tipo="perigoTexto" aoTocar={() => setRemovendo(true)} />
    </View>
    <PainelConfirmacao visivel={removendo} titulo={`Remover “${p.titulo || tipo}” do pacote?`} mensagem="O plano sai do pacote. Nada é salvo até você tocar em Salvar modelo."
      rotuloConfirmar="Remover do pacote" perigo aoCancelar={() => setRemovendo(false)} aoConfirmar={() => { setRemovendo(false); aoRemover(); }} />
  </Cartao>;
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

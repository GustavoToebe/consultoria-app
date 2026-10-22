import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Plus, Trash2 } from 'lucide-react-native';
import { IconeBotao } from '../../ui/IconeBotao';
import type { SituacaoDoEditor } from '../../dominio/barraDoEditor';
import { CabecalhoDoItem } from '../plano/CabecalhoDoItem';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { BarraDoModelo } from '../plano/TopoModelo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { alterarReceita, listarReceitas } from '../../api/rotas';
import type { Configuracao, ConteudoPastaModelo, Receita } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { LIMITE_DESCRICAO_DO_MODELO } from '../../dominio/modelos';
import { tituloDoModelo } from '../../dominio/planoDoAluno';
import { mover, normalizarTreino, seriesDaReceita, seriesParaReceita } from '../../dominio/editorTreino';
import { type ConteudoMobilidade, mobilidadeParaApi, mobilidadeValida, normalizarMobilidade } from '../../dominio/mobilidade';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { NoPlano } from '../../ui/NoPlano';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaReceitas } from '../FolhaReceitas';
import { CartaoMetodologia, metodologiaParaSalvar, problemaDaMetodologia, type MetodologiaEmEdicao } from '../marca/CartaoMetodologia';
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
  // Modelo de séries usa a metodologia da consultoria (a primeira, como o servidor faz nos planos), não a do sistema:
  // a regra de % do FS e as faixas de repetição são as do treinador. Sem nenhuma, vale a padrão.
  const metodologias = useCarregar(r.tipo === 'SERIES' ? 'metodologias' : null, () => listarReceitas('METODOLOGIA'));
  const configDaConsultoria = (metodologias.dados?.[0]?.conteudo as Configuracao | undefined) ?? CONFIGURACAO_PADRAO;
  const pasta = conteudo as ConteudoPastaModelo;
  const mob = r.tipo === 'MOBILIDADE' ? (conteudo as ConteudoMobilidade) : null;
  const metodologia = r.tipo === 'METODOLOGIA' ? (conteudo as MetodologiaEmEdicao) : null;
  // Um só motivo para o "Salvar modelo" desabilitado, o mesmo em todo tipo.
  const motivo = !nome.trim() ? 'Informe o nome do modelo.'
    : r.tipo === 'SERIES' && !(conteudo as { series: unknown[] }).series.length ? 'Adicione ao menos uma série.'
      : mob && !mobilidadeValida(mob) ? 'Toda seção precisa de item, todo item de nome e o vídeo precisa ser do YouTube.'
        : metodologia ? problemaDaMetodologia(metodologia) : null;
  const paraApi = (c: unknown) => r.tipo === 'SERIES' ? seriesParaReceita((c as { series: ReturnType<typeof seriesDaReceita> }).series)
    : r.tipo === 'MOBILIDADE' ? mobilidadeParaApi(c as ConteudoMobilidade)
      : r.tipo === 'METODOLOGIA' ? metodologiaParaSalvar(c as MetodologiaEmEdicao) : c;
  const salvar = async () => {
    setSalvando(true); setErro(null);
    try { await alterarReceita(r.id, { ...r, nome: nome.trim(), descricao: descricao.trim() || null, conteudo: paraApi(conteudo) }); setPendente(false); aoSalvar(new Date()); avisar('Modelo salvo.', 'sucesso'); aoRecarregar(); }
    catch (e) { setErro(e); } finally { setSalvando(false); }
  };
  const situacao: SituacaoDoEditor = salvando ? 'salvando' : erro ? 'erro' : pendente ? 'pendente' : 'salvo';
  return <TelaDoEditor
    cabecalho={<Cabecalho titulo={tituloDoModelo(r.tipo)} trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: tituloDoModelo(r.tipo) }]} voltar="/treinador/planejamento" />}
    barra={<BarraDoModelo situacao={situacao} salvoAs={salvoAs} mensagemDeErro={erro ? textoDoErro(erro) : null} salvando={salvando}
      desabilitado={motivo !== null} motivo={motivo ?? undefined} aoSalvar={() => void salvar()} aoRecarregar={aoRecarregar} receita={r} />}>
    <FaixaDoModelo />
    <Cartao>
      <Campo rotulo="Nome do modelo" valor={nome} aoMudar={(v) => { setNome(v); setPendente(true); }} maxLength={120} erro={nome.trim() ? null : 'Informe o nome do modelo.'} />
      <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={(v) => { setDescricao(v); setPendente(true); }} linhas={2} maxLength={LIMITE_DESCRICAO_DO_MODELO} />
    </Cartao>
    {erro ? <Botao rotulo="Recarregar modelo (descartar alterações)" tipo="secundario" aoTocar={aoRecarregar} /> : null}
    {metodologia ? <CartaoMetodologia configuracao={metodologia} aoMudar={mudarConteudo} /> : null}
    {r.tipo === 'SERIES' ? <Cartao titulo="Séries"><EditorSeries series={(conteudo as { series: ReturnType<typeof seriesDaReceita> }).series} config={configDaConsultoria} modalidade={null} aoMudar={(series) => mudarConteudo({ series })} /></Cartao> : null}
    {mob ? <SecoesDeMobilidade conteudo={mob} aoMudar={mudarConteudo} /> : null}
    {r.tipo === 'PASTA_PLANO' ? <Cartao titulo="Planos do pacote" descricao="Cópias dos modelos de semana, dieta e mobilidade. Mudar o modelo original depois não muda o pacote: para atualizar um item, remova e adicione de novo.">
      {pasta.planos.length === 0 ? <Texto variante="suave">Pacote vazio. Adicione uma semana de treino, uma dieta ou uma mobilidade.</Texto> : null}
      {pasta.planos.map((p, i) => <ItemDoPacote key={i} posicao={i} total={pasta.planos.length} plano={p}
        aoTitulo={(titulo) => mudarConteudo({ planos: pasta.planos.map((x, n) => n === i ? { ...x, titulo } : x) })}
        aoMover={(d) => mudarConteudo({ planos: mover(pasta.planos, i, d) })}
        aoRemover={() => mudarConteudo({ planos: pasta.planos.filter((_, n) => n !== i) })} />)}
      <View style={estilos.acoes}>
        <Botao rotulo="Adicionar semana de treino" tipo="secundario" Icone={Plus} desabilitado={pasta.planos.length >= 30} motivo="No máximo 30 planos." aoTocar={() => setAdicionar('PLANO_TREINO')} />
        <Botao rotulo="Adicionar dieta" tipo="secundario" Icone={Plus} desabilitado={pasta.planos.length >= 30} motivo="No máximo 30 planos." aoTocar={() => setAdicionar('PLANO_DIETA')} />
        <NoPlano funcionalidade="MOBILIDADE"><Botao rotulo="Adicionar mobilidade" tipo="secundario" Icone={Plus} desabilitado={pasta.planos.length >= 30} motivo="No máximo 30 planos." aoTocar={() => setAdicionar('MOBILIDADE')} /></NoPlano>
      </View>
      {adicionar ? <FolhaReceitas tipo={adicionar} titulo="Adicionar ao pacote" aoFechar={() => setAdicionar(null)} aoUsar={(modelo) => {
        mudarConteudo({ planos: [...pasta.planos, { titulo: modelo.nome, treino: adicionar === 'PLANO_TREINO' ? normalizarTreino(modelo.conteudo) : null, dieta: adicionar === 'PLANO_DIETA' ? normalizarDieta(modelo.conteudo) : null, mobilidade: adicionar === 'MOBILIDADE' ? mobilidadeParaApi(normalizarMobilidade(modelo.conteudo)) : null }] }); setAdicionar(null);
      }} /> : null}
    </Cartao> : null}
  </TelaDoEditor>;
}

type PlanoDoPacote = ConteudoPastaModelo['planos'][number];

/** Um plano do pacote: linha de resumo (setas movem, chevron abre o título, lixeira remove com confirmação). */
function ItemDoPacote({ posicao, total, plano: p, aoTitulo, aoMover, aoRemover }: {
  posicao: number; total: number; plano: PlanoDoPacote; aoTitulo: (t: string) => void; aoMover: (d: -1 | 1) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const tipo = p.treino ? 'Semana de treino' : p.mobilidade ? 'Mobilidade' : 'Dieta';
  const partes = p.treino ? p.treino.sessoes.map((x) => x.nome || 'Sessão') : p.mobilidade ? p.mobilidade.secoes.map((sec) => sec.titulo || 'Seção') : p.dieta?.refeicoes.map((ref) => ref.nome || 'Refeição') ?? [];
  return <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
    <CabecalhoDoItem titulo={`${posicao + 1}. ${p.titulo || tipo}`} resumo={`${tipo} · ${partes.join(' · ') || 'vazio'}`} aberto={aberto} aoAlternar={() => setAberto((v) => !v)}
      nomeDoItem="plano" posicao={posicao} total={total} aoMover={aoMover}
      remover={<IconeBotao Icone={Trash2} rotulo={`Remover ${p.titulo || tipo} do pacote`} aoTocar={() => setRemovendo(true)} />} />
    {aberto ? <Campo rotulo="Título do plano" valor={p.titulo} maxLength={120} aoMudar={aoTitulo} /> : null}
    <PainelConfirmacao visivel={removendo} titulo={`Remover “${p.titulo || tipo}” do pacote?`} mensagem="O plano sai do pacote. Nada é salvo até você tocar em Salvar modelo."
      rotuloConfirmar="Remover do pacote" perigo aoCancelar={() => setRemovendo(false)} aoConfirmar={() => { setRemovendo(false); aoRemover(); }} />
  </View>;
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), gap: espaco(1), paddingBottom: espaco(1) },
});

import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import { podeAplicarModelo, podeSalvarPastaComoModelo, temAcaoNoMenuDaPasta } from '../dominio/modelos';
import { Permitido } from '../ui/Permitido';
import { useSessao } from '../sessao/SessaoProvider';
import { BookmarkPlus, CheckCircle2, ChevronRight, Copy, Ellipsis, Folder, FolderCheck, FolderPlus, Package, Pencil, RotateCcw, Trash2 } from 'lucide-react-native';
import { sobre } from '../ui/sobre';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { atualizacaoDoAluno, atualizacoesDoAluno, excluirPasta, finalizarPasta, reabrirPasta, salvarPastaComoModelo, atualizarPasta, criarPasta, escolherQuestionarioDaPasta, listarPastas, replicarPasta } from '../api/rotas';
import { SeletorDeQuestionario } from './questionarios/SeletorDeQuestionario';
import type { Atualizacao, PastaResumo, Receita } from '../api/tipos';
import { atualizacaoDaPasta, caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { dataDaTela, dataParaTela, hojeIso } from '../dominio/formatos';
import { dadosDaRenovacao, periodoInicial, proximoPeriodo } from '../dominio/periodo';
import { FILTROS_PASTAS, filtrarPastas, type FiltroPastas } from '../dominio/pastas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { AplicarAoAluno } from './planejamento/AplicarAoAluno';
import { FolhaReceitas } from './FolhaReceitas';
import { FolhaSalvarReceita } from './FolhaSalvarReceita';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { AtualizacaoDaPasta } from './AtualizacaoDaPasta';
import { CartaoRegistros } from './CartaoRegistros';
import { CartaoPlanos, periodo } from './CartaoPlanos';

type Modo = { tipo: 'nova' } | { tipo: 'editar'; pasta: PastaResumo } | { tipo: 'replicar'; pasta: PastaResumo };

interface PropsPastas {
  pastaInicialId?: string;
  alunoId: string;
  /** Nome do aluno (título do PDF de cargas da pasta). */
  alunoNome?: string;
  /** Dias do ciclo do aluno: sugere o fim do período numa pasta nova. */
  diasAtualizacao?: number | null;
  /** Chamado depois de gravar um peso (ao finalizar a pasta) para o cartão de peso recarregar. */
  aoGravarPeso?: () => void;
}

/**
 * Pastas do aluno (ex.: "Plano 16"): cada uma agrupa treinos e dietas e tem o período que vale para todos. Mudar o
 * período da pasta acompanha os rascunhos dos planos dela; replicar a pasta copia todos para o próximo ciclo.
 */
export function CartaoPastas({ alunoId, alunoNome = '', diasAtualizacao = null, aoGravarPeso, pastaInicialId }: PropsPastas) {
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar(`pastas:${alunoId}`, () => listarPastas(alunoId));
  const [modo, setModo] = useState<Modo | null>(null);
  const [filtro, setFiltro] = useState<FiltroPastas>('todas');
  const { avisar } = useAviso();
  const [excluir, setExcluir] = useState<PastaResumo | null>(null);
  const [salvarModelo, setSalvarModelo] = useState<PastaResumo | null>(null);
  const [finalizar, setFinalizar] = useState<PastaResumo | null>(null);
  const [renovar, setRenovar] = useState<PastaResumo | null>(null);
  const [renovando, setRenovando] = useState(false);
  // Pasta aberta na folha com as ações e os planos; guarda só o id para refletir o que a lista recarrega.
  const [abertaId, setAbertaId] = useState<string | null>(pastaInicialId??null);
  // "Mais ações" da pasta (salvar como pacote, excluir): menu à parte, para a folha ter uma ação principal só.
  const [menuPasta, setMenuPasta] = useState<PastaResumo | null>(null);
  const visiveis = filtrarPastas(dados ?? [], filtro);
  const aberta = dados?.find((p) => p.id === abertaId) ?? null;
  const [escolher, setEscolher] = useState(false);
  const [modelo, setModelo] = useState<Receita | null>(null);
  const [geracao, setGeracao] = useState(0);
  // A atualização fecha o período da pasta: vem junto na lista e na folha (dado sensível, só com ATUALIZACAO_LER).
  const verAtualizacoes = pode('ATUALIZACAO_LER');
  const { dados: atualizacoes, recarregar: recarregarAtualizacoes } = useCarregar(verAtualizacoes ? `atualizacoes-pastas:${alunoId}` : null, async () => {
    const [atual, historico] = await Promise.all([atualizacaoDoAluno(alunoId), atualizacoesDoAluno(alunoId)]);
    return { atual, historico };
  });
  useFocusEffect(useCallback(() => { recarregarAtualizacoes(); }, [recarregarAtualizacoes]));
  const daPasta = (id: string) => atualizacoes ? atualizacaoDaPasta(id, atualizacoes.atual, atualizacoes.historico) : null;

  const aoSalvar = () => {
    setModo(null);
    setGeracao((g) => g + 1);
    recarregar();
    recarregarAtualizacoes();
  };

  return (
    <>
      <Cartao
        titulo="Pastas de plano"
        descricao="Cada pasta junta o treino, a dieta e a mobilidade de um período. O período da pasta vale para todos."
        recolhivel
        acoes={<>
          {podeAplicarModelo('PASTA_PLANO', pode) ? <Botao rotulo="Usar pacote" tipo="secundario" Icone={Package} aoTocar={() => setEscolher(true)} /> : null}
          <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Nova pasta" Icone={FolderPlus} aoTocar={() => setModo({ tipo: 'nova' })} /></Permitido>
        </>}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {!dados && carregando ? <Esqueleto /> : null}
        {dados && dados.length === 0 ? (
          <Vazio titulo="Sem pastas" texto="As pastas reúnem o treino, a dieta e a mobilidade do período." />
        ) : null}
        {dados && dados.length > 0 ? <Escolha descricao="Situação da pasta" opcoes={FILTROS_PASTAS} valor={filtro} aoMudar={setFiltro} /> : null}
        {dados && dados.length > 0 && visiveis.length === 0 ? (
          <Vazio titulo="Nenhuma pasta nesta situação" texto={filtro === 'ativas' ? 'Todas as pastas estão concluídas.' : 'Nenhuma pasta foi concluída ainda.'} />
        ) : null}
        {visiveis.map((p) => (
          <LinhaPasta key={p.id} pasta={p} atualizacao={daPasta(p.id)} aoAbrir={() => setAbertaId(p.id)} />
        ))}
      </Cartao>
      {aberta ? (
        <Folha visivel titulo={aberta.titulo} largura={LARGURA_EDITOR} aoFechar={() => setAbertaId(null)}
          acaoNoTopo={temAcaoNoMenuDaPasta(pode) ? <IconeBotao Icone={Ellipsis} rotulo={`Mais ações da pasta ${aberta.titulo}`} aoTocar={() => { setAbertaId(null); setMenuPasta(aberta); }} /> : undefined}>
          <View style={estilos.resumo}>
            {aberta.concluidaEm ? (
              <Selo texto={`Concluída em ${dataParaTela(hojeIso(new Date(aberta.concluidaEm)))}`} tipo="neutro" />
            ) : (
              <Selo texto="Ativa" tipo="sucesso" />
            )}
            <Texto numerico variante="suave">Período: {periodo(aberta)}</Texto>
          </View>
          {/* Uma ação principal só na folha (finalizar ou reabrir); o resto é secundário ou vai para o menu ⋯. */}
          <LinhaDeAcoes>
            {aberta.concluidaEm ? (
              <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Reabrir pasta" Icone={RotateCcw} aoTocar={() => {
                reabrirPasta(aberta.id).then(() => { avisar('Pasta reaberta.', 'sucesso'); recarregar(); }, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
              }} /></Permitido>
            ) : (
              <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Finalizar pasta" Icone={CheckCircle2} aoTocar={() => { setAbertaId(null); setFinalizar(aberta); }} /></Permitido>
            )}
            <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => { setAbertaId(null); setModo({ tipo: 'editar', pasta: aberta }); }} /></Permitido>
            <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Replicar pasta" tipo="secundario" Icone={Copy} aoTocar={() => { setAbertaId(null); setModo({ tipo: 'replicar', pasta: aberta }); }} /></Permitido>
          </LinhaDeAcoes>
          {/* Só vale para este período; a atualização ainda aberta passa a usar o questionário escolhido na hora. */}
          <SeletorDeQuestionario rotulo="Questionário deste período" valor={aberta.questionarioId} rotuloDoNulo="O do aluno" podeAlterar={pode('PASTA_ALTERAR')}
            aoEscolher={async (questionarioId) => { await escolherQuestionarioDaPasta(aberta.id, questionarioId); recarregar(); recarregarAtualizacoes(); }} />
          {/* A atualização fecha o período e é o ponto central do acompanhamento: fica logo abaixo das ações. */}
          {verAtualizacoes ? <AtualizacaoDaPasta atualizacao={daPasta(aberta.id)} carregando={!atualizacoes}
            aoAbrir={(a) => { setAbertaId(null); router.push(caminhoAtualizacaoTreinador(a)); }} /> : null}
          <Texto variante="secao">Planos desta pasta</Texto>
          <Permitido codigo={PERMISSOES_DO_PLANO.treino.ler}><CartaoPlanos tipo="treino" alunoId={alunoId} pasta={aberta} geracao={geracao} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo={PERMISSOES_DO_PLANO.dieta.ler}><CartaoPlanos tipo="dieta" alunoId={alunoId} pasta={aberta} geracao={geracao} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo={PERMISSOES_DO_PLANO.mobilidade.ler}><CartaoPlanos tipo="mobilidade" alunoId={alunoId} pasta={aberta} geracao={geracao} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo="REGISTRO_LER"><CartaoRegistros aluno={{ id: alunoId, nome: alunoNome }} pasta={aberta} /></Permitido>
        </Folha>
      ) : null}
      {menuPasta ? <Folha visivel titulo={menuPasta.titulo} aoFechar={() => setMenuPasta(null)}>
        {podeSalvarPastaComoModelo(pode) ? <Botao rotulo="Salvar como pacote" tipo="secundario" Icone={BookmarkPlus} aoTocar={() => { const p = menuPasta; setMenuPasta(null); setSalvarModelo(p); }} /> : null}
        <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Renovar pasta" tipo="secundario" Icone={Copy} aoTocar={() => { const p = menuPasta; setMenuPasta(null); setRenovar(p); }} /></Permitido>
        <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Excluir pasta" tipo="perigoTexto" Icone={Trash2} aoTocar={() => { const p = menuPasta; setMenuPasta(null); setExcluir(p); }} /></Permitido>
      </Folha> : null}
      {escolher ? <FolhaReceitas tipo="PASTA_PLANO" titulo="Pacote (treino, dieta e mobilidade)" aoFechar={() => setEscolher(false)} aoUsar={(r) => { setEscolher(false); setModelo(r); }} /> : null}
      {modelo ? <AplicarAoAluno modelo={modelo} alunoInicial={alunoId} aoFechar={() => setModelo(null)} aoAplicar={() => { setModelo(null); aoSalvar(); avisar('Pasta copiada como rascunho.', 'sucesso'); }} /> : null}
      {salvarModelo ? <FolhaSalvarReceita titulo="Salvar pasta como pacote" explicacao="Copia os rascunhos de treino e dieta desta pasta para reutilizar em outros alunos." aoFechar={() => setSalvarModelo(null)} aoSalvar={async (nome, descricao) => {
        await salvarPastaComoModelo(salvarModelo.id, nome, descricao); setSalvarModelo(null); avisar('Pacote salvo.', 'sucesso');
      }} /> : null}
      <PainelConfirmacao visivel={!!renovar} titulo={`Renovar a pasta “${renovar?.titulo ?? ''}”?`}
        mensagem={renovar ? `Cria a pasta “${dadosDaRenovacao(renovar, hojeIso(), diasAtualizacao).titulo}” para ${dadosDaRenovacao(renovar, hojeIso(), diasAtualizacao).texto}, com cópia em rascunho dos treinos, dietas e mobilidades. A pasta atual continua como está; para mudar o título ou o período, use Replicar pasta.` : ''}
        rotuloConfirmar="Renovar pasta" carregando={renovando} aoCancelar={() => setRenovar(null)} aoConfirmar={() => {
          if (!renovar) return;
          const { titulo, inicio, fim } = dadosDaRenovacao(renovar, hojeIso(), diasAtualizacao);
          setRenovando(true);
          replicarPasta(renovar.id, { titulo, inicio, fim }).then(
            () => { setRenovando(false); setRenovar(null); avisar('Pasta renovada. Os planos vieram como rascunho.', 'sucesso'); aoSalvar(); },
            (e: unknown) => { setRenovando(false); setRenovar(null); avisar(textoDoErro(e), 'perigo'); },
          );
        }} />
      <PainelConfirmacao visivel={!!excluir} titulo={`Excluir pasta “${excluir?.titulo ?? ''}”?`} mensagem="A pasta e seus planos saem da lista. Os planos deixam de estar ativos; versões publicadas e registros dos alunos são preservados." rotuloConfirmar="Excluir pasta e planos" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const id = excluir.id; setExcluir(null);
        excluirPasta(id).then(aoSalvar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
      }} />
      {modo ? <FolhaPasta alunoId={alunoId} modo={modo} diasAtualizacao={diasAtualizacao} aoFechar={() => setModo(null)} aoSalvar={aoSalvar} /> : null}
      {finalizar ? <FolhaFinalizar pasta={finalizar} aoFechar={() => setFinalizar(null)} aoFinalizar={(comPeso) => { setFinalizar(null); aoSalvar(); if (comPeso) aoGravarPeso?.(); }} /> : null}
    </>
  );
}

/** Uma pasta na lista: nome, período e status. Tocar abre a folha com as ações e os planos de treino e dieta. */
function LinhaPasta({ pasta, atualizacao, aoAbrir }: { pasta: PastaResumo; atualizacao: Atualizacao | null; aoAbrir: () => void }) {
  const { cores, marca, marcaTexto } = useTema();
  const concluida = !!pasta.concluidaEm;
  const situacao = atualizacao?.dataAtualizacao ? statusAtualizacaoTreinador(atualizacao) : null;
  const Icone = concluida ? FolderCheck : Folder;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pasta ${pasta.titulo}, ${concluida ? 'concluída' : 'ativa'}, ${periodo(pasta)}${situacao ? `, atualização: ${situacao.texto}` : ''}. Abrir.`}
      onPress={aoAbrir}
      style={(estado) => [
        estilos.linha,
        { backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      <View style={[estilos.icone, { backgroundColor: concluida ? cores.superficie2 : `${marca}22` }]}>
        <Icone size={22} color={concluida ? cores.textoSuave : marcaTexto} />
      </View>
      <View style={estilos.linhaTextos}>
        <Texto numerico style={estilos.linhaTitulo}>{pasta.titulo}</Texto>
        <Texto numerico variante="suave">{periodo(pasta)}</Texto>
        {situacao ? <View style={estilos.linhaAtualizacao}><Texto variante="pequeno">Atualização:</Texto><Selo {...situacao} /></View> : null}
      </View>
      {concluida ? <Selo texto="Concluída" tipo="neutro" /> : <Selo texto="Ativa" tipo="sucesso" />}
      <ChevronRight size={20} color={cores.textoSuave} />
    </Pressable>
  );
}

function FolhaPasta({ alunoId, modo, diasAtualizacao, aoFechar, aoSalvar }: { alunoId: string; modo: Modo; diasAtualizacao: number | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useAviso();
  const origem = modo.tipo === 'nova' ? null : modo.pasta;
  const sugestao = modo.tipo === 'replicar' && origem ? proximoPeriodo(origem) : modo.tipo === 'nova' ? periodoInicial(hojeIso(), diasAtualizacao) : null;
  const [titulo, setTitulo] = useState(modo.tipo === 'editar' && origem ? origem.titulo : '');
  const [inicio, setInicio] = useState(sugestao ? sugestao.inicio : origem && modo.tipo === 'editar' ? dataParaTela(origem.inicio) : '');
  const [fim, setFim] = useState(sugestao ? sugestao.fim : origem && modo.tipo === 'editar' ? dataParaTela(origem.fim) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido = titulo.trim() !== '' && ini !== undefined && fi !== undefined;

  const salvar = () => {
    if (!valido) return;
    const dados = { titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null };
    setSalvando(true);
    setErro(null);
    const chamada =
      modo.tipo === 'nova' ? criarPasta(alunoId, dados) : modo.tipo === 'editar' ? atualizarPasta(modo.pasta.id, dados) : replicarPasta(modo.pasta.id, dados);
    chamada.then(
      () => {
        avisar(modo.tipo === 'replicar' ? 'Pasta replicada com os treinos e dietas.' : 'Pasta salva.', 'sucesso');
        aoSalvar();
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  const titulos = { nova: 'Nova pasta', editar: 'Editar pasta', replicar: 'Replicar pasta para o próximo ciclo' };
  return (
    <Folha
      visivel
      titulo={titulos[modo.tipo]}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!valido} motivo={titulo.trim() === '' ? 'Informe o título.' : 'Confira as datas de início e fim.'} />
        </>
      }>
      {modo.tipo === 'replicar' ? (
        <Texto variante="suave">
          Cria uma pasta nova com cópia dos treinos e das dietas publicados de “{modo.pasta.titulo}”, como rascunhos.
        </Texto>
      ) : null}
      {modo.tipo === 'nova' && diasAtualizacao ? (
        <Texto variante="suave">
          Início e fim já vêm preenchidos pelo ciclo do aluno ({diasAtualizacao} dias). Você pode mudar as datas.
        </Texto>
      ) : null}
      {modo.tipo === 'editar' ? (
        <Texto variante="suave">
          O novo período vale para o treino e a dieta da pasta. Planos já publicados só mudam ao publicar de novo.
        </Texto>
      ) : null}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 17" />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim" valor={fim} aoMudar={setFim} />
        </View>
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

function FolhaFinalizar({ pasta, aoFechar, aoFinalizar }: { pasta: PastaResumo; aoFechar: () => void; aoFinalizar: (comPeso: boolean) => void }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [data, setData] = useState(dataParaTela(hojeIso()));
  const [peso, setPeso] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const dataIso = dataDaTela(data);
  const valido = dataIso !== undefined && (peso !== null || observacao.trim() === '');

  const salvar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    const comPeso = pode('ALUNO_SENSIVEL_ALTERAR') && peso !== null;
    finalizarPasta(pasta.id, { data: comPeso ? dataIso ?? null : null, pesoKg: comPeso ? peso : null, observacao: comPeso ? observacao.trim() || null : null }).then(
      () => {
        avisar(comPeso ? 'Pasta finalizada e peso registrado.' : 'Pasta finalizada.', 'sucesso');
        aoFinalizar(comPeso);
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  return (
    <Folha
      visivel
      titulo={`Finalizar “${pasta.titulo}”`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Finalizar pasta" aoTocar={salvar} carregando={salvando} desabilitado={!valido} motivo={dataIso === undefined ? 'Confira a data do peso.' : 'A observação só é gravada junto com o peso.'} /></Permitido>
        </>
      }>
      <Texto variante="suave">
        Dá a pasta como concluída. Você pode reabrir a pasta depois.
      </Texto>
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR">
      <Texto variante="suave">O peso opcional entra no registro do aluno com a data e a observação abaixo.</Texto>
      <CampoData rotulo="Data do peso" valor={data} aoMudar={setData} />
      <CampoNumerico rotulo="Peso (opcional)" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} ajuda="Só é gravada junto com o peso." />
      </Permitido>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 190 },
  resumo: { gap: espaco(0.75) },
  linhaAtualizacao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.75), marginTop: espaco(0.5) },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE + espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
  },
  icone: { width: 44, height: 44, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  linhaTextos: { flex: 1, gap: 2 },
  linhaTitulo: { fontFamily: fontes.negrito, fontSize: 17, lineHeight: 23 },
});

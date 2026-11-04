import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import { podeAplicarModelo, podeSalvarPastaComoModelo, temAcaoNoMenuDaPasta } from '../dominio/modelos';
import { Permitido } from '../ui/Permitido';
import { useSessao } from '../sessao/SessaoProvider';
import { BookmarkPlus, CheckCircle2, ChevronRight, Copy, Ellipsis, Folder, FolderCheck, FolderPlus, Package, Pencil, RotateCcw, Trash2, Users } from 'lucide-react-native';
import { sobre } from '../ui/sobre';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { atualizacaoDoAluno, atualizacoesDoAluno, excluirPasta, finalizarPasta, reabrirPasta, salvarPastaComoModelo, atualizarPasta, criarPasta, escolherQuestionarioDaPasta, listarPastas, pesosDoAluno, pesoSugeridoDaPasta, replicarPasta } from '../api/rotas';
import { SeletorDeQuestionario } from './questionarios/SeletorDeQuestionario';
import type { Atualizacao, PastaResumo, Receita } from '../api/tipos';
import { atualizacaoDaPasta, caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../dominio/atualizacao';
import { NOTAS_DA_RENOVACAO, PASSOS_DA_RENOVACAO, TITULO_ORDEM_DA_RENOVACAO } from '../dominio/ordemDaRenovacao';
import { corpoDaFinalizacao, dataDoPesoDaAtualizacao, dataInicialDoPeso, notaDoPesoJaRegistrado, pesoDaAtualizacao, pesoSugeridoSemEdicao, substituiPesoDaAtualizacao, sugestaoParaPreencher, textoDoPesoDaAtualizacao } from '../dominio/pesoNaFinalizacao';
import { mensagemPastaCopiada, motivoParaNaoCopiar, notaDoPesoSugerido, podeSugerirPeso } from '../dominio/publicarPasta';
import { rotuloAbrirFicha } from '../dominio/planoDoAluno';
import { dataDaTelaNaFaixa } from '../dominio/datasValidas';
import { dataParaTela, hojeIso, numeroParaTela } from '../dominio/formatos';
import { dataSemAnoCorrente, periodoCurto } from '../dominio/datasRelativas';
import { precisaRenovar } from '../dominio/resumoDoAluno';
import { dadosDaRenovacao, diasDoPeriodo, fimQueAcompanha, periodoInicial, proximoPeriodo } from '../dominio/periodo';
import { FILTROS_PASTAS, filtrarPastas, pastasParaCopiarNaNova, type FiltroPastas } from '../dominio/pastas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { CartaoCicloNoPeriodo } from './ciclo/CicloNaFicha';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../ui/Estados';
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
import { CartaoPlanos } from './CartaoPlanos';
import { FolhaDeAcoes } from './FolhaDeAcoes';
import { CopiarPastaParaAluno } from './CopiarPastaParaAluno';
import { PublicarTudoDaPasta } from './PublicarTudoDaPasta';
import { usePlanosDaPasta } from './usePlanosDaPasta';

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
  /** Chamado depois de criar, alterar, renovar, finalizar ou excluir uma pasta (o resumo do topo da ficha recarrega). */
  aoMudar?: () => void;
  /** Muda quando outra parte da ficha alterou as pastas (renovar pelo resumo): a lista busca de novo. */
  geracao?: number;
}

/**
 * "Renovar" da pasta (menu ⋯, linha da pasta e resumo da ficha): confirma e cria a pasta do próximo ciclo com cópia
 * em rascunho dos planos (`dadosDaRenovacao`). Devolve o pedido e o painel de confirmação, que a tela coloca onde quiser.
 */
export function useRenovarPasta(diasAtualizacao: number | null, aoRenovar: () => void) {
  const { avisar } = useAviso();
  const [renovar, setRenovar] = useState<PastaResumo | null>(null);
  const [renovando, setRenovando] = useState(false);
  const dados = renovar ? dadosDaRenovacao(renovar, hojeIso(), diasAtualizacao) : null;
  const painel = (
    <PainelConfirmacao visivel={!!renovar} titulo={`Renovar a pasta “${renovar?.titulo ?? ''}”?`}
      mensagem={dados?.erro ? `${dados.erro}. Para escolher as datas, use “Copiar para outro período” na pasta.` : dados ? `Cria a pasta “${dados.titulo}” para ${dados.texto}, com cópia em rascunho dos treinos, dietas e mobilidades. A pasta atual continua como está; para escolher o título ou as datas, use “Copiar para outro período” na pasta.` : ''}
      rotuloConfirmar="Renovar pasta" carregando={renovando} desabilitado={!!dados?.erro} motivo={dados?.erro ?? undefined} aoCancelar={() => setRenovar(null)} aoConfirmar={() => {
        if (!renovar || !dados) return;
        setRenovando(true);
        replicarPasta(renovar.id, { titulo: dados.titulo, inicio: dados.inicio, fim: dados.fim }).then(
          () => { setRenovando(false); setRenovar(null); avisar('Pasta renovada. Os planos vieram como rascunho.', 'sucesso'); aoRenovar(); },
          (e: unknown) => { setRenovando(false); setRenovar(null); avisar(textoDoErro(e), 'perigo'); },
        );
      }} />
  );
  return { pedir: setRenovar, painel };
}

/**
 * Pastas do aluno (ex.: "Plano 16"): cada uma agrupa treinos e dietas e tem o período que vale para todos. Mudar o
 * período da pasta acompanha os rascunhos dos planos dela; replicar a pasta copia todos para o próximo ciclo.
 */
export function CartaoPastas({ alunoId, alunoNome = '', diasAtualizacao = null, aoGravarPeso, aoMudar, geracao: geracaoExterna = 0, pastaInicialId }: PropsPastas) {
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar(`pastas:${alunoId}:${geracaoExterna}`, () => listarPastas(alunoId));
  const [modo, setModo] = useState<Modo | null>(null);
  const [filtro, setFiltro] = useState<FiltroPastas>('todas');
  const { avisar } = useAviso();
  // Saídas para outra tela passam pela guarda (os dados do aluno podem estar em edição na ficha, D7); fechar a Folha da
  // pasta vai junto, para o "Continuar editando" deixar a Folha aberta como estava.
  const { confirmar } = useSaidaGuardada();
  const [excluir, setExcluir] = useState<PastaResumo | null>(null);
  const [salvarModelo, setSalvarModelo] = useState<PastaResumo | null>(null);
  const [finalizar, setFinalizar] = useState<PastaResumo | null>(null);
  // Pasta aberta na folha com as ações e os planos; guarda só o id para refletir o que a lista recarrega.
  const [abertaId, setAbertaId] = useState<string | null>(pastaInicialId??null);
  // "Mais ações" da pasta (salvar como pacote, excluir): menu à parte, para a folha ter uma ação principal só.
  const [menuPasta, setMenuPasta] = useState<PastaResumo | null>(null);
  const visiveis = filtrarPastas(dados ?? [], filtro);
  const aberta = dados?.find((p) => p.id === abertaId) ?? null;
  const [escolher, setEscolher] = useState(false);
  const [modelo, setModelo] = useState<Receita | null>(null);
  const [geracao, setGeracao] = useState(0);
  // "Copiar pasta para outro aluno" (D7), aberto pelo ⋯ da pasta.
  const [copiar, setCopiar] = useState<PastaResumo | null>(null);
  // Planos da pasta em foco (Folha, ⋯ ou cópia), carregados uma vez: os cartões de plano, o "Publicar tudo" e a cópia
  // usam a mesma lista.
  const emFoco = aberta ?? menuPasta ?? copiar;
  const planosEmFoco = usePlanosDaPasta(alunoId, emFoco?.id ?? null, geracao);
  // A atualização fecha o período da pasta: vem junto na lista e na folha (dado sensível, só com ATUALIZACAO_LER).
  const verAtualizacoes = pode('ATUALIZACAO_LER');
  const { dados: atualizacoes, recarregar: recarregarAtualizacoes } = useCarregar(verAtualizacoes ? `atualizacoes-pastas:${alunoId}` : null, async () => {
    const [atual, historico] = await Promise.all([atualizacaoDoAluno(alunoId), atualizacoesDoAluno(alunoId)]);
    return { atual, historico };
  });
  useFocusEffect(useCallback(() => { recarregarAtualizacoes(); }, [recarregarAtualizacoes]));
  const daPasta = (id: string) => atualizacoes ? atualizacaoDaPasta(id, atualizacoes.atual, atualizacoes.historico) : null;
  // Com a atualização da pasta aberta para revisar, a ação principal da folha passa a ser revisá-la.
  const revisarNaFolha = !!aberta && verAtualizacoes && daPasta(aberta.id)?.fase === 'ENVIADA' && pode('ATUALIZACAO_RESPONDER');

  const aoSalvar = () => {
    setModo(null);
    setGeracao((g) => g + 1);
    recarregar();
    recarregarAtualizacoes();
    aoMudar?.();
  };
  const renovacao = useRenovarPasta(diasAtualizacao, aoSalvar);
  // Publicar muda o plano em uso: os selos, a lista e o resumo da ficha buscam de novo (a Folha continua aberta).
  const aoPublicar = () => {
    setGeracao((g) => g + 1);
    recarregar();
    aoMudar?.();
  };
  const podePublicarAlgo = pode(PERMISSOES_DO_PLANO.treino.publicar) || pode(PERMISSOES_DO_PLANO.dieta.publicar);
  const hoje = hojeIso();

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
          <Vazio titulo="Nenhuma pasta nesta situação" texto={filtro === 'abertas' ? 'Todas as pastas estão concluídas.' : 'Nenhuma pasta foi concluída ainda.'} />
        ) : null}
        {visiveis.map((p) => (
          <LinhaPasta key={p.id} pasta={p} atualizacao={daPasta(p.id)} aoAbrir={() => setAbertaId(p.id)} hoje={hoje}
            aoRevisar={(a) => confirmar(() => router.push(caminhoAtualizacaoTreinador(a)))}
            aoRenovar={pode('PASTA_ALTERAR') && precisaRenovar(p, dados ?? [], hoje) ? () => renovacao.pedir(p) : undefined} />
        ))}
      </Cartao>
      {aberta ? (
        <Folha visivel titulo={aberta.titulo} largura={LARGURA_EDITOR} aoFechar={() => setAbertaId(null)}
          acaoNoTopo={temAcaoNoMenuDaPasta(pode) ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações da pasta ${aberta.titulo}`} aoTocar={() => { setAbertaId(null); setMenuPasta(aberta); }} /> : undefined}>
          <View style={estilos.resumo}>
            <Texto numerico variante="suave">Período: {periodoCurto(aberta.inicio, aberta.fim, hoje)}</Texto>
            <CartaoCicloNoPeriodo alunoId={alunoId} inicio={aberta.inicio} fim={aberta.fim} />
            {aberta.concluidaEm ? <Selo texto={`Concluída em ${dataSemAnoCorrente(hojeIso(new Date(aberta.concluidaEm)), hoje)}`} tipo="neutro" /> : null}
          </View>
          {/* Uma ação principal só na folha: com a atualização para revisar, é "Revisar atualização" (no cartão dela,
              logo abaixo); senão finalizar ou reabrir. O resto é secundário ou vai para o menu ⋯. */}
          <LinhaDeAcoes>
            {aberta.concluidaEm ? (
              <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Reabrir pasta" Icone={RotateCcw} tipo={revisarNaFolha ? 'secundario' : 'primario'} aoTocar={() => {
                reabrirPasta(aberta.id).then(() => { avisar('Pasta reaberta.', 'sucesso'); recarregar(); aoMudar?.(); }, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
              }} /></Permitido>
            ) : (
              <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Finalizar pasta" Icone={CheckCircle2} tipo={revisarNaFolha ? 'secundario' : 'primario'} aoTocar={() => { setAbertaId(null); setFinalizar(aberta); }} /></Permitido>
            )}
            <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Editar" tipo="secundario" Icone={Pencil} aoTocar={() => { setAbertaId(null); setModo({ tipo: 'editar', pasta: aberta }); }} /></Permitido>
            <Permitido codigo="PASTA_ALTERAR"><Botao rotulo="Copiar para outro período" tipo="secundario" Icone={Copy} aoTocar={() => { setAbertaId(null); setModo({ tipo: 'replicar', pasta: aberta }); }} /></Permitido>
          </LinhaDeAcoes>
          {/* Só vale para este período; a atualização ainda aberta passa a usar o questionário escolhido na hora. */}
          <SeletorDeQuestionario rotulo="Questionário" valor={aberta.questionarioId} rotuloDoNulo="O mesmo do aluno" podeAlterar={pode('PASTA_ALTERAR')}
            aoEscolher={async (questionarioId) => { await escolherQuestionarioDaPasta(aberta.id, questionarioId); recarregar(); recarregarAtualizacoes(); }} />
          {/* A atualização fecha o período e é o ponto central do acompanhamento: fica logo abaixo das ações. */}
          {verAtualizacoes ? <AtualizacaoDaPasta atualizacao={daPasta(aberta.id)} carregando={!atualizacoes} destaque={revisarNaFolha}
            aoAbrir={(a) => confirmar(() => { setAbertaId(null); router.push(caminhoAtualizacaoTreinador(a)); })} /> : null}
          <OrdemDaRenovacao />
          <Texto variante="secao">Planos desta pasta</Texto>
          {/* Sem permissão de publicar nenhum tipo, o botão não existe para a pessoa; com a de um tipo só, ele aparece e
              fica desabilitado com o motivo quando o outro tipo tem alteração. */}
          {podePublicarAlgo ? <PublicarTudoDaPasta key={aberta.id} pasta={aberta} planos={planosEmFoco.planos} versoes={planosEmFoco.versoes} carregando={planosEmFoco.carregando}
            atualizando={planosEmFoco.atualizando} falhou={planosEmFoco.falhou} aoTentarDeNovo={planosEmFoco.recarregarFalhas} aoPublicar={aoPublicar} aoRecarregar={aoPublicar} aoNavegar={() => setAbertaId(null)} /> : null}
          <Permitido codigo={PERMISSOES_DO_PLANO.treino.ler}><CartaoPlanos tipo="treino" alunoId={alunoId} pasta={aberta} geracao={geracao} carga={planosEmFoco.cargas.treino} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo={PERMISSOES_DO_PLANO.dieta.ler}><CartaoPlanos tipo="dieta" alunoId={alunoId} pasta={aberta} geracao={geracao} carga={planosEmFoco.cargas.dieta} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo={PERMISSOES_DO_PLANO.mobilidade.ler}><CartaoPlanos tipo="mobilidade" alunoId={alunoId} pasta={aberta} geracao={geracao} carga={planosEmFoco.cargas.mobilidade} aoNavegar={() => setAbertaId(null)} /></Permitido>
          <Permitido codigo="REGISTRO_LER"><CartaoRegistros aluno={{ id: alunoId, nome: alunoNome }} pasta={aberta} /></Permitido>
        </Folha>
      ) : null}
      {menuPasta ? <FolhaDeAcoes titulo={menuPasta.titulo} aoFechar={() => setMenuPasta(null)} acoes={[
        pode('PASTA_ALTERAR') ? { rotulo: 'Renovar para o próximo ciclo', detalhe: 'Pasta nova com os planos em rascunho.', Icone: Copy, aoTocar: () => renovacao.pedir(menuPasta) } : null,
        podeSalvarPastaComoModelo(pode) ? { rotulo: 'Salvar como pacote', detalhe: 'Para usar com outros alunos.', Icone: BookmarkPlus, aoTocar: () => setSalvarModelo(menuPasta) } : null,
        pode('PASTA_ALTERAR') && pode('ALUNO_LER') ? {
          rotulo: 'Copiar pasta para outro aluno',
          // Sem o *_ALTERAR de um tipo presente, a folha abre com o motivo e o "Copiar pasta" desabilitado.
          detalhe: (planosEmFoco.planos ? motivoParaNaoCopiar(planosEmFoco.planos, pode) : null) ?? 'Pasta nova no outro aluno, com os planos em rascunho.',
          Icone: Users,
          aoTocar: () => setCopiar(menuPasta),
        } : null,
        pode('PASTA_ALTERAR') ? { rotulo: 'Excluir pasta', Icone: Trash2, perigo: true, aoTocar: () => setExcluir(menuPasta) } : null,
      ]} /> : null}
      {escolher ? <FolhaReceitas tipo="PASTA_PLANO" titulo="Pacote (treino, dieta e mobilidade)" aoFechar={() => setEscolher(false)} aoUsar={(r) => { setEscolher(false); setModelo(r); }} /> : null}
      {modelo ? <AplicarAoAluno modelo={modelo} alunoInicial={alunoId} aoFechar={() => setModelo(null)} aoAplicar={() => { setModelo(null); aoSalvar(); avisar('Pasta copiada como rascunho.', 'sucesso'); }} /> : null}
      {salvarModelo ? <FolhaSalvarReceita titulo="Salvar pasta como pacote" explicacao="Copia os rascunhos de treino e dieta desta pasta para reutilizar em outros alunos." aoFechar={() => setSalvarModelo(null)} aoSalvar={async (nome, descricao) => {
        await salvarPastaComoModelo(salvarModelo.id, nome, descricao); setSalvarModelo(null); avisar('Pacote salvo.', 'sucesso');
      }} /> : null}
      {copiar ? <CopiarPastaParaAluno pasta={copiar} planos={planosEmFoco.planos} carregandoPlanos={planosEmFoco.carregando} aoFechar={() => setCopiar(null)}
        aoCopiar={(destinoId, nome, pulados) => {
          setCopiar(null);
          avisar(mensagemPastaCopiada(nome, pulados), 'sucesso', { rotulo: rotuloAbrirFicha(nome), aoTocar: () => confirmar(() => router.push(`/treinador/alunos/${encodeURIComponent(destinoId)}`)) });
        }} /> : null}
      {renovacao.painel}
      <PainelConfirmacao visivel={!!excluir} titulo={`Excluir pasta “${excluir?.titulo ?? ''}”?`} mensagem="A pasta e seus planos saem da lista. Os planos deixam de estar ativos; versões publicadas e registros dos alunos são preservados." rotuloConfirmar="Excluir pasta e planos" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const id = excluir.id; setExcluir(null);
        excluirPasta(id).then(aoSalvar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
      }} />
      {modo ? <FolhaPasta alunoId={alunoId} modo={modo} diasAtualizacao={diasAtualizacao} pastas={dados ?? []} aoFechar={() => setModo(null)} aoSalvar={aoSalvar} /> : null}
      {finalizar ? <FolhaFinalizar pasta={finalizar} alunoId={alunoId} atualizacao={daPasta(finalizar.id)} aoFechar={() => setFinalizar(null)} aoFinalizar={(comPeso) => { setFinalizar(null); aoSalvar(); if (comPeso) aoGravarPeso?.(); }} /> : null}
    </>
  );
}

/**
 * Uma pasta na lista: nome, período e a situação da atualização (o selo diz de quê). Tocar abre a folha com as ações e
 * os planos. Na pasta que pede trabalho, as ações do dia ficam na própria linha: "Revisar atualização" e "Renovar".
 * Os botões ficam fora da área de toque da linha (botão dentro de botão não funciona no leitor de tela).
 */
function LinhaPasta({ pasta, atualizacao, hoje, aoAbrir, aoRevisar, aoRenovar }: {
  pasta: PastaResumo; atualizacao: Atualizacao | null; hoje: string; aoAbrir: () => void;
  aoRevisar: (a: Atualizacao) => void; aoRenovar?: () => void;
}) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const concluida = !!pasta.concluidaEm;
  const situacao = atualizacao?.dataAtualizacao ? statusAtualizacaoTreinador(atualizacao, hoje) : null;
  const revisar = atualizacao?.fase === 'ENVIADA' && pode('ATUALIZACAO_LER') ? atualizacao : null;
  const Icone = concluida ? FolderCheck : Folder;
  const periodoTexto = periodoCurto(pasta.inicio, pasta.fim, hoje);
  return (
    <View style={[estilos.linha, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pasta ${pasta.titulo}, ${concluida ? 'concluída' : 'aberta'}, ${periodoTexto}${situacao ? `, ${situacao.texto}` : ''}. Abrir.`}
        onPress={aoAbrir}
        style={(estado) => [estilos.linhaToque, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
        {/* Ícone neutro: a marca não diz situação; quem diz é o selo. */}
        <View style={[estilos.icone, { backgroundColor: cores.superficie3 }]}>
          <Icone size={22} color={concluida ? cores.textoSuave : cores.texto} />
        </View>
        <View style={estilos.linhaTextos}>
          <Texto numerico style={estilos.linhaTitulo}>{pasta.titulo}</Texto>
          <Texto numerico variante="suave">{periodoTexto}</Texto>
          {situacao || concluida ? (
            <View style={estilos.linhaAtualizacao}>
              {concluida ? <Selo texto="Concluída" tipo="neutro" /> : null}
              {situacao ? <Selo texto={situacao.texto} tipo={situacao.tipo} /> : null}
            </View>
          ) : null}
        </View>
        <ChevronRight size={20} color={cores.textoSuave} />
      </Pressable>
      {revisar || aoRenovar ? (
        <LinhaDeAcoes style={estilos.acoesDaLinha}>
          {revisar ? <Botao rotulo="Revisar atualização" tipo="secundario" aoTocar={() => aoRevisar(revisar)} /> : null}
          {aoRenovar ? <Botao rotulo="Renovar" rotuloAcessivel={`Renovar a pasta ${pasta.titulo} para o próximo ciclo`} tipo="secundario" Icone={Copy} aoTocar={aoRenovar} /> : null}
        </LinhaDeAcoes>
      ) : null}
    </View>
  );
}

function FolhaPasta({ alunoId, modo, diasAtualizacao, pastas, aoFechar, aoSalvar }: {
  alunoId: string; modo: Modo; diasAtualizacao: number | null; pastas: readonly PastaResumo[]; aoFechar: () => void; aoSalvar: () => void;
}) {
  const { avisar } = useAviso();
  const origem = modo.tipo === 'nova' ? null : modo.pasta;
  const origens = modo.tipo === 'nova' ? pastasParaCopiarNaNova(pastas) : [];
  const sugestao = modo.tipo === 'replicar' && origem ? proximoPeriodo(origem) : modo.tipo === 'nova' ? periodoInicial(hojeIso(), diasAtualizacao) : null;
  const [titulo, setTitulo] = useState(modo.tipo === 'editar' && origem ? origem.titulo : '');
  const [inicio, setInicio] = useState(sugestao ? sugestao.inicio : origem && modo.tipo === 'editar' ? dataParaTela(origem.inicio) : '');
  const [fim, setFim] = useState(sugestao ? sugestao.fim : origem && modo.tipo === 'editar' ? dataParaTela(origem.fim) : '');
  const [copiarDe, setCopiarDe] = useState<string | null>(null);
  // Pasta nova ou réplica: o fim acompanha o início pela duração sugerida até o treinador mexer no fim (reunião de 29/10).
  // Pasta salva abre com as datas gravadas e nada é recalculado.
  const [duracao, setDuracao] = useState<number | null>(sugestao ? diasDoPeriodo(sugestao.inicio, sugestao.fim) : null);
  const [fimManual, setFimManual] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTelaNaFaixa(inicio, 'PLANEJAMENTO');
  const fi = dataDaTelaNaFaixa(fim, 'PLANEJAMENTO');
  const fimAntes = !!ini && !!fi && fi < ini;
  const valido = titulo.trim() !== '' && ini !== undefined && fi !== undefined && !fimAntes;
  const dias = diasDoPeriodo(inicio, fim);

  const mudarInicio = (texto: string) => {
    setInicio(texto);
    if (fimManual) return;
    const novoFim = fimQueAcompanha(texto, duracao);
    if (novoFim) setFim(novoFim);
  };
  const mudarFim = (texto: string) => {
    setFim(texto);
    if (duracao) setFimManual(true);
  };
  const usarDuracao = () => {
    const novoFim = fimQueAcompanha(inicio, duracao);
    if (novoFim) setFim(novoFim);
    setFimManual(false);
  };
  const escolherOrigem = (id: string | null) => {
    setCopiarDe(id);
    if (fimManual) return;
    if (!id) {
      const volta = periodoInicial(hojeIso(), diasAtualizacao);
      setInicio(volta.inicio);
      setFim(volta.fim);
      setDuracao(diasDoPeriodo(volta.inicio, volta.fim));
      return;
    }
    const pasta = origens.find((p) => p.id === id);
    if (!pasta?.fim) return;
    const proximo = proximoPeriodo(pasta);
    setInicio(proximo.inicio);
    setFim(proximo.fim);
    setDuracao(diasDoPeriodo(proximo.inicio, proximo.fim));
  };

  const salvar = () => {
    if (!valido) return;
    const dados = { titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null };
    setSalvando(true);
    setErro(null);
    const copiando = modo.tipo === 'nova' ? copiarDe : null;
    const chamada = copiando
      ? replicarPasta(copiando, dados)
      : modo.tipo === 'nova' ? criarPasta(alunoId, dados) : modo.tipo === 'editar' ? atualizarPasta(modo.pasta.id, dados) : replicarPasta(modo.pasta.id, dados);
    chamada.then(
      () => {
        avisar(copiando || modo.tipo === 'replicar' ? 'Pasta replicada com os treinos e dietas.' : 'Pasta salva.', 'sucesso');
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
          Início e fim já vêm preenchidos pelo ciclo de atualização ({diasAtualizacao} dias). Ao mudar o início, o fim acompanha.
        </Texto>
      ) : null}
      {modo.tipo === 'editar' ? (
        <Texto variante="suave">
          O novo período vale para o treino e a dieta da pasta. Planos já publicados só mudam ao publicar de novo.
        </Texto>
      ) : null}
      {origens.length > 0 ? (
        <>
          {/* Em lista (folha com busca acima de 8): um aluno antigo tem muitas pastas concluídas, e em chips elas viravam várias linhas. */}
          <EscolhaEmFolha
            rotulo="Copiar de"
            valor={copiarDe}
            aoMudar={escolherOrigem}
            opcoes={[
              { valor: null, rotulo: 'Não copiar' },
              ...origens.map((p) => ({ valor: p.id, rotulo: `${p.titulo} · ${periodoCurto(p.inicio, p.fim)}` })),
            ]}
          />
          {copiarDe ? (
            <Texto variante="suave">Copia os treinos e as dietas publicados dessa pasta, como rascunhos.</Texto>
          ) : null}
        </>
      ) : null}
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 17" />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início" nome="Início da pasta" regra="PLANEJAMENTO" valor={inicio} aoMudar={mudarInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim" nome="Fim da pasta" regra="PLANEJAMENTO" valor={fim} aoMudar={mudarFim} erro={fimAntes ? 'O fim vem antes do início.' : null} />
        </View>
      </View>
      {dias ? <Texto variante="suave" numerico>Período: {inicio} a {fim} · {dias === 1 ? '1 dia' : `${dias} dias`}</Texto> : null}
      {fimManual && duracao ? (
        <View style={estilos.fimManual}>
          <Texto variante="suave">Fim ajustado à mão.</Texto>
          <Botao rotulo={`${copiarDe ? 'Usar a duração do período' : 'Usar a duração do ciclo'} (${duracao} ${duracao === 1 ? 'dia' : 'dias'})`} tipo="fantasma" aoTocar={usarDuracao} />
        </View>
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

/**
 * Ordem sugerida para renovar o ciclo (reunião de 30/10): só orientação, recolhida, para não disputar com a ação
 * principal da Folha. Nenhum botão e nenhuma automação.
 */
function OrdemDaRenovacao() {
  return (
    <Cartao titulo={TITULO_ORDEM_DA_RENOVACAO} nivel={3} recolhivel recolhido>
      <View style={estilos.passos}>
        {PASSOS_DA_RENOVACAO.map((passo, i) => (
          <View key={passo} style={estilos.passo}>
            <Texto numerico style={estilos.numeroDoPasso}>{i + 1}.</Texto>
            <Texto style={estilos.textoDoPasso}>{passo}</Texto>
          </View>
        ))}
      </View>
      {NOTAS_DA_RENOVACAO.map((nota) => <Texto key={nota} variante="suave">{nota}</Texto>)}
    </Cartao>
  );
}

function FolhaFinalizar({ pasta, alunoId, atualizacao, aoFechar, aoFinalizar }: {
  pasta: PastaResumo; alunoId: string; atualizacao: Atualizacao | null; aoFechar: () => void; aoFinalizar: (comPeso: boolean) => void;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [hoje] = useState(hojeIso);
  // D8 (02/11): o peso e a data nascem com os da atualização desta pasta (`GET /pastas/{id}/peso-sugerido`), editáveis.
  // Só com as permissões do dado sensível, da atualização e de gravar o peso. A resposta chega depois de a folha abrir:
  // ela só PREENCHE se a pessoa ainda não mexeu em peso, data ou observação antes de ela chegar (`sugestaoParaPreencher`);
  // se mexeu, nenhum campo recebe a sugestão (a data não pula para a da atualização). A decisão vale na chegada e não
  // muda depois: mexer depois de preenchido é edição normal. Falha ou sem peso = peso vazio e data de hoje, sem erro na
  // tela. Sem edição (valor, data e observação como vieram) finalizar não grava o peso de novo: `corpoDaFinalizacao`. O
  // peso nunca vai a log.
  const sugestao = useCarregar(podeSugerirPeso(pode) ? `peso-sugerido:${pasta.id}` : null, () => pesoSugeridoDaPasta(pasta.id));
  const sugestaoChegou = !!sugestao.dados || !!sugestao.erro;
  const [mexeuAntesDaSugestao, setMexeuAntesDaSugestao] = useState(false);
  const marcarMexida = () => { if (!sugestaoChegou) setMexeuAntesDaSugestao(true); };
  const sugestaoDaPasta = sugestaoParaPreencher(sugestao.erro ? null : sugestao.dados, mexeuAntesDaSugestao);
  const sugerido = sugestaoDaPasta?.pesoKg ?? null;
  const dataInicial = dataInicialDoPeso(sugestaoDaPasta, hoje);
  const [dataDigitada, setDataDigitada] = useState<string | null>(null);
  const setData = (texto: string) => { marcarMexida(); setDataDigitada(texto); };
  const data = dataDigitada ?? dataParaTela(dataInicial);
  const [digitado, setDigitado] = useState<{ valor: number | null } | null>(null);
  const peso = digitado ? digitado.valor : sugerido;
  const setPeso = (valor: number | null) => { marcarMexida(); setDigitado({ valor }); };
  const comSugestao = sugerido !== null && peso === sugerido;
  const [observacao, setObservacaoDigitada] = useState('');
  const setObservacao = (texto: string) => { marcarMexida(); setObservacaoDigitada(texto); };
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const dataIso = dataDaTelaNaFaixa(data, 'REGISTRO');
  const valido = dataIso !== undefined && (peso !== null || observacao.trim() === '');
  // Peso que a atualização enviada já gravou na data dela: só com as duas permissões (peso e atualização são sensíveis).
  const dataDoPeso = pode('ALUNO_SENSIVEL_LER') && pode('ATUALIZACAO_LER') ? dataDoPesoDaAtualizacao(atualizacao) : null;
  const pesos = useCarregar(dataDoPeso ? `pesos-finalizar:${alunoId}:${dataDoPeso}` : null, () => pesosDoAluno(alunoId));
  const registrado = pesoDaAtualizacao(pesos.dados, dataDoPeso);
  const formulario = { podeGravarPeso: pode('ALUNO_SENSIVEL_ALTERAR'), sugerido, peso, dataIso, dataInicial, observacao };
  // Sugerido e intacto: já está no registro, nada a substituir nem a conferir.
  const jaRegistrado = pesoSugeridoSemEdicao(formulario);
  const substitui = !jaRegistrado && substituiPesoDaAtualizacao(dataIso, registrado, peso);

  const salvar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    const corpo = corpoDaFinalizacao(formulario);
    const comPeso = corpo.pesoKg !== null;
    finalizarPasta(pasta.id, corpo).then(
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
      <Texto variante="suave">
        Finalizar não troca o que o aluno vê: ele passa a usar a pasta nova quando você publica o treino, a dieta ou a
        mobilidade dela.
      </Texto>
      {/* Intacto, a nota junto do campo já diz o mesmo: a linha sairia repetida. */}
      {registrado && !jaRegistrado ? <Texto numerico>{textoDoPesoDaAtualizacao(registrado)}</Texto> : null}
      {dataDoPeso && pesos.erro ? <Texto variante="suave">Não foi possível conferir o peso da atualização.</Texto> : null}
      <Permitido codigo="ALUNO_SENSIVEL_ALTERAR">
      <Texto variante="suave">
        {jaRegistrado
          ? 'Este peso já está no registro do aluno: finalizar assim não grava de novo. Mude o valor ou a data só se houver uma pesagem nova.'
          : comSugestao
            ? 'O peso entra no registro do aluno com a data e a observação abaixo. Para finalizar sem registrar peso, apague o campo.'
            : registrado
              ? 'Só preencha o peso se houver uma pesagem nova. Ele entra no registro do aluno com a data e a observação abaixo.'
              : 'O peso opcional entra no registro do aluno com a data e a observação abaixo.'}
      </Texto>
      <CampoData rotulo="Data do peso" regra="REGISTRO" valor={data} aoMudar={setData} />
      <CampoNumerico rotulo="Peso (opcional)" sufixo="kg" valor={peso} aoMudar={setPeso} aoDigitar={marcarMexida} />
      {jaRegistrado && sugerido !== null ? (
        <Texto variante="suave" numerico>{notaDoPesoJaRegistrado(sugerido, sugestaoDaPasta?.data ?? null, hoje)}</Texto>
      ) : comSugestao ? <Alerta tom="atencao" texto={notaDoPesoSugerido(sugestaoDaPasta?.data ?? null)} /> : null}
      {substitui && registrado ? (
        <Alerta tom="atencao" titulo="Vai substituir o peso da atualização"
          texto={`Já há ${numeroParaTela(registrado.pesoKg, 1)} kg registrado em ${dataParaTela(registrado.data)}. Um peso por dia: finalizar com esta data troca esse peso pelo novo. Para manter os dois, use outra data.`} />
      ) : null}
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} ajuda="Só é gravada junto com o peso. Só a equipe vê esta observação." />
      </Permitido>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  fimManual: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  data: { flex: 1, minWidth: 190 },
  resumo: { gap: espaco(0.75) },
  passos: { gap: espaco(0.5) },
  passo: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  numeroDoPasso: { fontFamily: fontes.semi, minWidth: 20 },
  textoDoPasso: { flex: 1 },
  linhaAtualizacao: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.75), marginTop: espaco(0.5) },
  linha: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linhaToque: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE + espaco(1),
    padding: espaco(1.5),
  },
  acoesDaLinha: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1.5) },
  icone: { width: 44, height: 44, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
  linhaTextos: { flex: 1, gap: 2 },
  linhaTitulo: { fontFamily: fontes.negrito, fontSize: 17, lineHeight: 23 },
});

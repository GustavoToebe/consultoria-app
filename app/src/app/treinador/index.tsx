import { router, useFocusEffect, type Href } from 'expo-router';
import { Lock, Pencil, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { aniversariantesDosAlunos, configuracaoInscricao } from '../../api/rotas';
import type { ContagensInscricoes } from '../../api/inscricoesTipos';
import type { PainelTreinador, RecordesDaSemana, TrocasPendentes } from '../../api/tipos';
import { aniversariantesDosProximosDias } from '../../dominio/aniversariosDosAlunos';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import { estadoDaFonte, resumoDoInicio, type DestinoDoInicio } from '../../dominio/inicioTreinador';
import {
  blocosPermitidos,
  blocosVisiveis,
  consultasDoBloco,
  fonteDaConsulta,
  folhaPastasARenovar,
  folhaRecordes,
  folhaSemRegistro,
  folhaTrocas,
  FONTE_CARREGANDO,
  FRASE_INICIO_SEM_ALUNOS,
  FRASE_NENHUM_BLOCO,
  hojeEmBrasilia,
  inicioSemAlunos,
  listaDaFolha,
  montarBloco,
  motivoDoEditar,
  ressalvaUmaVez,
  type BlocoDoPainelId,
  type ConsultaDoPainel,
  type ContextoDoPainel,
  type Fonte,
  type FolhaDoPainelId,
  type OpcoesDoBloco,
  type PainelDoInicioPreferido,
} from '../../dominio/painelDoInicio';
import { OPCOES_DIAS_SEM_REGISTRO } from '../../dominio/preferencias';
import {
  AVISO_DISPENSADO,
  CONFIRMACAO_DE_DISPENSAR,
  conferir,
  deixarLinkParaDepois,
  desfazerLinkParaDepois,
  dispensar,
  fecharConcluidos,
  montarPrimeirosPassos,
  oQueMostrarNoInicio,
  type IdConferivel,
  type ItemDosPrimeirosPassos,
} from '../../dominio/primeirosPassos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { BlocoAniversarios } from '../../treinador/painel/BlocoAniversarios';
import { BlocoDoPainel } from '../../treinador/painel/BlocoDoPainel';
import { LinhaDeBlocos } from '../../treinador/painel/FaixaDoPainel';
import { PrimeirosPassosAberto, PrimeirosPassosConcluidos, type AcaoGuardada } from '../../treinador/painel/BlocoPrimeirosPassos';
import { BarraDaEdicao, focarDepois, GradeEmEdicao, ID_DO_EDITAR, ID_DO_RESTAURAR } from '../../treinador/painel/EditarPainel';
import { FolhaDoPainel } from '../../treinador/painel/FolhaDoPainel';
import { colunasDaGrade, linhasDaGrade } from '../../treinador/painel/grade';
import { ProximoPasso, type ProximoPassoDaTela } from '../../treinador/painel/ProximoPasso';
import { useFontesDoPainel } from '../../treinador/painel/useFontesDoPainel';
import { usePrimeirosPassosGuardados } from '../../treinador/painel/usePrimeirosPassosGuardados';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, Vazio } from '../../ui/Estados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Permitido } from '../../ui/Permitido';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Próximo passo da consultoria ainda sem alunos (o `inicioTreinador` não fala disso: só conta pendências). */
const PASSO_SEM_ALUNOS = { texto: 'Nenhum aluno ainda. Cadastre o primeiro para começar.', acao: 'Cadastrar aluno' };

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ehNumero = (v: unknown): v is number => numero(v) !== null;
const dadosDe = <T,>(f: Fonte<T>): T | null => (f.situacao === 'pronta' ? f.dados : null);

/**
 * Usuários cuja consultoria estava sem alunos na última resposta do painel. Na web o Início é desmontado ao abrir outra
 * tela, e a volta (do "Cadastrar aluno", por exemplo) não deve buscar de novo os blocos que não aparecem. Se a consultoria
 * ganhou alunos nesse meio-tempo, os blocos saem logo depois da resposta do painel.
 */
const SEM_ALUNOS_DA_ULTIMA_VEZ = new Set<string>();

/**
 * Início do treinador (passos 8 e 9 de `docs/planos/atualizacao-visual-app-full.md`, D7 a D9): os Primeiros passos no
 * topo enquanto abertos (fora do "Editar"), ou o Próximo passo; embaixo o painel em blocos, em grade de até 4 colunas
 * (1 no celular), cada bloco com o próprio Todos/Meus, atualizar e abrir. Só contagens nos blocos; as listas com nomes
 * abrem numa `Folha`. As regras moram em `dominio/painelDoInicio.ts` e `dominio/primeirosPassos.ts`.
 */
export default function InicioTreinador() {
  const { usuario, perfilEquipe, pode, pagamentosHabilitados, retornoHabilitado, marca, offline } = useSessao();
  const { preferencias, preferenciasLidas, escolherPreferencia, fatorTexto } = useTema();
  const unidade = useUnidadeDeCarga();
  const ctx: ContextoDoPainel = useMemo(() => ({ pode, pagamentosHabilitados, retornoHabilitado }), [pode, pagamentosHabilitados, retornoHabilitado]);
  const administrador = !!perfilEquipe?.acessoTotal;
  // Padrão do Todos/Meus, como no Início antigo: quem tem acesso total vê todos; o membro, os seus. A escolha de cada
  // bloco fica nas preferências do aparelho (`painelDoInicio.meus`), junto da ordem do "Editar".
  const padraoMeus = !administrador;
  const pref = preferencias.painelDoInicio;
  const meusDe = useCallback((id: BlocoDoPainelId) => pref.meus[id] ?? padraoMeus, [pref.meus, padraoMeus]);
  const dias = preferencias.diasSemRegistro;
  const usuarioId = usuario?.id ?? null;
  const hoje = hojeEmBrasilia();
  const opcoes = useCallback((id: BlocoDoPainelId): OpcoesDoBloco => ({ meus: meusDe(id), dias, graficos: preferencias.graficos, hoje, usuarioId }),
    [meusDe, dias, preferencias.graficos, hoje, usuarioId]);
  const permitidos = blocosPermitidos(ctx, pref);
  const visiveis = blocosVisiveis(ctx, pref);
  const verPainel = pode('PAINEL_VER');

  // ---- Primeiros passos: o que ficou guardado no aparelho e a configuração do link ----
  const guardados = usePrimeirosPassosGuardados(usuarioId);
  const comPrimeirosPassos = guardados.estado !== null && !guardados.estado.dispensado;
  const verLink = pode('INSCRICAO_ALTERAR');
  const config = useCarregar(comPrimeirosPassos && verLink ? 'inicio:link-de-inscricao' : null, () => configuracaoInscricao());

  // ---- Consultas: as dos blocos visíveis, o painel de Todos (Início sem alunos e Primeiros passos) e as do Próximo passo ----
  const painelTodos: ConsultaDoPainel = useMemo(() => ({ fonte: 'painel', meus: false, dias }), [dias]);
  const painelPadrao: ConsultaDoPainel = useMemo(() => ({ fonte: 'painel', meus: padraoMeus, dias }), [padraoMeus, dias]);
  const interessadosPadrao: ConsultaDoPainel = useMemo(() => ({ fonte: 'interessados', meus: padraoMeus }), [padraoMeus]);
  const verInteressados = pode('INSCRICAO_LER');
  const trocasPadrao: ConsultaDoPainel = useMemo(() => ({ fonte: 'trocas', meus: padraoMeus }), [padraoMeus]);
  const verTrocas = verPainel && pode('REGISTRO_LER');
  const porBloco = useMemo(() => new Map(visiveis.map((id) => [id, consultasDoBloco(id, ctx, opcoes(id))])), [visiveis, ctx, opcoes]);
  // Consultoria que já se sabe sem alunos (última resposta do painel de Todos): os blocos não aparecem, então as consultas
  // deles não saem. Sem essa resposta saem junto com o painel, para o Início comum não esperar uma volta a mais. Antes de ler
  // as preferências do aparelho a lista de visíveis é a de fábrica: esperar a leitura evita buscar o bloco que a pessoa ocultou.
  const [semAlunosSabido, setSemAlunosSabido] = useState(() => !!usuarioId && SEM_ALUNOS_DA_ULTIMA_VEZ.has(usuarioId));
  const consultas = useMemo(() => [
    ...(verPainel ? [painelTodos, painelPadrao] : []),
    ...(verInteressados ? [interessadosPadrao] : []),
    ...(verTrocas ? [trocasPadrao] : []),
    ...(semAlunosSabido || !preferenciasLidas ? [] : [...porBloco.values()].flat()),
  ], [verPainel, painelTodos, painelPadrao, verInteressados, interessadosPadrao, verTrocas, trocasPadrao, porBloco, semAlunosSabido, preferenciasLidas]);
  const { fonte, dadosDeOutraChave, fontesDe, recarregar } = useFontesDoPainel(consultas);

  // ---- Aniversários (só com ALUNO_LER): nome e dia/mês dos próximos dias; falha ou lista vazia = o cartão não aparece ----
  const diasAniversario = preferencias.diasAniversario;
  const carregarAniversarios = useCarregar(pode('ALUNO_LER') && preferenciasLidas ? `inicio:aniversarios:${diasAniversario}:${padraoMeus}` : null, () => aniversariantesDosAlunos(diasAniversario, padraoMeus));
  const recarregarAniversarios = carregarAniversarios.recarregar;
  const aniversariantes = useMemo(
    () => aniversariantesDosProximosDias(carregarAniversarios.dados ?? [], hoje, diasAniversario),
    [carregarAniversarios.dados, hoje, diasAniversario],
  );

  // Ao voltar para a tela (não na primeira vez), recarrega tudo e relê o aparelho: cadastrou o aluno ou ligou o link e voltou.
  const consultasAtuais = useRef(consultas);
  useEffect(() => {
    consultasAtuais.current = consultas;
  });
  const primeiroFoco = useRef(true);
  const recarregarConfig = config.recarregar;
  const releer = guardados.releer;
  const recarregarTudo = useCallback(() => {
    recarregar(consultasAtuais.current);
    recarregarConfig();
    recarregarAniversarios();
    releer();
  }, [recarregar, recarregarConfig, recarregarAniversarios, releer]);
  useFocusEffect(useCallback(() => {
    if (primeiroFoco.current) {
      primeiroFoco.current = false;
      return;
    }
    recarregarTudo();
  }, [recarregarTudo]));

  const fonteTodos = fonte<PainelTreinador>(painelTodos);
  const dadosTodos = dadosDe(fonteTodos);
  const semAlunos = inicioSemAlunos(dadosTodos);
  // Ajuste durante o render (padrão do React para estado derivado de outro): só com dado, então a recarga não pisca.
  if (dadosTodos && semAlunos !== semAlunosSabido) setSemAlunosSabido(semAlunos);
  // Painel de Todos falhou com a consultoria lembrada sem alunos: as consultas dos blocos voltam a sair, senão os blocos
  // ficariam em "carregando" para sempre (a vaga deles nunca ligaria) e o Atualizar não buscaria nada.
  if (!dadosTodos && fonteTodos.situacao === 'falhou' && semAlunosSabido) setSemAlunosSabido(false);
  useEffect(() => {
    if (!usuarioId || !dadosTodos) return;
    if (semAlunos) SEM_ALUNOS_DA_ULTIMA_VEZ.add(usuarioId);
    else SEM_ALUNOS_DA_ULTIMA_VEZ.delete(usuarioId);
  }, [usuarioId, dadosTodos, semAlunos]);
  const fontePadrao = fonte<PainelTreinador>(painelPadrao);
  const padrao = dadosDe(fontePadrao);
  const interessados = verInteressados ? dadosDe(fonte<ContagensInscricoes>(interessadosPadrao)) : null;
  const fonteTrocas = fonte<TrocasPendentes>(trocasPadrao);
  const trocas = verTrocas ? dadosDe(fonteTrocas) : null;

  // ---- Folhas e Editar ----
  const [folhaAberta, setFolhaAberta] = useState<{ id: FolhaDoPainelId; meus: boolean } | null>(null);
  // Modo de edição: o rascunho do painel e a última mudança (o rodapé a mostra). `null` = fora da edição.
  const [edicao, setEdicao] = useState<{ rascunho: PainelDoInicioPreferido; mensagem: string | null } | null>(null);
  const editando = edicao !== null;
  const [confirmarDispensa, setConfirmarDispensa] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // ---- Próximo passo (as mesmas pendências e permissões do Início antigo, no escopo padrão) ----
  const irPara = (destino: DestinoDoInicio) => {
    if (destino === 'TROCAS') return setFolhaAberta({ id: 'trocas', meus: padraoMeus });
    if (!padrao) return;
    if (destino === 'PARA_REVISAR' || destino === 'ATRASADAS') router.push(caminhoListaAtualizacoes(destino, padraoMeus));
    else if (destino === 'INTERESSADOS') router.push((padraoMeus ? '/treinador/interessados?situacao=NOVA&meus=true' : '/treinador/interessados?situacao=NOVA') as Href);
    else if (destino === 'RETORNOS') router.push((padraoMeus ? '/treinador/interessados?retornos=ATE_HOJE&meus=true' : '/treinador/interessados?retornos=ATE_HOJE') as Href);
    else if (destino === 'PLANOS_TERMINANDO' && padrao.planosTerminando[0]) router.push(`/treinador/alunos/${padrao.planosTerminando[0].aluno.id}`);
    else if (destino === 'SEM_REGISTRO') setFolhaAberta({ id: 'semRegistro', meus: padraoMeus });
  };
  const verAtualizacoes = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  let proximo: ProximoPassoDaTela | null = null;
  if (semAlunos && pode('ALUNO_ALTERAR')) {
    proximo = { texto: PASSO_SEM_ALUNOS.texto, acao: { rotulo: PASSO_SEM_ALUNOS.acao, aoTocar: () => router.push('/treinador/alunos/novo') } };
  } else {
    // D9: "em dia" só com todas as fontes consultadas com sucesso (cada uma diz se faltou acesso, falhou ou carrega).
    const sitPadrao = fontePadrao.situacao;
    const lido = !!padrao;
    const r = resumoDoInicio({
      paraRevisar: verAtualizacoes && lido ? padrao.atualizacoesParaRevisar : null,
      atrasadas: verAtualizacoes && lido ? padrao.atualizacoesAtrasadas : null,
      interessadosNovos: interessados ? numero(interessados.porSituacao?.NOVA) : null,
      retornosAtrasados: interessados?.retornosAtrasados ?? null,
      retornosHoje: interessados?.retornosHoje ?? null,
      planosTerminando: lido && pode('TREINO_LER') ? padrao.planosTerminando?.length ?? null : null,
      // O total sem o teto de 20, o mesmo número do cartão e da Folha.
      semRegistro: lido && pode('REGISTRO_LER') ? padrao.alunosSemRegistroTotal ?? null : null,
      diasSemRegistro: dias,
      trocas: trocas?.total ?? null,
    }, {
      atualizacoes: estadoDaFonte(verPainel && verAtualizacoes, sitPadrao, lido && ehNumero(padrao.atualizacoesParaRevisar) && ehNumero(padrao.atualizacoesAtrasadas)),
      interessados: estadoDaFonte(verInteressados, fonte<ContagensInscricoes>(interessadosPadrao).situacao,
        !!interessados && ehNumero(interessados.retornosAtrasados) && ehNumero(interessados.retornosHoje) && ehNumero(interessados.porSituacao?.NOVA)),
      planosTerminando: estadoDaFonte(verPainel && pode('TREINO_LER'), sitPadrao, lido && Array.isArray(padrao.planosTerminando)),
      semRegistro: estadoDaFonte(verPainel && pode('REGISTRO_LER'), sitPadrao, lido && ehNumero(padrao.alunosSemRegistroTotal)),
      trocas: estadoDaFonte(verTrocas, fonteTrocas.situacao, !!trocas && ehNumero(trocas.total)),
    });
    if (r.tipo === 'pendencia') {
      const p = r.passo;
      // Atraso em `perigo`, como o indicador: os retornos só são atraso quando os atrasados vêm antes dos de hoje.
      const atraso = p.destino === 'ATRASADAS' || (p.destino === 'RETORNOS' && !!interessados?.retornosAtrasados);
      proximo = { texto: p.texto, acao: { rotulo: p.acao, aoTocar: () => irPara(p.destino) }, atraso, aviso: r.aviso };
    } else if (r.tipo !== 'carregando') {
      proximo = { texto: r.texto, acao: r.tipo === 'parcial' && r.tentarDeNovo ? { rotulo: 'Tentar de novo', aoTocar: () => recarregar(consultas) } : null };
    }
  }

  // ---- Primeiros passos montados (espera o aparelho e as consultas, para não piscar) ----
  const fonteConfig = fonteDaConsulta(config);
  const prontoPainel = !verPainel || fonteTodos.situacao !== 'carregando';
  const prontoConfig = !verLink || fonteConfig.situacao !== 'carregando';
  const estado = guardados.estado;
  const passos = estado && (estado.dispensado || (prontoPainel && prontoConfig)) ? montarPrimeirosPassos({
    pode, administrador, estado,
    temLogo: marca ? !!marca.logoUrl : null,
    alunosAtivos: numero(dadosTodos?.alunosAtivos),
    alunosSemAcesso: numero(dadosTodos?.alunosSemAcesso),
    alunosInativos: numero(dadosTodos?.alunosInativos),
    linkAberto: fonteConfig.situacao === 'pronta' && typeof fonteConfig.dados?.aberta === 'boolean' ? fonteConfig.dados.aberta : null,
  }) : null;
  const topo = oQueMostrarNoInicio(passos, proximo);

  const gravar = guardados.gravar;
  const aoAcao = (item: ItemDosPrimeirosPassos, acao: AcaoGuardada) => {
    setAviso(null);
    if (acao === 'conferido') gravar((e) => conferir(e, item.id as IdConferivel));
    else if (acao === 'agora_nao') gravar(deixarLinkParaDepois);
    else gravar(desfazerLinkParaDepois);
  };

  // ---- Grade ----
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const blocos = ressalvaUmaVez(visiveis
    .map((id) => montarBloco(id, ctx, { ...opcoes(id), fontes: fontesDe(porBloco.get(id) ?? []) }))
    .filter((b): b is NonNullable<typeof b> => b !== null));
  const porId = new Map(blocos.map((b) => [b.id, b]));
  const colunas = colunasDaGrade(largura, fatorTexto);
  const linhas = linhasDaGrade(blocos.map((b) => b.id), colunas, pref.tamanhos);
  const esperandoTodos = verPainel && fonteTodos.situacao === 'carregando';

  const folha = (() => {
    if (!folhaAberta) return null;
    const { id, meus } = folhaAberta;
    const paraAFolha = <T,>(c: ConsultaDoPainel): Fonte<T> => (dadosDeOutraChave(c) ? FONTE_CARREGANDO : fonte<T>(c));
    if (id === 'recordes') {
      const consulta = { fonte: 'recordes', meus } as const;
      return {
        titulo: 'Recordes dos últimos 7 dias',
        ...listaDaFolha(paraAFolha<RecordesDaSemana>(consulta), (r) =>
          Array.isArray(r.series) ? folhaRecordes(r, { meus, hoje, unidade }) : null),
      };
    }
    if (id === 'trocas') {
      return {
        titulo: 'Trocas para ver',
        ...listaDaFolha(paraAFolha<TrocasPendentes>({ fonte: 'trocas', meus }), (r) =>
          Array.isArray(r.trocas) ? folhaTrocas(r, { meus, hoje }) : null),
      };
    }
    const consultaPainel = { fonte: 'painel', meus, dias } as const;
    const fontePainel = paraAFolha<PainelTreinador>(consultaPainel);
    if (id === 'semRegistro') {
      return {
        titulo: `Sem registro há ${dias} dias`,
        ...listaDaFolha(fontePainel, (p) => (Array.isArray(p.alunosSemRegistro) ? folhaSemRegistro(p, { dias, meus, hoje }) : null)),
      };
    }
    return {
      titulo: 'A renovar em 7 dias',
      ...listaDaFolha(fontePainel, (p) => (Array.isArray(p.pastasParaRenovar) ? folhaPastasARenovar(p, { meus, hoje }) : null)),
    };
  })();

  const motivoEditar = motivoDoEditar(semAlunos);
  const acoes = (
    <>
      <Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Novo aluno" tipo="acao" Icone={Plus} aoTocar={() => router.push('/treinador/alunos/novo')} /></Permitido>
      {permitidos.length ? (
        <View nativeID={ID_DO_EDITAR}>
          <Botao rotulo="Editar" rotuloAcessivel="Editar os blocos do Início" tipo="secundario" Icone={Pencil}
            desabilitado={!!motivoEditar} motivo={motivoEditar}
            aoTocar={() => {
              setEdicao({ rascunho: pref, mensagem: null });
              focarDepois([ID_DO_RESTAURAR]);
            }} />
        </View>
      ) : null}
    </>
  );

  // Salvar com a mesma composição só fecha a edição; o rodapé diz se há algo por salvar.
  const alterado = !!edicao && JSON.stringify(edicao.rascunho) !== JSON.stringify(pref);
  const fecharEdicao = () => {
    setEdicao(null);
    focarDepois([ID_DO_EDITAR]);
  };

  return (
    <View style={estilos.raiz}>
      <Tela bordas={['top']} largura={LARGURA_LISTA}>
        <Cabecalho titulo="Início" mostrarMarca="celular"
          subtitulo={editando ? 'Editando os blocos: arraste, mude o tamanho, oculte ou adicione.' : `Olá, ${usuario?.nome ?? ''}. O que pede atenção na consultoria hoje.`}
          acoes={editando ? undefined : acoes} />

        {offline ? (
          <Alerta tom="atencao" titulo="Sem internet." texto="Os números podem estar desatualizados.">
            <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={recarregarTudo} />
          </Alerta>
        ) : null}
        {aviso ? <Alerta tom="sucesso" texto={aviso} /> : null}

        {!editando && topo.bloco === 'aberto' && passos ? (
          <PrimeirosPassosAberto passos={passos} aoAcao={aoAcao} aoDispensar={() => setConfirmarDispensa(true)} />
        ) : null}
        {!editando && topo.bloco === 'concluido' && passos ? (
          <PrimeirosPassosConcluidos passos={passos} aoAcao={aoAcao} aoFechar={() => gravar(fecharConcluidos)} />
        ) : null}
        {!editando && topo.proximoPasso ? <ProximoPasso passo={topo.proximoPasso} /> : null}
        {!editando && aniversariantes.length ? <BlocoAniversarios itens={aniversariantes} dias={diasAniversario} /> : null}

        <View onLayout={aoMedir} style={estilos.painel}>
          {edicao ? (
            <GradeEmEdicao ctx={ctx} rascunho={edicao.rascunho} colunas={colunas}
              aoMudar={(rascunho, mensagem) => setEdicao({ rascunho, mensagem })} />
          ) : !verPainel && permitidos.length === 0 ? (
            <Vazio Icone={Lock} titulo="Sem números para o seu perfil" texto="O seu perfil não vê os blocos do Início. Peça a um administrador da consultoria." />
          ) : esperandoTodos ? (
            <Esqueleto texto="Carregando o Início" cartoes={2} />
          ) : semAlunos ? (
            <Texto variante="suave">{FRASE_INICIO_SEM_ALUNOS}</Texto>
          ) : blocos.length === 0 ? (
            <Texto variante="suave">{FRASE_NENHUM_BLOCO}</Texto>
          ) : (
            linhas.map((linha) => (
              <LinhaDeBlocos key={linha.map((c) => c.id).join(':')} style={estilos.linha}>
                {linha.map((c) => {
                  const bloco = porId.get(c.id);
                  if (!bloco) return null;
                  return (
                    <BlocoDoPainel key={c.id} bloco={bloco} style={{ flex: c.colunas, flexBasis: 0 }}
                      aoAtualizar={() => recarregar(porBloco.get(c.id) ?? [])}
                      aoAlternarFiltro={() => escolherPreferencia({ painelDoInicio: { ...pref, meus: { ...pref.meus, [c.id]: !meusDe(c.id) } } })}
                      aoAbrirFolha={(id) => setFolhaAberta({ id, meus: bloco.meus })} />
                  );
                })}
              </LinhaDeBlocos>
            ))
          )}
        </View>

        {folhaAberta && folha ? (
          <FolhaDoPainel titulo={folha.titulo} situacao={folha.situacao} folha={folha.dados} aoFechar={() => setFolhaAberta(null)}
            topo={folhaAberta.id === 'semRegistro' ? (
              <Escolha descricao="Dias sem registro" opcoes={OPCOES_DIAS_SEM_REGISTRO.map((n) => ({ valor: n, rotulo: `${n} dias` }))} valor={dias}
                aoMudar={(n) => escolherPreferencia({ diasSemRegistro: n })} />
            ) : null} />
        ) : null}
        <PainelConfirmacao visivel={confirmarDispensa} titulo={CONFIRMACAO_DE_DISPENSAR.titulo} mensagem={CONFIRMACAO_DE_DISPENSAR.texto}
          rotuloConfirmar={CONFIRMACAO_DE_DISPENSAR.confirmar} rotuloCancelar={CONFIRMACAO_DE_DISPENSAR.cancelar}
          aoCancelar={() => setConfirmarDispensa(false)}
          aoConfirmar={() => {
            setConfirmarDispensa(false);
            gravar(dispensar);
            setAviso(AVISO_DISPENSADO);
          }} />
      </Tela>
      {edicao ? (
        <BarraDaEdicao mensagem={edicao.mensagem} alterado={alterado} aoCancelar={fecharEdicao}
          aoSalvar={() => {
            if (alterado) escolherPreferencia({ painelDoInicio: edicao.rascunho });
            fecharEdicao();
          }} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  painel: { gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(2), alignItems: 'flex-start' },
});

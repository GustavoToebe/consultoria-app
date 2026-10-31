import { router, useFocusEffect, type Href } from 'expo-router';
import { Lock, Pencil, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { configuracaoInscricao } from '../../api/rotas';
import type { ContagensInscricoes } from '../../api/inscricoesTipos';
import type { PainelTreinador, RecordesDaSemana } from '../../api/tipos';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import { proximoPassoDoInicio, type DestinoDoInicio } from '../../dominio/inicioTreinador';
import {
  blocosPermitidos,
  blocosVisiveis,
  consultasDoBloco,
  fonteDaConsulta,
  folhaPastasARenovar,
  folhaRecordes,
  folhaSemRegistro,
  FRASE_INICIO_SEM_ALUNOS,
  FRASE_NENHUM_BLOCO,
  hojeEmBrasilia,
  inicioSemAlunos,
  montarBloco,
  MOTIVO_EDITAR_SEM_ALUNOS,
  type BlocoDoPainelId,
  type ConsultaDoPainel,
  type ContextoDoPainel,
  type Fonte,
  type FolhaDoPainelId,
  type OpcoesDoBloco,
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
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { BlocoDoPainel } from '../../treinador/painel/BlocoDoPainel';
import { LinhaDeBlocos } from '../../treinador/painel/FaixaDoPainel';
import { PrimeirosPassosAberto, PrimeirosPassosConcluidos, type AcaoGuardada } from '../../treinador/painel/BlocoPrimeirosPassos';
import { EditarPainel } from '../../treinador/painel/EditarPainel';
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
const TUDO_EM_DIA = 'Tudo em dia por aqui. Nada pede sua atenção agora.';
const MOTIVO_SEM_INTERNET = 'Precisa de internet.';

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const dadosDe = <T,>(f: Fonte<T>): T | null => (f.situacao === 'pronta' ? f.dados : null);

/**
 * Início do treinador (passos 8 e 9 de `docs/planos/atualizacao-visual-app-full.md`, D7 a D9): os Primeiros passos no
 * topo enquanto abertos (fora do "Editar"), ou o Próximo passo; embaixo o painel em blocos, em grade de até 4 colunas
 * (1 no celular), cada bloco com o próprio Todos/Meus, atualizar e abrir. Só contagens nos blocos; as listas com nomes
 * abrem numa `Folha`. As regras moram em `dominio/painelDoInicio.ts` e `dominio/primeirosPassos.ts`.
 */
export default function InicioTreinador() {
  const { usuario, perfilEquipe, pode, pagamentosHabilitados, retornoHabilitado, marca, offline } = useSessao();
  const { preferencias, escolherPreferencia } = useTema();
  const ctx: ContextoDoPainel = useMemo(() => ({ pode, pagamentosHabilitados, retornoHabilitado }), [pode, pagamentosHabilitados, retornoHabilitado]);
  const administrador = !!perfilEquipe?.acessoTotal;
  // Padrão do Todos/Meus, como no Início antigo: quem tem acesso total vê todos; o membro, os seus. Só em memória.
  const padraoMeus = !administrador;
  const [filtros, setFiltros] = useState<Partial<Record<BlocoDoPainelId, boolean>>>({});
  const meusDe = useCallback((id: BlocoDoPainelId) => filtros[id] ?? padraoMeus, [filtros, padraoMeus]);
  const dias = preferencias.diasSemRegistro;
  const pref = preferencias.painelDoInicio;
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
  const porBloco = useMemo(() => new Map(visiveis.map((id) => [id, consultasDoBloco(id, ctx, opcoes(id))])), [visiveis, ctx, opcoes]);
  const consultas = useMemo(() => [
    ...(verPainel ? [painelTodos, painelPadrao] : []),
    ...(verInteressados ? [interessadosPadrao] : []),
    ...[...porBloco.values()].flat(),
  ], [verPainel, painelTodos, painelPadrao, verInteressados, interessadosPadrao, porBloco]);
  const { fonte, fontesDe, recarregar } = useFontesDoPainel(consultas);

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
    releer();
  }, [recarregar, recarregarConfig, releer]);
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
  const fontePadrao = fonte<PainelTreinador>(painelPadrao);
  const padrao = dadosDe(fontePadrao);
  const interessados = verInteressados ? dadosDe(fonte<ContagensInscricoes>(interessadosPadrao)) : null;

  // ---- Folhas e Editar ----
  const [folhaAberta, setFolhaAberta] = useState<{ id: FolhaDoPainelId; meus: boolean } | null>(null);
  const [editando, setEditando] = useState(false);
  const [confirmarDispensa, setConfirmarDispensa] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // ---- Próximo passo (as mesmas pendências e permissões do Início antigo, no escopo padrão) ----
  const irPara = (destino: DestinoDoInicio) => {
    if (!padrao) return;
    if (destino === 'PARA_REVISAR' || destino === 'ATRASADAS') router.push(caminhoListaAtualizacoes(destino, padraoMeus));
    else if (destino === 'INTERESSADOS') router.push((padraoMeus ? '/treinador/interessados?situacao=NOVA&meus=true' : '/treinador/interessados?situacao=NOVA') as Href);
    else if (destino === 'RETORNOS') router.push((padraoMeus ? '/treinador/interessados?meus=true' : '/treinador/interessados') as Href);
    else if (destino === 'PLANOS_TERMINANDO' && padrao.planosTerminando[0]) router.push(`/treinador/alunos/${padrao.planosTerminando[0].aluno.id}`);
    else if (destino === 'SEM_REGISTRO') setFolhaAberta({ id: 'semRegistro', meus: padraoMeus });
  };
  const verAtualizacoes = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  let proximo: ProximoPassoDaTela | null = null;
  if (semAlunos && pode('ALUNO_ALTERAR')) {
    proximo = { texto: PASSO_SEM_ALUNOS.texto, acao: { rotulo: PASSO_SEM_ALUNOS.acao, aoTocar: () => router.push('/treinador/alunos/novo') } };
  } else if (padrao) {
    const p = proximoPassoDoInicio({
      paraRevisar: verAtualizacoes ? padrao.atualizacoesParaRevisar : null,
      atrasadas: verAtualizacoes ? padrao.atualizacoesAtrasadas : null,
      interessadosNovos: interessados ? interessados.porSituacao?.NOVA ?? 0 : null,
      retornosAtrasados: interessados?.retornosAtrasados ?? null,
      retornosHoje: interessados?.retornosHoje ?? null,
      planosTerminando: pode('TREINO_LER') ? padrao.planosTerminando?.length ?? null : null,
      // O total sem o teto de 20, o mesmo número do cartão e da Folha.
      semRegistro: pode('REGISTRO_LER') ? padrao.alunosSemRegistroTotal ?? null : null,
      diasSemRegistro: dias,
    });
    proximo = p ? { texto: p.texto, acao: { rotulo: p.acao, aoTocar: () => irPara(p.destino) } } : { texto: TUDO_EM_DIA, acao: null };
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
  const blocos = visiveis
    .map((id) => montarBloco(id, ctx, { ...opcoes(id), fontes: fontesDe(porBloco.get(id) ?? []) }))
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const porId = new Map(blocos.map((b) => [b.id, b]));
  const linhas = linhasDaGrade(blocos.map((b) => b.id), colunasDaGrade(largura));
  const esperandoTodos = verPainel && fonteTodos.situacao === 'carregando';

  const folha = (() => {
    if (!folhaAberta) return null;
    const { id, meus } = folhaAberta;
    if (id === 'recordes') {
      const r = dadosDe(fonte<RecordesDaSemana>({ fonte: 'recordes', meus }));
      return { titulo: 'Recordes dos últimos 7 dias', dados: r && Array.isArray(r.series) ? folhaRecordes(r, { meus, hoje }) : null };
    }
    const p = dadosDe(fonte<PainelTreinador>({ fonte: 'painel', meus, dias }));
    if (id === 'semRegistro') return { titulo: `Sem registro há ${dias} dias`, dados: p && Array.isArray(p.alunosSemRegistro) ? folhaSemRegistro(p, { dias, meus, hoje }) : null };
    return { titulo: 'A renovar em 7 dias', dados: p && Array.isArray(p.pastasParaRenovar) ? folhaPastasARenovar(p, { meus, hoje }) : null };
  })();

  const motivoEditar = semAlunos ? MOTIVO_EDITAR_SEM_ALUNOS : offline ? MOTIVO_SEM_INTERNET : undefined;
  const acoes = (
    <>
      <Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Novo aluno" tipo="secundario" Icone={Plus} aoTocar={() => router.push('/treinador/alunos/novo')} /></Permitido>
      {permitidos.length ? (
        <Botao rotulo="Editar" rotuloAcessivel="Editar os blocos do Início" tipo="secundario" Icone={Pencil}
          desabilitado={!!motivoEditar} motivo={motivoEditar} aoTocar={() => setEditando(true)} />
      ) : null}
    </>
  );

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Início" subtitulo={`Olá, ${usuario?.nome ?? ''}. O que pede atenção na consultoria hoje.`} mostrarMarca="celular" acoes={acoes} />

      {offline ? (
        <Alerta tom="atencao" titulo="Sem internet." texto="Os números podem estar desatualizados.">
          <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={recarregarTudo} />
        </Alerta>
      ) : null}
      {aviso ? <Alerta tom="sucesso" texto={aviso} /> : null}

      {topo.bloco === 'aberto' && passos ? (
        <PrimeirosPassosAberto passos={passos} aoAcao={aoAcao} aoDispensar={() => setConfirmarDispensa(true)} />
      ) : null}
      {topo.bloco === 'concluido' && passos ? (
        <PrimeirosPassosConcluidos passos={passos} aoAcao={aoAcao} aoFechar={() => gravar(fecharConcluidos)} />
      ) : null}
      {topo.proximoPasso ? <ProximoPasso passo={topo.proximoPasso} /> : null}

      <View onLayout={aoMedir} style={estilos.painel}>
        {!verPainel && permitidos.length === 0 ? (
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
                    aoAlternarFiltro={() => setFiltros((f) => ({ ...f, [c.id]: !(f[c.id] ?? padraoMeus) }))}
                    aoAbrirFolha={(id) => setFolhaAberta({ id, meus: bloco.meus })} />
                );
              })}
            </LinhaDeBlocos>
          ))
        )}
      </View>

      {folhaAberta && folha ? (
        <FolhaDoPainel titulo={folha.titulo} folha={folha.dados} aoFechar={() => setFolhaAberta(null)}
          topo={folhaAberta.id === 'semRegistro' ? (
            <Escolha descricao="Dias sem registro" opcoes={OPCOES_DIAS_SEM_REGISTRO.map((n) => ({ valor: n, rotulo: `${n} dias` }))} valor={dias}
              aoMudar={(n) => escolherPreferencia({ diasSemRegistro: n })} />
          ) : null} />
      ) : null}
      {editando ? (
        <EditarPainel ctx={ctx} inicial={pref} aoFechar={() => setEditando(false)}
          aoConcluir={(novo) => {
            escolherPreferencia({ painelDoInicio: novo });
            setEditando(false);
          }} />
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
  );
}

const estilos = StyleSheet.create({
  painel: { gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(2), alignItems: 'stretch' },
});

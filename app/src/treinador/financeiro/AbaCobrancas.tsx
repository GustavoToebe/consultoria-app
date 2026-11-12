import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse } from '../../api/financeiroTipos';
import { listarCobrancas, listarPlanosComerciais } from '../../api/rotas';
import {
  alternarNoLote, atrasoParaTela, contagemDoLote, cpfMascarado, ehPagamentoOnline, emissaoDaCobranca, estadoDaPaginaNoLote,
  hojeEmBrasilia, idCurtoDaCobranca, marcarPaginaNoLote, opcoesDePlanoDoFiltro, podeEntrarNoLote, problemaDoLote, resumoDaCobranca,
  ROTULO_ONLINE, rotuloDaForma, seloDaCobranca, temBaixaRegistrada,
} from '../../dominio/financeiro';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  CHAVES_DE_COBRANCAS, chaveDasCobrancas, chipsDasCobrancas, cobrancasParaApi, cobrancasParaEndereco, descricaoDasCobrancas,
  FORMAS_DO_FILTRO, lerCobrancasDoEndereco, SEM_FILTROS_DE_COBRANCAS, semOFiltroDeCobrancas, SITUACOES_DO_FILTRO, temVencimento,
  textoDoVencimento, type ChaveDoFiltroDeCobrancas, type FiltrosDeCobrancas, type FormaDoFiltro, type SituacaoDoFiltro,
} from '../../dominio/filtrosDoFinanceiro';
import { centavosParaTela, dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { OPCOES_RESPONSABILIDADE } from '../EscolhaResponsabilidade';
import { UmaOpcao } from '../SeletoresDeFiltro';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CaixaDaLinha } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CartaoDeConferencias } from './CartaoDeConferencias';
import { FiltrosEmGrade, PeriodoDoFiltro } from './FiltrosEmGrade';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { FolhaDoLote } from './FolhaDoLote';
import { ListaOuTabela } from './ListaOuTabela';

const TAMANHO_PAGINA = 50;

/**
 * Abaixo desta largura (da própria tabela) as cobranças viram cartões. As colunas de data, valor e situação têm largura
 * fixa (nunca cortam dinheiro nem data); o aluno fica com o resto, no mínimo uns 130 px. Em 1280 px com o menu aberto a
 * tabela mede uns 955 px e cabe.
 */
const LARGURA_DA_TABELA = 940;

/** As três datas lado a lado a partir de 1100 px (medidos na grade), duas a partir de 700, uma abaixo disso. */
const colunasDasDatas = (largura: number) => (largura >= 1100 ? 3 : largura >= 700 ? 2 : 1);

const dataOuNada = (iso: string | null | undefined) => (iso ? dataParaTela(iso) : SEM_DADO);

/**
 * Cobranças dos alunos, por vencimento. "Vencidas" é só um filtro (a API decide pela data de Brasília); "Em aberto"
 * inclui as vencidas. Tocar na linha abre a cobrança, com Registrar pagamento, Desfazer e Cancelar para quem pode alterar.
 * No topo, com o recebimento online ligado, "Pagamentos para conferir" (só aparece quando há algum). Cobrança paga pelo
 * provedor leva o selo "Online". Na barra de filtros (`docs/planos/filtros-nas-listas.md`, D7 e lote 2): a busca pelo
 * nome do aluno (na API, 300 ms depois de digitar) e, no painel, numa grade alinhada (P2): responsável, situações
 * (várias), plano e forma da baixa; embaixo, as datas: vencimento (próximos 7 dias ou um período), emissão e pagamento.
 * Tudo no endereço junto do `?aba=cobrancas` (`?meus=true&situacao=ABERTA,PAGA&vencimento=PROXIMOS_7_DIAS` ou `&de=&ate=`,
 * `&emissaoDe=&emissaoAte=&pagoDe=&pagoAte=&planoId=&forma=`), como os mini-cartões do Início abrem. Um aluno só chega pelo
 * endereço (`&alunoId=`, o "Ver no Financeiro" da ficha) e sai pelo ✕ do chip. Valor desconhecido no endereço é ignorado.
 *
 * Com `FINANCEIRO_ALTERAR`, cada cobrança em aberto (vencida incluída) tem a caixa de marcar ao lado da linha (fora do
 * toque que a abre) e a barra do lote conta as marcadas, seleciona as da página e abre a revisão obrigatória
 * (`FolhaDoLote`). Trocar de página mantém a seleção; mudar um filtro ou a busca a limpa, com aviso.
 */
export function AbaCobrancas({ podeAlterar }: { podeAlterar: boolean }) {
  const { pode, recebimentoOnlineHabilitado } = useSessao();
  const { avisar } = useAviso();
  const parametros = useLocalSearchParams<{
    situacao?: string; meus?: string; vencimento?: string; de?: string; ate?: string; alunoId?: string; planoId?: string; forma?: string;
    emissaoDe?: string; emissaoAte?: string; pagoDe?: string; pagoAte?: string;
  }>();
  const filtros = lerCobrancasDoEndereco(parametros);
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<CobrancaResponse | null>(null);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [selecao, setSelecao] = useState<CobrancaResponse[]>([]);
  // A revisão tem estado próprio: com sucesso total a seleção esvazia, e o resultado precisa continuar na tela.
  const [revisando, setRevisando] = useState(false);
  const busca = useAtrasado(buscaDigitada.trim(), 300);
  const hoje = hojeEmBrasilia();
  const lista = useCarregar(`cobrancas|${chaveDasCobrancas(filtros, busca)}|${hoje}|${pagina}`, () =>
    listarCobrancas({ ...cobrancasParaApi(filtros, hoje), busca: busca || undefined, pagina }));
  // Planos ativos e arquivados (uma cobrança antiga pode ser de um plano já arquivado); falha deixa o filtro sem opções.
  const planos = useCarregar('planos-do-filtro-de-cobrancas', () =>
    Promise.all([listarPlanosComerciais(false), listarPlanosComerciais(true)]).then(([a, b]) => [...a, ...b]).catch(() => []));
  const nomeDoPlano = (id: string) => (planos.dados ?? []).find((p) => p.id === id)?.nome ?? null;
  const limparSelecao = () => {
    if (selecao.length > 0) avisar('A seleção de cobranças foi limpa porque a lista mudou.', 'neutro');
    setSelecao([]);
  };
  // Trocar um filtro troca o endereço sem empilhar histórico (a aba fica), volta à página 1 e limpa a seleção.
  const aplicar = (novos: FiltrosDeCobrancas) => {
    setPagina(0);
    limparSelecao();
    router.setParams(paraSetParams(CHAVES_DE_COBRANCAS, cobrancasParaEndereco(novos)));
  };
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const nomeDoAluno = filtros.alunoId ? dados?.itens.find((c) => c.alunoId === filtros.alunoId)?.alunoNome ?? null : null;
  const chips = chipsDasCobrancas(filtros, hoje, { aluno: nomeDoAluno, plano: nomeDoPlano });
  const opcoesDePlano = [{ valor: TODOS, rotulo: 'Todos' }, ...opcoesDePlanoDoFiltro(planos.dados ?? [])];

  // A seleção usa a versão mais nova que a página mostra; a que deixou de estar em aberto (paga em outra aba) sai sozinha.
  const naPagina = new Map((dados?.itens ?? []).map((c) => [c.id, c]));
  const lote = selecao.map((s) => naPagina.get(s.id) ?? s).filter(podeEntrarNoLote);
  const marcadas = new Set(lote.map((c) => c.id));
  const comLote = podeAlterar && !!dados && dados.itens.length > 0;

  return (
    <View style={estilos.coluna}>
      {recebimentoOnlineHabilitado && pode('ALUNO_LER') ? <CartaoDeConferencias podeAlterar={podeAlterar} /> : null}
      <BarraDeFiltros busca={{ valor: buscaDigitada, aoMudar: (t) => { setBuscaDigitada(t); setPagina(0); limparSelecao(); }, placeholder: 'Nome do aluno' }}
        valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS_DE_COBRANCAS} chips={chips}
        aoTirar={(chave) => aplicar(semOFiltroDeCobrancas(filtros, chave as ChaveDoFiltroDeCobrancas))} rotuloDoResultado="Ver cobranças"
        seletores={(atuais, mudar) => <SeletoresDeCobrancas filtros={atuais} aoMudar={mudar} opcoesDePlano={opcoesDePlano} />} />
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio titulo="Nenhuma cobrança nesta lista"
          texto={temVencimento(filtros) ? `Nenhuma cobrança${filtros.situacoes.length ? ' nesta situação' : ''} vence ${textoDoVencimento(filtros, hoje)}.`
            : chips.length === 0 && !busca ? 'As cobranças aparecem quando um aluno tem um plano comercial contratado na ficha.' : 'Tente outro filtro ou limpe a busca.'}
          acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: () => aplicar(SEM_FILTROS_DE_COBRANCAS) } : undefined} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={descricaoDasCobrancas(filtros, hoje, dados.total)}>
          {comLote ? (
            <BarraDoLote lote={lote} pagina={dados.itens}
              aoMarcarPagina={(marcar) => setSelecao((s) => marcarPaginaNoLote(s, dados.itens, marcar))}
              aoLimpar={() => setSelecao([])} aoRevisar={() => setRevisando(true)} />
          ) : null}
          <View style={lista.carregando ? estilos.esmaecido : null}>
            <ListaOuTabela rotulo="Cobranças" linhas={dados.itens} chave={(c) => c.id} aoTocar={setAberta} larguraMinima={LARGURA_DA_TABELA}
              rotuloDaLinha={(c) => `Abrir cobrança de ${c.alunoNome ?? 'aluno'}`}
              // `null` (nunca `undefined`) na que não entra no lote: a coluna fica, vazia, e a tabela não desalinha.
              // Coluna das caixas só quando a página tem alguma cobrança que pode entrar no lote.
              inicio={comLote && dados.itens.some(podeEntrarNoLote) ? (c) => (podeEntrarNoLote(c) ? (
                <CaixaDaLinha rotulo={`Selecionar cobrança de ${c.alunoNome ?? 'aluno'}, ${rotuloDoMes(c.competencia)}`} marcado={marcadas.has(c.id)}
                  aoMudar={() => setSelecao((s) => alternarNoLote(s, c))} />
              ) : null) : undefined}
              item={(c) => {
                const selo = seloDaCobranca(c);
                return {
                  titulo: c.alunoNome ?? '—',
                  detalhe: `${resumoDaCobranca(c)}${c.situacao === 'PAGA' && ehPagamentoOnline(c) ? ` · ${ROTULO_ONLINE}` : ''}`,
                  selo: { texto: selo.rotulo, tipo: selo.tom },
                };
              }}
              colunas={[
                { chave: 'id', titulo: 'ID', largura: 72, render: (c) => (
                  <Texto variante="pequeno" numerico numberOfLines={1} accessibilityLabel={`ID terminado em ${idCurtoDaCobranca(c.id)}`}>{idCurtoDaCobranca(c.id)}</Texto>
                ) },
                { chave: 'aluno', titulo: 'Aluno', flex: 1, principal: true, render: (c) => <AlunoDaCobranca cobranca={c} /> },
                { chave: 'competencia', titulo: 'Competência', largura: 96, render: (c) => <Texto numerico numberOfLines={1}>{rotuloDoMes(c.competencia)}</Texto> },
                { chave: 'vencimento', titulo: 'Vencimento', largura: 96, render: (c) => <Texto numerico numberOfLines={1}>{dataParaTela(c.vencimento)}</Texto> },
                { chave: 'emissao', titulo: 'Emissão', largura: 92, render: (c) => <Texto numerico numberOfLines={1}>{dataOuNada(emissaoDaCobranca(c))}</Texto> },
                { chave: 'pagamento', titulo: 'Pagamento', largura: 96, render: (c) => <PagamentoDaCobranca cobranca={c} /> },
                // Valor nunca corta com reticências: um valor maior que a coluna quebra a linha.
                { chave: 'valor', titulo: 'Valor', largura: 116, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto> },
                { chave: 'situacao', titulo: 'Situação', largura: 112, render: (c) => <SituacaoDaCobranca cobranca={c} /> },
              ]} />
          </View>
          {paginas > 1 ? (
            <View style={estilos.paginacao}>
              <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
              <Texto variante="suave">Página {pagina + 1} de {paginas}</Texto>
              <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      <FolhaDaCobranca cobranca={aberta} podeAlterar={podeAlterar} mostrarFicha aoFechar={() => setAberta(null)}
        aoMudar={() => {
          // A cobrança mexida na folha sai do lote (a versão mudou ou não está mais em aberto).
          const id = aberta?.id;
          if (id) setSelecao((s) => s.filter((x) => x.id !== id));
          recarregar();
        }} />
      {revisando ? (
        <FolhaDoLote itens={lote} aoFechar={() => setRevisando(false)}
          aoTirar={(id) => setSelecao((s) => s.filter((x) => x.id !== id))}
          aoTrocar={setSelecao}
          aoRegistrar={(registrados) => {
            const feitos = new Set(registrados);
            setSelecao((s) => s.filter((x) => !feitos.has(x.id)));
            recarregar();
          }} />
      ) : null}
    </View>
  );
}

/**
 * Barra do lote, acima da lista: quantas estão marcadas (anunciado), selecionar ou desmarcar as desta página e a ação
 * principal, que só abre a revisão. Sem nada marcado, diz como começar; acima de 100, o botão fica desabilitado com o motivo.
 */
function BarraDoLote({ lote, pagina, aoMarcarPagina, aoLimpar, aoRevisar }: {
  lote: readonly CobrancaResponse[];
  pagina: readonly CobrancaResponse[];
  aoMarcarPagina: (marcar: boolean) => void;
  aoLimpar: () => void;
  aoRevisar: () => void;
}) {
  const estado = estadoDaPaginaNoLote(lote, pagina);
  const n = lote.length;
  const idsDaPagina = new Set(pagina.map((c) => c.id));
  const emOutras = lote.filter((c) => !idsDaPagina.has(c.id)).length;
  const problema = problemaDoLote(n);
  if (estado === null && n === 0) return null;
  return (
    <View style={estilos.barra}>
      <View style={estilos.contagem} aria-live="polite">
        <Texto variante="rotulo">{n === 0 ? 'Registrar vários pagamentos' : contagemDoLote(n)}</Texto>
        <Texto variante="suave">
          {n === 0 ? 'Marque as cobranças em aberto para registrar o pagamento de várias de uma vez.'
            : emOutras > 0 ? `${emOutras === 1 ? '1 está' : `${emOutras} estão`} em outra página.` : 'Revise antes de registrar.'}
        </Texto>
      </View>
      <LinhaDeAcoes>
        {estado !== null ? (
          <Botao tipo="secundario" rotulo={estado === 'todas' ? 'Desmarcar as desta página' : 'Selecionar todas desta página'}
            aoTocar={() => aoMarcarPagina(estado !== 'todas')} />
        ) : null}
        {n > 0 ? <Botao tipo="secundario" rotulo="Limpar seleção" aoTocar={aoLimpar} /> : null}
        {n > 0 ? <Botao rotulo="Revisar pagamentos" aoTocar={aoRevisar} desabilitado={!!problema} motivo={problema ?? undefined} /> : null}
      </LinhaDeAcoes>
    </View>
  );
}

type ModoDoVencimento = 'QUALQUER' | 'PROXIMOS_7_DIAS' | 'PERIODO';
const MODOS_DO_VENCIMENTO: { valor: ModoDoVencimento; rotulo: string }[] = [
  { valor: 'QUALQUER', rotulo: 'Qualquer data' },
  { valor: 'PROXIMOS_7_DIAS', rotulo: 'Próximos 7 dias' },
  { valor: 'PERIODO', rotulo: 'Escolher período' },
];

const TODOS = 'TODOS';
const FORMAS: { valor: FormaDoFiltro | typeof TODOS; rotulo: string }[] = [{ valor: TODOS, rotulo: 'Qualquer' }, ...FORMAS_DO_FILTRO];

/**
 * Seletores das cobranças, em duas grades alinhadas: responsável e situações, plano e forma da baixa (duas colunas); depois
 * as datas (até três colunas): vencimento (qualquer, próximos 7 dias ou período), emissão e pagamento. "Escolher período"
 * abre os campos De/Até; o modo fica aqui enquanto o período está vazio (vazio no endereço é "qualquer data"). Os filtros
 * se combinam (todos valem juntos).
 */
function SeletoresDeCobrancas({ filtros, aoMudar, opcoesDePlano }: {
  filtros: FiltrosDeCobrancas; aoMudar: (f: FiltrosDeCobrancas) => void; opcoesDePlano: { valor: string; rotulo: string }[];
}) {
  const doFiltro: ModoDoVencimento = filtros.proximos7Dias ? 'PROXIMOS_7_DIAS' : filtros.periodo.de || filtros.periodo.ate ? 'PERIODO' : 'QUALQUER';
  const [escolhido, setEscolhido] = useState<ModoDoVencimento>(doFiltro);
  // Período vazio com o modo "Escolher período": fica aberto para digitar; o resto segue o filtro.
  const modo = doFiltro === 'QUALQUER' && escolhido === 'PERIODO' ? 'PERIODO' : doFiltro;
  const mudarModo = (m: ModoDoVencimento) => {
    setEscolhido(m);
    aoMudar({ ...filtros, proximos7Dias: m === 'PROXIMOS_7_DIAS', periodo: m === 'PERIODO' ? filtros.periodo : SEM_FILTROS_DE_COBRANCAS.periodo });
  };
  return (
    <>
      <FiltrosEmGrade>
        <Escolha rotulo="Responsável" opcoes={OPCOES_RESPONSABILIDADE} valor={filtros.meus ? 'meus' : 'todos'} aoMudar={(v) => aoMudar({ ...filtros, meus: v === 'meus' })} />
        <SelecaoMultiplaSuspensa rotulo="Situação" opcoes={SITUACOES_DO_FILTRO} marcados={new Set(filtros.situacoes)} rotuloDeTodos="Todas"
          aoMudar={(m) => aoMudar({ ...filtros, situacoes: SITUACOES_DO_FILTRO.map((o) => o.valor).filter((v) => m.has(v)) as SituacaoDoFiltro[] })}
          style={estilos.cheio} />
        <UmaOpcao rotulo="Plano" valor={filtros.planoId ?? TODOS} opcoes={opcoesDePlano}
          aoMudar={(v) => aoMudar({ ...filtros, planoId: v === TODOS ? null : v })} />
        <Escolha rotulo="Forma da baixa" opcoes={FORMAS} valor={filtros.forma ?? TODOS}
          aoMudar={(v) => aoMudar({ ...filtros, forma: v === TODOS ? null : (v as FormaDoFiltro) })} />
      </FiltrosEmGrade>
      <FiltrosEmGrade colunas={colunasDasDatas}>
        <View style={estilos.coluna}>
          <Escolha rotulo="Vencimento" opcoes={MODOS_DO_VENCIMENTO} valor={modo} aoMudar={mudarModo} />
          {modo === 'PERIODO' ? (
            <PeriodoDoFiltro rotulo="Vencimento entre" valor={filtros.periodo} aoMudar={(periodo) => aoMudar({ ...filtros, proximos7Dias: false, periodo })} />
          ) : null}
        </View>
        <PeriodoDoFiltro rotulo="Emissão" valor={filtros.emissao} aoMudar={(emissao) => aoMudar({ ...filtros, emissao })} />
        <PeriodoDoFiltro rotulo="Pagamento" valor={filtros.pagamento} aoMudar={(pagamento) => aoMudar({ ...filtros, pagamento })} />
      </FiltrosEmGrade>
    </>
  );
}

/** Nome do aluno, o CPF mascarado (só quando a API manda) e o plano, em texto secundário. */
function AlunoDaCobranca({ cobranca }: { cobranca: CobrancaResponse }) {
  const cpf = cpfMascarado(cobranca.alunoCpf);
  return (
    <View style={estilos.celula}>
      <Texto variante="bloco" numberOfLines={2}>{cobranca.alunoNome ?? '—'}</Texto>
      {cpf ? <Texto variante="pequeno" numerico numberOfLines={1} accessibilityLabel={`CPF ${cpf}`}>CPF {cpf}</Texto> : null}
      <Texto variante="pequeno" numberOfLines={1}>{cobranca.planoNome ?? '—'}</Texto>
    </View>
  );
}

/** Data da baixa e a forma embaixo; sem baixa registrada, "—". */
function PagamentoDaCobranca({ cobranca }: { cobranca: CobrancaResponse }) {
  if (!temBaixaRegistrada(cobranca)) return <Texto>{SEM_DADO}</Texto>;
  return (
    <View style={estilos.celula}>
      <Texto numerico numberOfLines={1}>{dataOuNada(cobranca.pagoEm)}</Texto>
      <Texto variante="pequeno" numberOfLines={1}>{rotuloDaForma(cobranca.forma)}</Texto>
    </View>
  );
}

/** Selo da situação; vencida mostra os dias de atraso que a API calculou. */
export function SituacaoDaCobranca({ cobranca }: { cobranca: CobrancaResponse }) {
  const selo = seloDaCobranca(cobranca);
  return (
    <View style={estilos.selos}>
      <Selo texto={selo.rotulo} tipo={selo.tom} />
      {cobranca.situacao === 'PAGA' && ehPagamentoOnline(cobranca) ? <Selo texto={ROTULO_ONLINE} tipo="neutro" /> : null}
      {cobranca.situacao === 'ABERTA' && cobranca.vencida ? <Texto variante="pequeno">{atrasoParaTela(cobranca.diasDeAtraso)}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  cheio: { alignSelf: 'stretch' },
  esmaecido: { opacity: 0.6 },
  selos: { gap: espaco(0.25), alignItems: 'flex-start' },
  celula: { gap: 2, minWidth: 0 },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  contagem: { flexGrow: 1, flexShrink: 1, flexBasis: 260, gap: 2 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});

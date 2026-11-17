import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Plus, UserRound } from 'lucide-react-native';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CobrancaResponse, TotaisDasCobrancas } from '../../api/financeiroTipos';
import { aluno, listarCobrancas, listarPlanosComerciais } from '../../api/rotas';
import {
  alternarNoLote, atrasoParaTela, contagemDoLote, cpfMascarado, ehPagamentoOnline, emissaoDaCobranca, estadoDaPaginaNoLote,
  hojeEmBrasilia, idCurtoDaCobranca, marcarPaginaNoLote, nomeNaListaDaCobranca, opcoesDePlanoDoFiltro, podeEntrarNoLote, problemaDoLote,
  referenciaDaCobranca, resumoDaCobranca, ROTULO_ONLINE, rotuloDaForma, rotuloDoTipoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca,
  temBaixaRegistrada,
} from '../../dominio/financeiro';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  CHAVES_DE_COBRANCAS, chaveDasCobrancas, chipsDasCobrancas, cobrancasParaApi, cobrancasParaEndereco, descricaoDasCobrancas,
  FORMAS_DO_FILTRO, lerCobrancasDoEndereco, limpoDasCobrancas, SEM_FILTROS_DE_COBRANCAS, semOFiltroDeCobrancas, SITUACOES_DO_FILTRO, temVencimento,
  textoDoVencimento, type ChaveDoFiltroDeCobrancas, type FiltrosDeCobrancas, type FormaDoFiltro, type SituacaoDoFiltro,
} from '../../dominio/filtrosDoFinanceiro';
import { centavosParaTela, dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { colunasDosIndicadores } from '../../dominio/grade';
import { selecaoDepoisDosFiltros } from '../../dominio/painelDeFiltros';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { OPCOES_RESPONSABILIDADE } from '../EscolhaResponsabilidade';
import { UmaOpcao } from '../SeletoresDeFiltro';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Divisor } from '../../ui/Divisor';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Grade } from '../../ui/Grade';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CaixaDaLinha } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { AcoesDoLote, FolhaDoResultadoDaAcao, type ResultadoDaAcao } from './AcoesDoLote';
import { CartaoDeConferencias } from './CartaoDeConferencias';
import { PeriodoDoFiltro } from './FiltrosEmGrade';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { FolhaDaCobrancaAvulsa } from './FolhaDaCobrancaAvulsa';
import { FolhaDoLote } from './FolhaDoLote';
import { ListaOuTabela } from './ListaOuTabela';

const TAMANHO_PAGINA = 50;

/**
 * Abaixo desta largura (da própria tabela) as cobranças viram cartões. As colunas de data, valor e situação têm largura
 * fixa (nunca cortam dinheiro nem data); o aluno fica com o resto, no mínimo uns 130 px. Em 1280 px com o menu aberto a
 * tabela mede uns 955 px e cabe.
 */
const LARGURA_DA_TABELA = 940;

const dataOuNada = (iso: string | null | undefined) => (iso ? dataParaTela(iso) : SEM_DADO);

/**
 * Cobranças dos alunos, por vencimento. "Vencidas" é só um filtro (a API decide pela data de Brasília); "Em aberto"
 * inclui as vencidas. Tocar na linha abre a cobrança, com Registrar pagamento, Desfazer e Cancelar para quem pode alterar.
 * No topo, com o recebimento online ligado, "Pagamentos para conferir" (só aparece quando há algum). Cobrança paga pelo
 * provedor leva o selo "Online". Na barra de filtros: a busca pelo nome do aluno (na API, 300 ms depois de digitar) fica
 * na página; o resto mora no painel lateral "Filtros de cobranças" (`docs/planos/filtros-laterais.md`), em grupos:
 * Identificação (responsável, plano), Situação (situações, várias, e forma da baixa) e Datas (vencimento: próximos 7 dias
 * ou um período; emissão; pagamento), com rascunho até o "Aplicar filtros".
 * Tudo no endereço junto do `?aba=cobrancas` (`?meus=true&situacao=ABERTA,PAGA&vencimento=PROXIMOS_7_DIAS` ou `&de=&ate=`,
 * `&emissaoDe=&emissaoAte=&pagoDe=&pagoAte=&planoId=&forma=`), como os mini-cartões do Início abrem. Um aluno só chega pelo
 * endereço (`&alunoId=`, o "Ver no Financeiro" da ficha): é o contexto da lista (`FaixaDoAluno`), fica com "Limpar filtros"
 * e só sai por "Ver cobranças de todos os alunos". Valor desconhecido no endereço é ignorado.
 *
 * Com `FINANCEIRO_ALTERAR`, cada cobrança em aberto (vencida incluída) tem a caixa de marcar ao lado da linha (fora do
 * toque que a abre) e a barra do lote conta as marcadas, seleciona as da página e abre a revisão obrigatória
 * (`FolhaDoLote`). Trocar de página mantém a seleção. Seleção × filtros (D9, `selecaoDepoisDosFiltros`): aplicar filtros
 * diferentes (painel, ✕ do chip, "Limpar filtros") ou mudar a busca limpa a seleção, com aviso; aplicar os mesmos filtros
 * e Cancelar/X/Esc/fundo do painel não mexem nela. Assim o lote nunca leva cobrança que a lista não mostra. Ao lado do
 * "Revisar pagamentos", "Mais ações" cancela, gera os links e exporta as selecionadas (`AcoesDoLote`).
 *
 * No topo, "Nova cobrança avulsa" (`FINANCEIRO_ALTERAR`) abre o passo a passo (`FolhaDaCobrancaAvulsa`); acima da lista, os
 * totais do filtro inteiro (todas as páginas), calculados pelo servidor (`PaginaCobrancas.totais`); a avulsa aparece com
 * o selo "Avulsa" e a descrição no lugar do plano.
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
  const [novaAvulsa, setNovaAvulsa] = useState(false);
  // Fora da barra do lote: cancelar tudo esvazia a seleção e a barra some, mas o resultado continua na tela.
  const [resultadoDoLote, setResultadoDoLote] = useState<ResultadoDaAcao | null>(null);
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
  // Trocar um filtro troca o endereço sem empilhar histórico (a aba fica), volta à página 1 e limpa a seleção. Os mesmos
  // filtros de antes (Aplicar sem mudar nada) não fazem nada.
  const aplicar = (novos: FiltrosDeCobrancas) => {
    const antes = chaveDasCobrancas(filtros, busca);
    const depois = chaveDasCobrancas(novos, busca);
    if (antes === depois) return;
    const { aviso } = selecaoDepoisDosFiltros(lote, antes, depois);
    if (aviso) avisar(aviso, 'neutro');
    setSelecao([]);
    setPagina(0);
    router.setParams(paraSetParams(CHAVES_DE_COBRANCAS, cobrancasParaEndereco(novos)));
  };
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;
  // Filtro novo ainda carregando: as linhas à vista são as do filtro anterior, então o lote e a descrição esperam a resposta.
  const desatualizada = !!lista.dadosDeOutraChave;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  // O aluno de quem chegou pela ficha: o nome vem da ficha (`GET /alunos/{id}`, a mesma `ALUNO_LER` que o Financeiro exige),
  // com o da lista de reserva; nunca vai ao endereço.
  const alunoDaFicha = useCarregar(filtros.alunoId ? `aluno-das-cobrancas|${filtros.alunoId}` : null, () => aluno(filtros.alunoId!));
  const nomeDoAluno = filtros.alunoId
    ? (alunoDaFicha.dadosDeOutraChave ? null : alunoDaFicha.dados?.nome) ?? dados?.itens.find((c) => c.alunoId === filtros.alunoId)?.alunoNome ?? null
    : null;
  const textoDoAluno = nomeDoAluno ?? (alunoDaFicha.carregando ? 'Carregando o aluno…' : 'Aluno escolhido');
  const barra = useRef<View>(null);
  const verTodos = () => {
    aplicar(semOFiltroDeCobrancas(filtros, 'aluno'));
    // O botão some com a faixa: no teclado o foco vai à busca, logo abaixo, em vez de cair no início da página.
    if (Platform.OS === 'web') requestAnimationFrame(() => (barra.current as unknown as HTMLElement | null)?.querySelector('input')?.focus());
  };
  const chips = chipsDasCobrancas(filtros, hoje, { plano: nomeDoPlano });
  const opcoesDePlano = [{ valor: TODOS, rotulo: 'Todos' }, ...opcoesDePlanoDoFiltro(planos.dados ?? [])];

  // A seleção usa a versão mais nova que a página mostra; a que deixou de estar em aberto (paga em outra aba) sai sozinha.
  const naPagina = new Map((dados?.itens ?? []).map((c) => [c.id, c]));
  const lote = selecao.map((s) => naPagina.get(s.id) ?? s).filter(podeEntrarNoLote);
  const marcadas = new Set(lote.map((c) => c.id));
  const comLote = podeAlterar && !!dados && dados.itens.length > 0 && !desatualizada;

  return (
    <View style={estilos.coluna}>
      {podeAlterar ? (
        <View style={estilos.topo}>
          <Texto variante="suave" style={estilos.explicacao}>Mensalidades, cobranças de saída e avulsas dos alunos, por vencimento.</Texto>
          <Botao rotulo="Nova cobrança avulsa" Icone={Plus} aoTocar={() => setNovaAvulsa(true)} />
        </View>
      ) : null}
      {recebimentoOnlineHabilitado && pode('ALUNO_LER') ? <CartaoDeConferencias podeAlterar={podeAlterar} /> : null}
      {filtros.alunoId ? <FaixaDoAluno nome={textoDoAluno} aoVerTodos={verTodos} /> : null}
      <View ref={barra}>
        <BarraDeFiltros busca={{ valor: buscaDigitada, aoMudar: (t) => { setBuscaDigitada(t); setPagina(0); limparSelecao(); }, placeholder: 'Nome do aluno' }}
          valor={filtros} aoAplicar={aplicar} limpo={limpoDasCobrancas(filtros)} chips={chips}
          aoTirar={(chave) => aplicar(semOFiltroDeCobrancas(filtros, chave as ChaveDoFiltroDeCobrancas))}
          painelLateral={{ titulo: 'Filtros de cobranças' }}
          seletores={(atuais, mudar) => (
            <SeletoresDeCobrancas filtros={atuais} aoMudar={mudar} opcoesDePlano={opcoesDePlano} aluno={atuais.alunoId ? textoDoAluno : null} />
          )} />
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {/* Sem resposta (primeira carga ou erro) não há totais: nunca um zero inventado. Lista vazia: o vazio já diz tudo. */}
      {dados?.totais && dados.itens.length > 0 && !lista.erro ? <TotaisDaLista totais={dados.totais} atualizando={desatualizada} /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio titulo="Nenhuma cobrança nesta lista"
          texto={temVencimento(filtros) ? `Nenhuma cobrança${filtros.situacoes.length ? ' nesta situação' : ''} vence ${textoDoVencimento(filtros, hoje)}.`
            : chips.length === 0 && !busca
              ? filtros.alunoId ? 'Este aluno ainda não tem cobranças. Elas aparecem quando ele tem um plano comercial contratado na ficha.'
                : 'As cobranças aparecem quando um aluno tem um plano comercial contratado na ficha.'
              : 'Tente outro filtro ou limpe a busca.'}
          // Só com o aluno, a saída é o "Ver cobranças de todos os alunos" da faixa, logo acima.
          acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: () => aplicar(limpoDasCobrancas(filtros)) } : undefined} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={desatualizada ? undefined : descricaoDasCobrancas(filtros, hoje, dados.total)}>
          {comLote ? (
            <BarraDoLote lote={lote} pagina={dados.itens}
              aoMarcarPagina={(marcar) => setSelecao((s) => marcarPaginaNoLote(s, dados.itens, marcar))}
              aoLimpar={() => setSelecao([])} aoRevisar={() => setRevisando(true)}
              acoes={(estilo) => (
                <AcoesDoLote lote={lote} comLink={recebimentoOnlineHabilitado} aoResultado={setResultadoDoLote} estilo={estilo}
                  aoCancelar={(cancelados) => {
                    const feitos = new Set(cancelados);
                    setSelecao((s) => s.filter((x) => !feitos.has(x.id)));
                    recarregar();
                  }} />
              )} />
          ) : null}
          <View style={lista.carregando ? estilos.esmaecido : null} pointerEvents={desatualizada ? 'none' : 'auto'}>
            <ListaOuTabela rotulo="Cobranças" linhas={dados.itens} chave={(c) => c.id} aoTocar={setAberta} larguraMinima={LARGURA_DA_TABELA}
              rotuloDaLinha={(c) => `Abrir ${c.tipo === 'MENSALIDADE' ? 'cobrança' : rotuloDoTipoDaCobranca(c.tipo).toLowerCase()} de ${c.alunoNome ?? 'aluno'}`}
              // `null` (nunca `undefined`) na que não entra no lote: a coluna fica, vazia, e a tabela não desalinha.
              // Coluna das caixas só quando a página tem alguma cobrança que pode entrar no lote.
              inicio={comLote && dados.itens.some(podeEntrarNoLote) ? (c) => (podeEntrarNoLote(c) ? (
                <CaixaDaLinha rotulo={`Selecionar cobrança de ${c.alunoNome ?? 'aluno'}, ${referenciaDaCobranca(c)}`} marcado={marcadas.has(c.id)}
                  aoMudar={() => setSelecao((s) => alternarNoLote(s, c))} />
              ) : null) : undefined}
              item={(c) => {
                const selo = seloDaCobranca(c);
                const doTipo = seloDoTipoDaCobranca(c.tipo);
                return {
                  titulo: c.alunoNome ?? '—',
                  // A avulsa diz o que é (a descrição) antes do valor; a mensalidade segue só com o valor e a data. O "R$" vai colado
                  // ao número: no cartão de 390 px ele ficava sozinho no fim da linha.
                  detalhe: `${c.tipo === 'AVULSA' ? `${referenciaDaCobranca(c)} · ` : ''}${resumoDaCobranca(c).replace(/R\$ /g, 'R$\u00a0')}${c.situacao === 'PAGA' && ehPagamentoOnline(c) ? ` · ${ROTULO_ONLINE}` : ''}`,
                  selo: { texto: selo.rotulo, tipo: selo.tom },
                  extra: doTipo ? <View style={estilos.seloDoTipo}><Selo texto={doTipo.rotulo} tipo={doTipo.tom} /></View> : undefined,
                };
              }}
              colunas={[
                { chave: 'id', titulo: 'ID', largura: 72, render: (c) => (
                  <Texto variante="pequeno" numerico numberOfLines={1} accessibilityLabel={`ID terminado em ${idCurtoDaCobranca(c.id)}`}>{idCurtoDaCobranca(c.id)}</Texto>
                ) },
                { chave: 'aluno', titulo: 'Aluno', flex: 1, principal: true, render: (c) => <AlunoDaCobranca cobranca={c} /> },
                { chave: 'competencia', titulo: 'Competência', largura: 96, render: (c) => (
                  // A avulsa não tem competência: diz isso, sem "—" (a descrição está na coluna do aluno).
                  c.competencia ? <Texto numerico numberOfLines={1}>{rotuloDoMes(c.competencia)}</Texto> : <Texto variante="pequeno">Não se aplica</Texto>
                ) },
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
      {resultadoDoLote ? <FolhaDoResultadoDaAcao {...resultadoDoLote} aoFechar={() => setResultadoDoLote(null)} /> : null}
      {novaAvulsa ? <FolhaDaCobrancaAvulsa aoFechar={() => setNovaAvulsa(false)} aoGerar={recarregar} /> : null}
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
function BarraDoLote({ lote, pagina, aoMarcarPagina, aoLimpar, aoRevisar, acoes }: {
  lote: readonly CobrancaResponse[];
  pagina: readonly CobrancaResponse[];
  aoMarcarPagina: (marcar: boolean) => void;
  aoLimpar: () => void;
  aoRevisar: () => void;
  /** O menu das outras ações (cancelar, links, exportar), ao lado do "Revisar pagamentos"; recebe o estilo dos botões da barra. */
  acoes: (estilo: StyleProp<ViewStyle>) => ReactNode;
}) {
  const estado = estadoDaPaginaNoLote(lote, pagina);
  const n = lote.length;
  const idsDaPagina = new Set(pagina.map((c) => c.id));
  const emOutras = lote.filter((c) => !idsDaPagina.has(c.id)).length;
  const problema = problemaDoLote(n);
  // No celular cada fileira de botões ocupa a largura toda (os que cabem juntos dividem a linha): sem a escadinha de
  // larguras diferentes que a quebra de linha deixava.
  const { width } = useWindowDimensions();
  const cheia = width < LARGURA_MENU_LATERAL ? estilos.cresce : undefined;
  if (estado === null && n === 0) return null;
  return (
    <View style={estilos.barra}>
      <View style={estilos.contagem} aria-live="polite">
        <Texto variante="rotulo">{n === 0 ? 'Registrar vários pagamentos' : contagemDoLote(n)}</Texto>
        <Texto variante="suave">
          {n === 0 ? 'Marque as cobranças em aberto para registrar o pagamento, cancelar ou gerar o link de várias de uma vez.'
            : emOutras > 0 ? `${emOutras === 1 ? '1 está' : `${emOutras} estão`} em outra página.` : 'Revise antes de registrar.'}
        </Texto>
      </View>
      <LinhaDeAcoes>
        {estado !== null ? (
          <Botao tipo="secundario" rotulo={estado === 'todas' ? 'Desmarcar as desta página' : 'Selecionar todas desta página'}
            aoTocar={() => aoMarcarPagina(estado !== 'todas')} style={cheia} />
        ) : null}
        {n > 0 ? <Botao tipo="secundario" rotulo="Limpar seleção" aoTocar={aoLimpar} style={cheia} /> : null}
        {n > 0 ? acoes(cheia) : null}
        {n > 0 ? <Botao rotulo="Revisar pagamentos" aoTocar={aoRevisar} desabilitado={!!problema} motivo={problema ?? undefined} style={cheia} /> : null}
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
 * Seletores das cobranças no painel lateral, numa coluna e em grupos (D2): Identificação (responsável, plano), Situação
 * (situações e forma da baixa) e Datas (vencimento: qualquer, próximos 7 dias ou período; emissão; pagamento), cada data
 * com rótulo próprio. "Escolher período" abre os campos De/Até; o modo fica aqui enquanto o período está vazio (vazio no
 * endereço é "qualquer data"). Os filtros se combinam (todos valem juntos).
 */
function SeletoresDeCobrancas({ filtros, aoMudar, opcoesDePlano, aluno: nomeDoAluno }: {
  filtros: FiltrosDeCobrancas; aoMudar: (f: FiltrosDeCobrancas) => void; opcoesDePlano: { valor: string; rotulo: string }[];
  /** O aluno de quem chegou pela ficha: só leitura aqui (o painel não o muda nem o "Limpar filtros" o tira). */
  aluno: string | null;
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
      <GrupoDoPainel titulo="Identificação" primeiro>
        {nomeDoAluno ? (
          <View style={estilos.alunoNoPainel}>
            <CampoLeitura rotulo="Aluno" valor={nomeDoAluno} />
            <Texto variante="pequeno">Vem da ficha e continua com “Limpar filtros”. Para ver todos, use “Ver cobranças de todos os alunos” na página.</Texto>
          </View>
        ) : null}
        <Escolha rotulo="Responsável" opcoes={OPCOES_RESPONSABILIDADE} valor={filtros.meus ? 'meus' : 'todos'} aoMudar={(v) => aoMudar({ ...filtros, meus: v === 'meus' })} />
        <UmaOpcao rotulo="Plano" valor={filtros.planoId ?? TODOS} opcoes={opcoesDePlano}
          aoMudar={(v) => aoMudar({ ...filtros, planoId: v === TODOS ? null : v })} />
      </GrupoDoPainel>
      <GrupoDoPainel titulo="Situação">
        <SelecaoMultiplaSuspensa rotulo="Situação" opcoes={SITUACOES_DO_FILTRO} marcados={new Set(filtros.situacoes)} rotuloDeTodos="Todas"
          aoMudar={(m) => aoMudar({ ...filtros, situacoes: SITUACOES_DO_FILTRO.map((o) => o.valor).filter((v) => m.has(v)) as SituacaoDoFiltro[] })}
          style={estilos.cheio} />
        <Escolha rotulo="Forma da baixa" opcoes={FORMAS} valor={filtros.forma ?? TODOS}
          aoMudar={(v) => aoMudar({ ...filtros, forma: v === TODOS ? null : (v as FormaDoFiltro) })} />
      </GrupoDoPainel>
      <GrupoDoPainel titulo="Datas">
        <View style={estilos.coluna}>
          <Escolha rotulo="Vencimento" opcoes={MODOS_DO_VENCIMENTO} valor={modo} aoMudar={mudarModo} />
          {modo === 'PERIODO' ? (
            <PeriodoDoFiltro nomeUnico rotulo="Vencimento entre" valor={filtros.periodo} aoMudar={(periodo) => aoMudar({ ...filtros, proximos7Dias: false, periodo })} />
          ) : null}
        </View>
        <PeriodoDoFiltro nomeUnico rotulo="Emissão" valor={filtros.emissao} aoMudar={(emissao) => aoMudar({ ...filtros, emissao })} />
        <PeriodoDoFiltro nomeUnico rotulo="Pagamento" valor={filtros.pagamento} aoMudar={(pagamento) => aoMudar({ ...filtros, pagamento })} />
      </GrupoDoPainel>
    </>
  );
}

/**
 * O aluno de quem chegou por "Ver no Financeiro" da ficha (`?alunoId=`), acima da barra: é o contexto da lista, não um
 * critério do painel (não conta no botão "Filtros" nem vira chip, e "Limpar filtros" não o tira; D5 e D6 de
 * `docs/planos/filtros-laterais.md`). Neutro, no contorno dos contêineres; a única saída é "Ver cobranças de todos os
 * alunos", que tira só o aluno.
 */
function FaixaDoAluno({ nome, aoVerTodos }: { nome: string; aoVerTodos: () => void }) {
  const { cores, bordas } = useTema();
  return (
    <View role="group" aria-label="Aluno" style={[estilos.faixaDoAluno, { backgroundColor: cores.superficie, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
      <View style={estilos.quemE}>
        <UserRound size={20} color={cores.textoSuave} strokeWidth={2} aria-hidden />
        <View style={estilos.celula}>
          <Texto variante="pequeno">Cobranças de</Texto>
          <Texto variante="bloco" numberOfLines={2}>{nome}</Texto>
        </View>
      </View>
      <Botao tipo="secundario" rotulo="Ver cobranças de todos os alunos" aoTocar={aoVerTodos} />
    </View>
  );
}

/** Nome do aluno, o CPF mascarado (só quando a API manda) e o plano, em texto secundário. */
function AlunoDaCobranca({ cobranca }: { cobranca: CobrancaResponse }) {
  const cpf = cpfMascarado(cobranca.alunoCpf);
  return (
    <View style={estilos.celula}>
      <Texto variante="bloco" numberOfLines={2}>{cobranca.alunoNome ?? '—'}</Texto>
      {cpf ? <Texto variante="pequeno" numerico numberOfLines={1} accessibilityLabel={`CPF ${cpf}`}>CPF {cpf}</Texto> : null}
      <Texto variante="pequeno" numberOfLines={2}>{nomeNaListaDaCobranca(cobranca)}</Texto>
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
  const doTipo = seloDoTipoDaCobranca(cobranca.tipo);
  return (
    <View style={estilos.selos}>
      <Selo texto={selo.rotulo} tipo={selo.tom} />
      {doTipo ? <Selo texto={doTipo.rotulo} tipo={doTipo.tom} /> : null}
      {cobranca.situacao === 'PAGA' && ehPagamentoOnline(cobranca) ? <Selo texto={ROTULO_ONLINE} tipo="neutro" /> : null}
      {cobranca.situacao === 'ABERTA' && cobranca.vencida ? <Texto variante="pequeno">{atrasoParaTela(cobranca.diasDeAtraso)}</Texto> : null}
    </View>
  );
}

/**
 * Os quatro totais do filtro inteiro (todas as páginas), como o servidor calcula: cancelada e estornada ficam fora; "Em
 * aberto" já inclui as vencidas (por isso diz isso, para ninguém somar duas vezes); a contestada entra no total e não em
 * pago nem em aberto, então o total pode passar de pago + em aberto (nenhuma tela soma os dois). Número sempre em `texto` (zero em
 * `textoSuave`); a única cor é o ícone de alerta do vencido, no `perigo` do selo "Vencida" das linhas (exceção da
 * cobrança, 4.5). Com o filtro novo a caminho, os números do anterior ficam esmaecidos e marcados como ocupados. No PC,
 * quatro (ou duas) caixas lado a lado; no celular, uma lista de rótulo e valor, que cabe acima da dobra e nunca parte o
 * valor (o "R$" vai colado ao número, como no ResultadoDoMes, que no celular usa uma coluna pelo mesmo motivo).
 */
function TotaisDaLista({ totais, atualizando }: { totais: TotaisDasCobrancas; atualizando: boolean }) {
  const { cores, fatorTexto } = useTema();
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_MENU_LATERAL;
  const itens = [
    { rotulo: 'Total', centavos: totais.totalCentavos },
    { rotulo: 'Pago', centavos: totais.pagoCentavos },
    { rotulo: 'Em aberto', centavos: totais.emAbertoCentavos, nota: 'inclui as vencidas' },
    { rotulo: 'Vencido', centavos: totais.vencidoCentavos, alerta: totais.vencidoCentavos > 0 },
  ];
  return (
    // O que vale para os quatro fica numa linha só, na faixa: no celular os números ainda cabem acima da dobra.
    <Cartao titulo="Totais" descricao="De todas as páginas deste filtro. Em aberto inclui as vencidas; canceladas e estornadas não entram. Contestadas entram no total, mas não em pago nem em aberto.">
      <View style={atualizando ? estilos.esmaecido : null} aria-busy={atualizando}>
        {celular ? (
          <View>
            {itens.map((t, i) => (
              <View key={t.rotulo}>
                {i > 0 ? <Divisor /> : null}
                <View accessible accessibilityLabel={`${t.rotulo}: ${centavosParaTela(t.centavos)}${t.nota ? `, ${t.nota}` : ''}`} style={estilos.linhaDoTotal}>
                  <RotuloDoTotal rotulo={t.rotulo} alerta={!!t.alerta} />
                  <ValorDoTotal centavos={t.centavos} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Grade gap={espaco(1.5)} colunas={(l) => Math.max(2, colunasDosIndicadores(l, fatorTexto))}>
            {itens.map((t) => (
              <View key={t.rotulo} accessible accessibilityLabel={`${t.rotulo}: ${centavosParaTela(t.centavos)}${t.nota ? `, ${t.nota}` : ''}`}
                style={[estilos.total, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                <RotuloDoTotal rotulo={t.rotulo} alerta={!!t.alerta} />
                <ValorDoTotal centavos={t.centavos} />
              </View>
            ))}
          </Grade>
        )}
      </View>
    </Cartao>
  );
}

function RotuloDoTotal({ rotulo, alerta }: { rotulo: string; alerta: boolean }) {
  const { cores } = useTema();
  return (
    <View style={estilos.rotuloDoTotal}>
      {alerta ? <AlertCircle size={16} color={cores.perigo} strokeWidth={2.25} aria-hidden /> : null}
      <Texto variante="rotulo">{rotulo}</Texto>
    </View>
  );
}

function ValorDoTotal({ centavos }: { centavos: number }) {
  const { cores } = useTema();
  return (
    <Texto variante="bloco" numerico cor={centavos === 0 ? cores.textoSuave : cores.texto}>
      {centavosParaTela(centavos).replace('R$ ', 'R$\u00a0')}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  linhaDoTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), minHeight: 44, paddingVertical: espaco(0.5) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  explicacao: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  total: { flexGrow: 1, minWidth: 0, gap: espaco(0.25), paddingVertical: espaco(1), paddingHorizontal: espaco(1.5), borderRadius: RAIO, borderWidth: 1 },
  rotuloDoTotal: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  cheio: { alignSelf: 'stretch' },
  esmaecido: { opacity: 0.6 },
  selos: { gap: espaco(0.25), alignItems: 'flex-start' },
  seloDoTipo: { flexDirection: 'row' },
  celula: { gap: 2, minWidth: 0 },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  contagem: { flexGrow: 1, flexShrink: 1, flexBasis: 260, gap: 2 },
  cresce: { flexGrow: 1 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  faixaDoAluno: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5),
    borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2),
  },
  quemE: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  alunoNoPainel: { gap: espaco(0.5) },
});

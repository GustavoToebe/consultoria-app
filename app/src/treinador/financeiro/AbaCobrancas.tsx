import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CobrancaResponse, TotaisDasCobrancas } from '../../api/financeiroTipos';
import { aluno, listarCobrancas, listarPlanosComerciais } from '../../api/rotas';
import {
  alternarNoLote, atrasoParaTela, contagemDoLote, cpfMascarado, ehPagamentoOnline, emissaoDaCobranca, estadoDaPaginaNoLote,
  hojeEmBrasilia, idCurtoDaCobranca, marcarPaginaNoLote, nomeNaListaDaCobranca, opcoesDePlanoDoFiltro, podeEntrarNoLote, problemaDoLote,
  referenciaDaCobranca, resumoDaCobranca, ROTULO_ONLINE, rotuloDaForma, rotuloDoTipoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca,
  temBaixaRegistrada, temDescricaoPropria,
} from '../../dominio/financeiro';
import { paraSetParams } from '../../dominio/filtrosComuns';
import { mesesDoFiltro, enderecoDasCobrancas, filtrosDaAbaDeCobrancas } from '../../dominio/filtroPadraoDasCobrancas';
import {
  CHAVES_DE_COBRANCAS, chaveDasCobrancas, chipsDasCobrancas, cobrancasParaApi, descricaoDasCobrancas,
  FORMAS_DO_FILTRO, limpoDasCobrancas, saoAsAtivas, SEM_FILTROS_DE_COBRANCAS, semOFiltroDeCobrancas, SITUACOES_DO_FILTRO, temVencimento,
  textoDoVencimento, type ChaveDoFiltroDeCobrancas, type FiltrosDeCobrancas, type FormaDoFiltro, type SituacaoDoFiltro,
} from '../../dominio/filtrosDoFinanceiro';
import { centavosParaTela, dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { rotuloDoMesNumerico } from '../../dominio/mesDaCompetencia';
import { selecaoDepoisDosFiltros } from '../../dominio/painelDeFiltros';
import { escalar } from '../../dominio/preferencias';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_FAIXA_ULTRALARGA, LARGURA_FORMULARIO, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { OPCOES_RESPONSABILIDADE } from '../EscolhaResponsabilidade';
import { UmaOpcao } from '../SeletoresDeFiltro';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { CartaoDeIndicador, type TomDoIndicador } from '../../ui/CartaoDeIndicador';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { GradeDeIndicadores } from '../../ui/GradeDeIndicadores';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { CaixaDaLinha } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { AcoesDoLote, FolhaDoResultadoDaAcao, type ResultadoDaAcao } from './AcoesDoLote';
import { CartaoDeConferencias } from './CartaoDeConferencias';
import { PeriodoDoFiltro } from './FiltrosEmGrade';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { FolhaDaCobrancaAvulsa } from './FolhaDaCobrancaAvulsa';
import { FolhaDoLote } from './FolhaDoLote';
import { FolhaRenegociar } from './FolhaRenegociar';
import { ListaOuTabela } from './ListaOuTabela';

const TAMANHO_PAGINA = 50;

/**
 * Colunas da tabela em duas medidas (financeiro, 19/11), todas com `flex` e mínimo para o espaço se dividir entre elas em
 * vez de ir todo para o aluno. Folgada (PC largo): 24 px entre colunas, Aluno com 220 no mínimo e Situação com 160.
 * Justa (de `LARGURA_DA_TABELA` até a folgada; 1280 px com o menu aberto dá uns 955 px de tabela): os mínimos de antes,
 * o Aluno com 130, e a sobra vai primeiro para o vão entre colunas, de 8 até 24 px (`vaoDaJusta`). Data, competência e valor nunca cortam (o mínimo cabe "05/10/2026" e "R$ 99.999,00"
 * em Geist Mono; o cabeçalho "COMPETÊNCIA" pede 96). Abaixo da justa as cobranças viram cartões.
 */
const MINIMOS = { id: 72, competencia: 96, data: 92, valor: 112 };
const FOLGADA = { vao: espaco(3), aluno: 220, situacao: 160 };
const JUSTA = { vao: espaco(1), aluno: 130, situacao: 112 };
/** A caixa do lote (44 + 12 de recuo) e o recuo da direita da linha; o recuo da esquerda some com a caixa. */
const LADOS_DA_LINHA = ALVO_TOQUE + espaco(1.5) + espaco(1.5);
const larguraDas = (m: typeof FOLGADA) =>
  MINIMOS.id + m.aluno + MINIMOS.competencia + 3 * MINIMOS.data + MINIMOS.valor + m.situacao + 8 * m.vao + LADOS_DA_LINHA;
/** 1196 px: a partir daqui, a medida folgada. */
const LARGURA_FOLGADA = larguraDas(FOLGADA);
/** Na medida justa, a sobra da largura vira vão (8 vãos: 7 entre colunas e o da caixa do lote), de 8 a 24 px. */
const vaoDaJusta = (largura: number) =>
  Math.min(FOLGADA.vao, Math.max(JUSTA.vao, Math.floor((largura - larguraDas({ ...JUSTA, vao: 0 })) / 8)));
/** A medida justa pede 930 px; 940 deixa a folga de antes (1280 px é tabela, 1225 px já são cartões). */
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
 * `&mesVencimento=AAAA-MM&emissaoDe=&emissaoAte=&pagoDe=&pagoAte=&planoId=&forma=`), como os mini-cartões do Início abrem.
 * Filtro padrão (19/11, `dominio/filtroPadraoDasCobrancas.ts`): sem nenhuma chave das cobranças no endereço, a aba abre
 * em Situação: Ativas e Mês de vencimento: o mês atual de Brasília. O mês é só do app (a API não o filtra): vai como
 * vencimento do dia 1 ao último do mês, então avulsa e parcela de acordo entram pelo mês em que vencem. Tirar todos os
 * filtros grava `filtro=nenhum`, para recarregar e voltar não trazerem o padrão de novo; quem chega com filtro próprio
 * (Início, ficha) fica com o dele. Um aluno só chega pelo
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
  const { pode, recebimentoOnlineHabilitado, kiwifyHabilitada } = useSessao();
  const { avisar } = useAviso();
  const parametros = useLocalSearchParams<{
    situacao?: string; meus?: string; vencimento?: string; de?: string; ate?: string; alunoId?: string; planoId?: string; forma?: string;
    emissaoDe?: string; emissaoAte?: string; pagoDe?: string; pagoAte?: string; mesVencimento?: string; filtro?: string;
  }>();
  const hoje = hojeEmBrasilia();
  // Filtro padrão das cobranças (19/11): sem chave das cobranças no endereço, Ativas e o mês atual.
  const filtros = filtrosDaAbaDeCobrancas(parametros, hoje);
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<CobrancaResponse | null>(null);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [selecao, setSelecao] = useState<CobrancaResponse[]>([]);
  // A revisão tem estado próprio: com sucesso total a seleção esvazia, e o resultado precisa continuar na tela.
  const [revisando, setRevisando] = useState(false);
  const [novaAvulsa, setNovaAvulsa] = useState(false);
  // Fora da barra do lote: cancelar tudo esvazia a seleção e a barra some, mas o resultado continua na tela.
  const [resultadoDoLote, setResultadoDoLote] = useState<ResultadoDaAcao | null>(null);
  // Também fora da barra: renegociar tira as cobranças do aberto, a seleção esvazia e a barra some com a folha aberta.
  const [renegociando, setRenegociando] = useState<CobrancaResponse[] | null>(null);
  const busca = useAtrasado(buscaDigitada.trim(), 300);
  const { fatorTexto } = useTema();
  // A largura da própria lista decide a medida das colunas (folgada ou justa).
  const { largura: larguraDaLista, aoMedir: aoMedirLista } = useFaixaDeLargura();
  const medida = larguraDaLista >= escalar(LARGURA_FOLGADA, fatorTexto) ? FOLGADA : JUSTA;
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
    // Sem nenhum filtro, `filtro=nenhum`: o padrão não volta ao recarregar.
    router.setParams(paraSetParams(CHAVES_DE_COBRANCAS, enderecoDasCobrancas(novos)));
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
          <Texto variante="suave" style={estilos.explicacao}>Mensalidades, cobranças de saída, avulsas e parcelas de acordo dos alunos, por vencimento.</Texto>
          <Botao rotulo="Nova cobrança avulsa" Icone={Plus} aoTocar={() => setNovaAvulsa(true)} />
        </View>
      ) : null}
      {(recebimentoOnlineHabilitado || kiwifyHabilitada) && pode('ALUNO_LER') ? <CartaoDeConferencias podeAlterar={podeAlterar} /> : null}
      {filtros.alunoId ? <FaixaDoAluno nome={textoDoAluno} aoVerTodos={verTodos} /> : null}
      <View ref={barra}>
        <BarraDeFiltros busca={{ valor: buscaDigitada, aoMudar: (t) => { setBuscaDigitada(t); setPagina(0); limparSelecao(); }, placeholder: 'Nome do aluno' }}
          valor={filtros} aoAplicar={aplicar} limpo={limpoDasCobrancas(filtros)} chips={chips}
          aoTirar={(chave) => aplicar(semOFiltroDeCobrancas(filtros, chave as ChaveDoFiltroDeCobrancas))}
          painelLateral={{ titulo: 'Filtros de cobranças' }}
          seletores={(atuais, mudar) => (
            <SeletoresDeCobrancas filtros={atuais} aoMudar={mudar} opcoesDePlano={opcoesDePlano} aluno={atuais.alunoId ? textoDoAluno : null} hoje={hoje} />
          )} />
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {/* Sem resposta (primeira carga ou erro) não há totais: nunca um zero inventado. Lista vazia: o vazio já diz tudo. */}
      {dados?.totais && dados.itens.length > 0 && !lista.erro ? <TotaisDaLista totais={dados.totais} atualizando={desatualizada} /> : null}
      {dados && dados.itens.length === 0 && filtros.mesVencimento ? (
        // Filtro padrão das cobranças (19/11): o mês sem cobrança diz qual mês e oferece os outros, sem tirar a situação.
        <Vazio titulo={`Nenhuma cobrança${saoAsAtivas(filtros.situacoes) ? ' ativa' : ''} em ${rotuloDoMesNumerico(filtros.mesVencimento)}`}
          texto={busca ? 'Nenhum aluno com este nome tem cobrança neste mês. Tente outra busca ou veja todos os meses.'
            : 'Nenhuma cobrança deste filtro vence neste mês. As de outros meses aparecem sem o filtro de mês de vencimento.'}
          acao={{ rotulo: 'Ver todos os meses', aoTocar: () => aplicar(semOFiltroDeCobrancas(filtros, 'mesVencimento')) }} />
      ) : null}
      {dados && dados.itens.length === 0 && !filtros.mesVencimento ? (
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
        <Cartao style={estilos.cartaoLimitado} descricao={desatualizada ? undefined : descricaoDasCobrancas(filtros, hoje, dados.total)}>
          {comLote ? (
            <BarraDoLote lote={lote} pagina={dados.itens}
              aoMarcarPagina={(marcar) => setSelecao((s) => marcarPaginaNoLote(s, dados.itens, marcar))}
              aoLimpar={() => setSelecao([])} aoRevisar={() => setRevisando(true)}
              acoes={(estilo) => (
                <AcoesDoLote lote={lote} comLink={recebimentoOnlineHabilitado} aoResultado={setResultadoDoLote} estilo={estilo} aoRenegociar={setRenegociando}
                  aoCancelar={(cancelados) => {
                    const feitos = new Set(cancelados);
                    setSelecao((s) => s.filter((x) => !feitos.has(x.id)));
                    recarregar();
                  }} />
              )} />
          ) : null}
          <View style={lista.carregando ? estilos.esmaecido : null} pointerEvents={desatualizada ? 'none' : 'auto'}
            onLayout={aoMedirLista}>
            <ListaOuTabela rotulo="Cobranças" linhas={dados.itens} chave={(c) => c.id} aoTocar={setAberta} larguraMinima={LARGURA_DA_TABELA}
              vao={medida === FOLGADA ? FOLGADA.vao : vaoDaJusta(larguraDaLista)} alinharLinhas="topo"
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
                  detalhe: `${temDescricaoPropria(c.tipo) ? `${referenciaDaCobranca(c)} · ` : ''}${resumoDaCobranca(c).replace(/R\$ /g, 'R$\u00a0')}${c.situacao === 'PAGA' && ehPagamentoOnline(c) ? ` · ${ROTULO_ONLINE}` : ''}`,
                  selo: { texto: selo.rotulo, tipo: selo.tom },
                  extra: doTipo ? <View style={estilos.seloDoTipo}><Selo texto={doTipo.rotulo} tipo={doTipo.tom} /></View> : undefined,
                };
              }}
              colunas={[
                { chave: 'id', titulo: 'ID', largura: MINIMOS.id, render: (c) => (
                  <Texto variante="pequeno" numerico numberOfLines={1} accessibilityLabel={`ID terminado em ${idCurtoDaCobranca(c.id)}`}>{idCurtoDaCobranca(c.id)}</Texto>
                ) },
                { chave: 'aluno', titulo: 'Aluno', flex: 2, minimo: medida.aluno, principal: true, render: (c) => <AlunoDaCobranca cobranca={c} /> },
                { chave: 'competencia', titulo: 'Competência', flex: 1, minimo: MINIMOS.competencia, render: (c) => (
                  // A avulsa não tem competência: diz isso, sem "—" (a descrição está na coluna do aluno).
                  c.competencia ? <Texto numerico numberOfLines={1}>{rotuloDoMesNumerico(c.competencia)}</Texto> : <Texto variante="pequeno">Não se aplica</Texto>
                ) },
                { chave: 'vencimento', titulo: 'Vencimento', flex: 1, minimo: MINIMOS.data, render: (c) => <Texto numerico numberOfLines={1}>{dataParaTela(c.vencimento)}</Texto> },
                { chave: 'emissao', titulo: 'Emissão', flex: 1, minimo: MINIMOS.data, render: (c) => <Texto numerico numberOfLines={1}>{dataOuNada(emissaoDaCobranca(c))}</Texto> },
                { chave: 'pagamento', titulo: 'Pagamento', flex: 1, minimo: MINIMOS.data, render: (c) => <PagamentoDaCobranca cobranca={c} /> },
                // Valor nunca corta com reticências: um valor maior que a coluna quebra a linha.
                { chave: 'valor', titulo: 'Valor', flex: 1, minimo: MINIMOS.valor, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto> },
                { chave: 'situacao', titulo: 'Situação', largura: medida.situacao, render: (c) => <SituacaoDaCobranca cobranca={c} /> },
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
      {renegociando ? (
        <FolhaRenegociar cobrancas={renegociando} aoFechar={() => setRenegociando(null)}
          aoMudar={(renegociadas) => {
            const feitas = new Set(renegociadas);
            setSelecao((s) => s.filter((x) => !feitas.has(x.id)));
            recarregar();
          }} />
      ) : null}
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
          {n === 0 ? 'Marque as cobranças em aberto para registrar o pagamento, cancelar, renegociar ou gerar o link de várias de uma vez.'
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
 * endereço é "qualquer data"). Os filtros se combinam (todos valem juntos), menos Mês de vencimento e Vencimento: o mês
 * é o vencimento dentro do mês (só no app, 19/11), então escolher um tira o outro.
 */
function SeletoresDeCobrancas({ filtros, aoMudar, opcoesDePlano, aluno: nomeDoAluno, hoje }: {
  filtros: FiltrosDeCobrancas; aoMudar: (f: FiltrosDeCobrancas) => void; opcoesDePlano: { valor: string; rotulo: string }[];
  hoje: string;
  /** O aluno de quem chegou pela ficha: só leitura aqui (o painel não o muda nem o "Limpar filtros" o tira). */
  aluno: string | null;
}) {
  const doFiltro: ModoDoVencimento = filtros.proximos7Dias ? 'PROXIMOS_7_DIAS' : filtros.periodo.de || filtros.periodo.ate ? 'PERIODO' : 'QUALQUER';
  const [escolhido, setEscolhido] = useState<ModoDoVencimento>(doFiltro);
  // Período vazio com o modo "Escolher período": fica aberto para digitar; o resto segue o filtro.
  const modo = doFiltro === 'QUALQUER' && escolhido === 'PERIODO' ? 'PERIODO' : doFiltro;
  const mudarModo = (m: ModoDoVencimento) => {
    setEscolhido(m);
    aoMudar({
      ...filtros, proximos7Dias: m === 'PROXIMOS_7_DIAS', periodo: m === 'PERIODO' ? filtros.periodo : SEM_FILTROS_DE_COBRANCAS.periodo,
      mesVencimento: m === 'QUALQUER' ? filtros.mesVencimento : null,
    });
  };
  const mudarMesVencimento = (v: string) => {
    if (v === TODOS) { aoMudar({ ...filtros, mesVencimento: null }); return; }
    setEscolhido('QUALQUER');
    aoMudar({ ...filtros, mesVencimento: v, proximos7Dias: false, periodo: SEM_FILTROS_DE_COBRANCAS.periodo });
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
        <View style={estilos.alunoNoPainel}>
          <UmaOpcao rotulo="Mês de vencimento" valor={filtros.mesVencimento ?? TODOS} aoMudar={mudarMesVencimento}
            opcoes={[{ valor: TODOS, rotulo: 'Qualquer' }, ...mesesDoFiltro(hoje, filtros.mesVencimento)]} />
          <Texto variante="pequeno">Pelo mês do vencimento. Avulsas e acordos também entram pelo mês em que vencem.</Texto>
        </View>
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
      {/* Uma linha com reticências: o nome inteiro está no nome da linha (leitor de tela) e na folha. */}
      <Texto variante="bloco" numberOfLines={1}>{cobranca.alunoNome ?? '—'}</Texto>
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
 * Os quatro totais do filtro inteiro (todas as páginas), como o servidor calcula: cancelada, estornada e renegociada ficam
 * fora; "Em aberto" já inclui as vencidas (por isso diz isso, para ninguém somar duas vezes); a contestada entra no total e
 * não em pago nem em aberto, então o total pode passar de pago + em aberto (nenhuma tela soma os dois). Financeiro (19/11):
 * o mesmo `CartaoDeIndicador` da Visão geral, com a cor da pílula da linha: Pago no `sucesso` de "Paga" (e de "Recebido no
 * período"), Em aberto no `atencao` de "Em aberto", Vencido no `perigo` de "Vencida" (e de "Em atraso"), com o ícone de
 * alerta, e Total neutro como "Resultado". Zero fica sem tom (`estado="zero"`), para R$ 0,00 não alarmar nem comemorar.
 * Com o filtro novo a caminho, os números do anterior ficam esmaecidos e marcados como ocupados. Grade de 4, 2 + 2 ou 1.
 */
function TotaisDaLista({ totais, atualizando }: { totais: TotaisDasCobrancas; atualizando: boolean }) {
  const itens: { rotulo: string; centavos: number; tom: TomDoIndicador; detalhe?: string; Icone?: LucideIcon }[] = [
    { rotulo: 'Total', centavos: totais.totalCentavos, tom: 'neutro' },
    { rotulo: 'Pago', centavos: totais.pagoCentavos, tom: 'sucesso' },
    { rotulo: 'Em aberto', centavos: totais.emAbertoCentavos, tom: 'atencao', detalhe: 'Inclui as vencidas' },
    { rotulo: 'Vencido', centavos: totais.vencidoCentavos, tom: 'perigo', Icone: AlertCircle },
  ];
  return (
    <Cartao titulo="Totais" descricao="De todas as páginas deste filtro. Em aberto inclui as vencidas; canceladas, estornadas e renegociadas não entram. Contestadas entram no total, mas não em pago nem em aberto.">
      <View style={atualizando ? estilos.esmaecido : null} aria-busy={atualizando}>
        <GradeDeIndicadores minimo={211}>
          {itens.map((t) => (
            // O "R$" colado ao número: o valor nunca parte em duas linhas.
            <CartaoDeIndicador key={t.rotulo} rotulo={t.rotulo} valor={centavosParaTela(t.centavos).replace('R$ ', 'R$ ')}
              tom={t.tom} estado={t.centavos === 0 ? 'zero' : 'valor'} detalhe={t.detalhe} Icone={t.Icone} tamanho="medio" lugar="cartao" />
          ))}
        </GradeDeIndicadores>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  explicacao: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: LARGURA_FORMULARIO },
  cartaoLimitado: { maxWidth: LARGURA_FAIXA_ULTRALARGA },
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

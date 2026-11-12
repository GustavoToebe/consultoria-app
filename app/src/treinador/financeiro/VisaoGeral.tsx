import { router, useFocusEffect } from 'expo-router';
import { Children, isValidElement, useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { CobrancaResponse, Inadimplente, PaginaInadimplentes } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, listarInadimplentes, painelFinanceiro, visaoGeralDoFinanceiro } from '../../api/rotas';
import {
  ATALHOS_DE_PERIODO, atrasoParaTela, cartoesDoPainel, DEFINICOES_DO_PAINEL, hojeEmBrasilia, inadimplenciaParaTela, LIMITES_DOS_DADOS,
  liquidoParaTela, periodoDoPainel, rotuloDaForma, serieDoGrafico, valorEQuantidadeParaTela, type AtalhoDePeriodo, type CartaoDoPainel,
  NOTA_CONSIDERA_GERADAS,
} from '../../dominio/financeiro';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { contagemParaTela, rotuloDoMes } from '../../dominio/numeros';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { GraficoBarras } from '../../ui/GraficoBarras';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { EscolhaResponsabilidade, type Responsabilidade } from '../EscolhaResponsabilidade';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { ResultadoDoMes } from './ResultadoDoMes';

/**
 * Visão geral do financeiro (`GET /financeiro/painel`, só `FINANCEIRO_LER`). Todo número vem pronto da API em centavos;
 * a tela só formata. Valor nulo aparece como "—" (nunca zero inventado). Inadimplência, previsto e atrasado
 * "consideram as cobranças já geradas". O líquido é "indisponível": nenhuma taxa é descontada nem estimada.
 * Ordem do uso: os números do período, quem está com cobrança vencida (a lista que pede ação), o mês a mês (recebido e
 * movimento), renovações, próximos recebimentos e líquido, o resultado do mês, as quebras (forma e plano) e o "como
 * calculamos". Blocos da mesma linha dividem a largura medida (`LinhaDeBlocos`); sem largura, empilham nessa ordem.
 */
export function VisaoGeral({ escopo, aoMudarEscopo, podeAlterar }: {
  escopo: Responsabilidade;
  aoMudarEscopo: (v: Responsabilidade) => void;
  podeAlterar: boolean;
}) {
  const { avisar } = useAviso();
  const [atalho, setAtalho] = useState<AtalhoDePeriodo>('6m');
  const periodo = useMemo(() => periodoDoPainel(atalho, hojeEmBrasilia()), [atalho]);
  const meus = escopo === 'meus';
  const painel = useCarregar(`painel|${periodo.de}|${periodo.ate}|${meus}`, () => painelFinanceiro({ ...periodo, meus }));
  const atrasados = useCarregar(`inadimplentes|${meus}`, () => listarInadimplentes({ meus, pagina: 0 }));
  // A rota é da consultoria inteira (não filtra por responsável nem por período): com "só os seus alunos" o cartão não aparece.
  // Falhar aqui não derruba a tela; o cartão só fica de fora.
  const renovacoes = useCarregar(meus ? null : 'visao-geral-financeiro', () => visaoGeralDoFinanceiro());
  const [aberta, setAberta] = useState<{ cobranca: CobrancaResponse; emBaixa: boolean } | null>(null);
  const [buscando, setBuscando] = useState<string | null>(null);
  const { recarregar: recarregarPainel } = painel;
  const { recarregar: recarregarAtrasados } = atrasados;
  const { recarregar: recarregarRenovacoes } = renovacoes;
  const dados = painel.dados;
  // Voltando da ficha ou de outra tela, os números são buscados de novo.
  useFocusEffect(useCallback(() => { recarregarPainel(); recarregarAtrasados(); recarregarRenovacoes(); }, [recarregarPainel, recarregarAtrasados, recarregarRenovacoes]));

  // A lista de inadimplentes não traz a versão da cobrança: busca a do aluno para abrir (ou dar a baixa) com ela.
  const abrirCobrancaDe = (i: Inadimplente, emBaixa: boolean) => {
    setBuscando(i.cobrancaId);
    listarCobrancasDoAluno(i.alunoId).then(
      (lista) => {
        setBuscando(null);
        const c = lista.find((x) => x.id === i.cobrancaId);
        if (c) setAberta({ cobranca: c, emBaixa });
        else {
          avisar('Essa cobrança mudou. Recarregamos a lista para você conferir.', 'neutro');
          recarregarAtrasados();
        }
      },
      (e: unknown) => { setBuscando(null); avisar(textoDoErro(e), 'perigo'); },
    );
  };
  const aoMudar = () => { recarregarPainel(); recarregarAtrasados(); };

  return (
    <View style={estilos.coluna}>
      <View style={estilos.filtros}>
        <EscolhaResponsabilidade valor={escopo} aoMudar={aoMudarEscopo} />
        <View style={estilos.caber}>
          <Escolha rotulo="Período" opcoes={ATALHOS_DE_PERIODO} valor={atalho} aoMudar={setAtalho} />
        </View>
      </View>
      {painel.erro ? <MensagemErro texto={textoDoErro(painel.erro)} erro={painel.erro} tentarDeNovo={recarregarPainel} /> : null}
      {!dados && painel.carregando ? <Esqueleto /> : null}
      {dados ? (
        <>
          <Texto variante="suave">
            {dataParaTela(dados.periodo.de)} a {dataParaTela(dados.periodo.ate)}
            {dados.somenteMeus ? ' · só os seus alunos' : ''}. Onde aparece “—”, o número não está disponível.
          </Texto>
          <View style={estilos.indicadores}>
            {cartoesDoPainel(dados.cartoes).map((c) => (
              <Indicador key={c.chave} cartao={c} alerta={c.chave === 'emAtraso' && (dados.cartoes.emAtraso?.valorCentavos ?? 0) > 0} />
            ))}
          </View>
          <Inadimplencia painel={dados.inadimplencia} vencidasNoPeriodo={dados.cartoes.emAtraso?.cobrancas ?? 0} lista={atrasados}
            buscando={buscando} podeAlterar={podeAlterar} aoAbrir={(i) => abrirCobrancaDe(i, false)} aoRegistrar={(i) => abrirCobrancaDe(i, true)} />
          <LinhaDeBlocos nome="mensal" minimo={MINIMO_MENSAL}>
            <Cartao titulo="Recebido e previsto por mês" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`} style={estilos.esticar}>
              {dados.serie.length === 0 ? <Texto variante="suave">Nenhum valor recebido ou previsto no período.</Texto> : <GraficoBarras barras={serieDoGrafico(dados.serie)} />}
            </Cartao>
            <Cartao titulo="Movimento de alunos" descricao="Contratações novas e encerradas em cada mês." style={estilos.esticar}>
              {dados.movimentoDeAlunos.length === 0 ? <Texto variante="suave">Nenhuma contratação nova ou encerrada no período.</Texto> : (
                <Tabela rotulo="Movimento de alunos por mês" linhas={dados.movimentoDeAlunos} chave={(m) => m.mes} larguraMinima={300} colunas={[
                  { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: (m) => <Texto>{rotuloDoMes(m.mes)}</Texto> },
                  { chave: 'novas', titulo: 'Novas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesNovas)}</Texto> },
                  { chave: 'encerradas', titulo: 'Encerradas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesEncerradas)}</Texto> },
                ]} />
              )}
            </Cartao>
          </LinhaDeBlocos>
          <LinhaDeBlocos nome="previsoes" minimo={MINIMO_CARTAO}>
            {/* Com "Meus" a chave fica nula e o `useCarregar` guarda os dados de antes: sem o `!meus`, o número da consultoria ficaria. */}
            {!meus && renovacoes.dados ? (
              <Cartao titulo="Renovações próximas" descricao="Contratações ativas com a vigência vencida ou terminando nos próximos 40 dias." style={estilos.esticar}>
                <CamposEmLinha>
                  <CampoLeitura rotulo="Para renovar" numerico
                    valor={`${renovacoes.dados.renovacoesProximasCount} ${renovacoes.dados.renovacoesProximasCount === 1 ? 'plano' : 'planos'}`} />
                  <CampoLeitura rotulo="Valor dessas renovações" valor={centavosParaTela(renovacoes.dados.renovacoesProximasCentavos)} numerico />
                  <CampoLeitura rotulo="Projeção anual" valor={centavosParaTela(renovacoes.dados.projecaoAnualCentavos)} numerico />
                </CamposEmLinha>
              </Cartao>
            ) : null}
            <Cartao titulo="Próximos recebimentos" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`} style={estilos.esticar}>
              {/* Base maior que a padrão (150): numa terça parte da linha "R$ 450,00 (3 cobranças)" quebrava; assim os dois
                  empilham ali e só ficam lado a lado com o cartão na largura toda. */}
              <CamposEmLinha minimo={200}>
                <CampoLeitura rotulo="Próximos 7 dias" valor={valorEQuantidadeParaTela(dados.proximosRecebimentos.em7Dias)} numerico />
                <CampoLeitura rotulo="Próximos 30 dias" valor={valorEQuantidadeParaTela(dados.proximosRecebimentos.em30Dias)} numerico />
              </CamposEmLinha>
            </Cartao>
            <Liquido liquido={dados.liquido} />
          </LinhaDeBlocos>
          {/* O resultado do mês não acompanha o filtro de período: a pílula junto ao título diz isso antes da descrição. */}
          <ResultadoDoMes resultado={dados.resultadoDoMes} somenteMeus={dados.somenteMeus} periodo="Mês atual" />
          <LinhaDeBlocos nome="quebras" minimo={MINIMO_TABELA}>
            <Cartao titulo="Por forma de pagamento" style={estilos.esticar}>
              {dados.porForma.length === 0 ? <Texto variante="suave">Nenhum pagamento recebido no período.</Texto> : (
                <Tabela rotulo="Recebido por forma de pagamento" linhas={dados.porForma} chave={(f) => f.forma} larguraMinima={300} colunas={[
                  { chave: 'forma', titulo: 'Forma', principal: true, flex: 1.4, render: (f) => <Texto>{rotuloDaForma(f.forma)}</Texto> },
                  { chave: 'cobrancas', titulo: 'Cobranças', alinhar: 'direita', render: (f) => <Texto numerico>{contagemParaTela(f.cobrancas)}</Texto> },
                  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', largura: 110, render: (f) => <Texto numerico>{centavosParaTela(f.valorCentavos)}</Texto> },
                ]} />
              )}
            </Cartao>
            <Cartao titulo="Por plano" style={estilos.esticar}>
              {dados.porPlano.length === 0 ? <Texto variante="suave">Nenhum pagamento recebido no período.</Texto> : (
                <Tabela rotulo="Recebido por plano" linhas={dados.porPlano} chave={(p) => p.planoId} larguraMinima={300} colunas={[
                  { chave: 'plano', titulo: 'Plano', principal: true, flex: 1.4, render: (p) => <Texto numberOfLines={2}>{p.nome}</Texto> },
                  { chave: 'cobrancas', titulo: 'Cobranças', alinhar: 'direita', render: (p) => <Texto numerico>{contagemParaTela(p.cobrancas)}</Texto> },
                  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', largura: 110, render: (p) => <Texto numerico>{centavosParaTela(p.valorCentavos)}</Texto> },
                ]} />
              )}
            </Cartao>
          </LinhaDeBlocos>
          <Cartao titulo="Como calculamos estes números" recolhivel recolhido>
            <ComoCalculamos />
          </Cartao>
        </>
      ) : null}
      <FolhaDaCobranca cobranca={aberta?.cobranca ?? null} podeAlterar={podeAlterar} abrirEmBaixa={aberta?.emBaixa} mostrarFicha
        aoFechar={() => setAberta(null)} aoMudar={aoMudar} />
    </View>
  );
}

/**
 * Um número do período: rótulo, valor grande e a nota pequena. Só "Em atraso" acende (borda vermelha à esquerda), e só
 * com valor: cor com significado, nunca a marca. Os seis cabem três por linha no PC e dois no celular.
 */
function Indicador({ cartao, alerta }: { cartao: CartaoDoPainel; alerta: boolean }) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  // Base larga no PC (três ou mais por linha, nunca quatro e dois) e estreita no celular (dois por linha).
  const base = width < LARGURA_MENU_LATERAL ? 150 : 280;
  return (
    <View accessibilityLabel={`${cartao.titulo}: ${cartao.valor}${cartao.detalhe ? `. ${cartao.detalhe}` : ''}`}
      style={[estilos.indicador, { flexBasis: base, backgroundColor: cores.superficie, borderColor: alerta ? cores.perigo : cores.borda, borderLeftWidth: alerta ? 4 : 1 }]}>
      <Texto variante="suave" nivel={2}>{cartao.titulo}</Texto>
      <Texto variante="destaque" numerico style={[width < LARGURA_MENU_LATERAL ? estilos.valorCelular : null, alerta ? { color: cores.perigo } : null]}>{cartao.valor}</Texto>
      {cartao.detalhe ? <Texto variante="pequeno">{cartao.detalhe}</Texto> : null}
    </View>
  );
}

/**
 * Blocos de uma linha, pela largura medida do próprio contêiner (que já desconta o menu lateral): lado a lado e com a
 * mesma largura só quando todos cabem com `minimo` cada; senão um por linha, na mesma ordem. Nunca sobra coluna vazia:
 * dois dividem a linha ao meio e três que não cabem empilham, em vez de deixar um sozinho embaixo. Bloco ausente (`null`)
 * não ocupa lugar. Antes da medida, uma coluna.
 */
function LinhaDeBlocos({ nome, minimo, children }: { nome: string; minimo: number; children: ReactNode }) {
  const [largura, setLargura] = useState(0);
  const itens = Children.toArray(children);
  const lado = itens.length > 1 && largura >= minimo * itens.length + VAO * (itens.length - 1);
  return (
    <View testID={`linha-${nome}`} onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={[lado ? estilos.linha : null, { gap: VAO }]}>
      {/* Mesma árvore empilhada e lado a lado (a chave é a do filho): mudar de largura não remonta o gráfico nem a tabela. */}
      {itens.map((item, i) => (
        <View key={isValidElement(item) ? item.key : i} testID={`linha-${nome}-${i}`} style={lado ? estilos.celula : null}>{item}</View>
      ))}
    </View>
  );
}

/**
 * Corpo de "Como calculamos estes números": um glossário (o nome do indicador em destaque e a explicação embaixo; são
 * definições, não passos, então sem número) em duas colunas quando o cartão tem largura e, depois de uma divisória, as
 * regras que valem para vários números ao mesmo tempo.
 */
function ComoCalculamos() {
  const { cores, bordas } = useTema();
  const [largura, setLargura] = useState(0);
  const celula = largura >= LARGURA_GLOSSARIO_DUAS ? (largura - VAO_GLOSSARIO) / 2 : undefined;
  return (
    <>
      <View testID="glossario" onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={estilos.glossario}>
        {DEFINICOES_DO_PAINEL.map((d) => (
          <View key={d.termo} style={[estilos.definicao, celula === undefined ? estilos.inteira : { width: celula }]}>
            <Texto variante="subtitulo">{d.termo}</Texto>
            <Texto variante="suave">{d.explicacao}</Texto>
          </View>
        ))}
      </View>
      <View style={{ height: bordas.bloco, backgroundColor: cores.divisor }} />
      <View style={estilos.limites}>
        <Texto variante="subtitulo" nivel={3}>Períodos e limites dos dados</Texto>
        {LIMITES_DOS_DADOS.map((t) => <Texto key={t} variante="suave">{t}</Texto>)}
      </View>
    </>
  );
}

/** Líquido: sempre "indisponível" por enquanto. Cartão pequeno, ao lado dos próximos recebimentos: não é um número da tela. */
function Liquido({ liquido }: { liquido: Parameters<typeof liquidoParaTela>[0] }) {
  const l = liquidoParaTela(liquido);
  return (
    <Cartao titulo="Líquido para você" style={estilos.esticar}>
      <Texto variante="bloco">{l.valor}</Texto>
      <Texto variante="suave">{l.detalhe}</Texto>
    </Cartao>
  );
}

/**
 * Inadimplência e a fila de quem está com cobrança vencida. No PC é tabela com "Registrar pagamento" (atalho, abre a
 * cobrança já no formulário) e "Abrir ficha"; no celular cada linha é um item que abre a cobrança, onde ficam os mesmos
 * botões (na tabela empilhada os dois botões espremiam o nome do aluno).
 */
function Inadimplencia({ painel, vencidasNoPeriodo, lista, buscando, podeAlterar, aoAbrir, aoRegistrar }: {
  painel: Parameters<typeof inadimplenciaParaTela>[0];
  /** Quantas cobranças entram no vencido do período (a API conta as mesmas do "Em atraso"). */
  vencidasNoPeriodo: number;
  lista: { dados?: PaginaInadimplentes; erro?: unknown; recarregar: () => void };
  buscando: string | null;
  podeAlterar: boolean;
  aoAbrir: (i: Inadimplente) => void;
  aoRegistrar: (i: Inadimplente) => void;
}) {
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_MENU_LATERAL;
  const i = inadimplenciaParaTela(painel);
  const itens = lista.dados?.itens ?? [];
  const temBase = !!painel && painel.percentual !== null && painel.vencidoCentavos !== null && painel.cobradoCentavos !== null;
  const quantas = vencidasNoPeriodo > 0 ? ` · ${contagemParaTela(vencidasNoPeriodo)} ${vencidasNoPeriodo === 1 ? 'cobrança' : 'cobranças'}` : '';
  // A lista não tem filtro de período: quando ela traz o mesmo conjunto do resumo, repetir quantidade e valor só alonga o
  // cartão; quando traz mais (vencidas antes do período), a frase diz que a base é outra.
  const outraBase = !!lista.dados && lista.dados.total > 0
    && (lista.dados.total !== vencidasNoPeriodo || lista.dados.valorTotalCentavos !== (painel?.vencidoCentavos ?? null));
  return (
    <Cartao titulo="Inadimplência e cobranças vencidas" descricao={i.detalhe}>
      {/* Resumo compacto, tudo do mesmo conjunto (vencidas no período): percentual, valor de quanto venceu e quantidade. */}
      <View style={estilos.resumo} accessible accessibilityLabel={`Inadimplência: ${i.comBase}${quantas}`}>
        <Texto variante="destaque" numerico>{i.percentual}</Texto>
        {temBase && painel ? (
          <Texto numerico>{`${centavosParaTela(painel.vencidoCentavos)} de ${centavosParaTela(painel.cobradoCentavos)}${quantas}`}</Texto>
        ) : null}
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {lista.dados?.total === 0 ? <Texto variante="suave">Nenhuma cobrança vencida em aberto.</Texto> : null}
      {outraBase && lista.dados ? (
        <Texto variante="suave">
          A lista abaixo traz todas as vencidas em aberto, de qualquer data, não só as do período.
        </Texto>
      ) : null}
      {itens.length > 0 && celular ? (
        <View accessibilityRole="list" accessibilityLabel="Cobranças vencidas em aberto" style={estilos.lista}>
          {itens.map((x) => (
            <ItemDeLista key={x.cobrancaId} titulo={x.alunoNome ?? '—'}
              detalhe={`${centavosParaTela(x.valorCentavos)} · venceu ${dataSemAnoCorrente(x.vencimento, hojeEmBrasilia())} · ${atrasoParaTela(x.diasDeAtraso)}`}
              aoTocar={() => aoAbrir(x)} rotulo={`Abrir cobrança vencida de ${x.alunoNome ?? 'aluno'}`} />
          ))}
        </View>
      ) : null}
      {itens.length > 0 && !celular ? (
        <Tabela rotulo="Cobranças vencidas em aberto" linhas={itens} chave={(x) => x.cobrancaId} larguraMinima={600} colunas={[
          { chave: 'aluno', titulo: 'Aluno', principal: true, flex: 1.6, render: (x) => <Texto variante="bloco" numberOfLines={2}>{x.alunoNome ?? '—'}</Texto> },
          { chave: 'valor', titulo: 'Valor', alinhar: 'direita', flex: 1, render: (x) => <Texto numerico>{centavosParaTela(x.valorCentavos)}</Texto> },
          { chave: 'vencimento', titulo: 'Venceu em', flex: 1, render: (x) => <Texto numerico>{dataParaTela(x.vencimento)}</Texto> },
          { chave: 'atraso', titulo: 'Atraso', flex: 1, render: (x) => <Texto>{atrasoParaTela(x.diasDeAtraso)}</Texto> },
          { chave: 'acoes', titulo: 'Ações', acao: true, largura: 330, render: (x) => (
            <LinhaDeAcoes alinhar="fim">
              {podeAlterar ? <Botao rotulo="Registrar pagamento" tipo="secundario" carregando={buscando === x.cobrancaId}
                rotuloAcessivel={`Registrar pagamento de ${x.alunoNome ?? 'aluno'}`} aoTocar={() => aoRegistrar(x)} /> : null}
              <Botao rotulo="Abrir ficha" tipo="fantasma" rotuloAcessivel={`Abrir ficha de ${x.alunoNome ?? 'aluno'}`}
                aoTocar={() => router.push(`/treinador/alunos/${x.alunoId}?aba=ficha`)} />
            </LinhaDeAcoes>
          ) },
        ]} />
      ) : null}
    </Cartao>
  );
}

const VAO = espaco(2);
/**
 * Largura mínima de cada bloco para ficar lado a lado. Mensal: o gráfico vira tabela abaixo de 420 px de desenho
 * (`GraficoBarras`), e 480 por cartão o mantém de pé com o recuo. Tabela das quebras: a `Tabela` empilha abaixo de 300
 * e 372 é a metade da grade de 760 das telas vizinhas (`dominio/grade`). Cartões de resumo (renovações, próximos,
 * líquido): com 360 cada, dois campos ainda cabem lado a lado; em 1280 px de janela (~1000 de conteúdo) os três empilham.
 */
const MINIMO_MENSAL = 480;
const MINIMO_TABELA = 372;
const MINIMO_CARTAO = 360;
/** O glossário passa a duas colunas quando cada uma tem ao menos ~270 px: a explicação não quebra palavra a palavra. */
const LARGURA_GLOSSARIO_DUAS = 560;
const VAO_GLOSSARIO = espaco(3);

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  linha: { flexDirection: 'row', alignItems: 'stretch' },
  celula: { flex: 1, minWidth: 0 },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  glossario: { flexDirection: 'row', flexWrap: 'wrap', columnGap: VAO_GLOSSARIO, rowGap: espaco(2) },
  definicao: { gap: espaco(0.5) },
  inteira: { width: '100%' },
  limites: { gap: espaco(1) },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  caber: { flexShrink: 1, maxWidth: '100%' },
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  indicador: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: espaco(0.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  lista: { gap: espaco(1) },
  // No celular o tile tem ~140 px úteis: 20 px ainda cabe "R$ 1.200,00" numa linha.
  valorCelular: { fontSize: 20, lineHeight: 26 },
  esticar: { flexGrow: 1 },
});

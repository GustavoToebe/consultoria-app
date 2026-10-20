import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { CobrancaResponse, Inadimplente, PaginaInadimplentes } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, listarInadimplentes, painelFinanceiro } from '../../api/rotas';
import {
  ATALHOS_DE_PERIODO, atrasoParaTela, cartoesDoPainel, COMO_CALCULAMOS, hojeEmBrasilia, inadimplenciaParaTela, liquidoParaTela,
  periodoDoPainel, rotuloDaForma, serieDoGrafico, valorEQuantidadeParaTela, type AtalhoDePeriodo, type CartaoDoPainel, NOTA_CONSIDERA_GERADAS,
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
import { Grade } from '../../ui/Grade';
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
 * Ordem do uso: os números do período, quem está com cobrança vencida (a lista que pede ação), o mês a mês e os
 * próximos recebimentos, o resultado do mês e, por fim, as quebras (forma, plano, movimento) e o "como calculamos".
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
  const [aberta, setAberta] = useState<{ cobranca: CobrancaResponse; emBaixa: boolean } | null>(null);
  const [buscando, setBuscando] = useState<string | null>(null);
  const { recarregar: recarregarPainel } = painel;
  const { recarregar: recarregarAtrasados } = atrasados;
  const dados = painel.dados;
  // Voltando da ficha ou de outra tela, os números são buscados de novo.
  useFocusEffect(useCallback(() => { recarregarPainel(); recarregarAtrasados(); }, [recarregarPainel, recarregarAtrasados]));

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
          <Inadimplencia painel={dados.inadimplencia} lista={atrasados} buscando={buscando} podeAlterar={podeAlterar}
            aoAbrir={(i) => abrirCobrancaDe(i, false)} aoRegistrar={(i) => abrirCobrancaDe(i, true)} />
          <Cartao titulo="Recebido e previsto por mês" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`}>
            {dados.serie.length === 0 ? <Texto variante="suave">Nenhum valor recebido ou previsto no período.</Texto> : <GraficoBarras barras={serieDoGrafico(dados.serie)} />}
          </Cartao>
          <Grade gap={espaco(2)}>
            <Cartao titulo="Próximos recebimentos" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`} style={estilos.esticar}>
              <CamposEmLinha>
                <CampoLeitura rotulo="Próximos 7 dias" valor={valorEQuantidadeParaTela(dados.proximosRecebimentos.em7Dias)} numerico />
                <CampoLeitura rotulo="Próximos 30 dias" valor={valorEQuantidadeParaTela(dados.proximosRecebimentos.em30Dias)} numerico />
              </CamposEmLinha>
            </Cartao>
            <Liquido liquido={dados.liquido} />
          </Grade>
          <ResultadoDoMes resultado={dados.resultadoDoMes} somenteMeus={dados.somenteMeus} />
          <Grade gap={espaco(2)}>
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
          </Grade>
          <Cartao titulo="Movimento de alunos" descricao="Contratações novas e encerradas em cada mês.">
            {dados.movimentoDeAlunos.length === 0 ? <Texto variante="suave">Nenhuma contratação nova ou encerrada no período.</Texto> : (
              <Tabela rotulo="Movimento de alunos por mês" linhas={dados.movimentoDeAlunos} chave={(m) => m.mes} larguraMinima={300} colunas={[
                { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: (m) => <Texto>{rotuloDoMes(m.mes)}</Texto> },
                { chave: 'novas', titulo: 'Novas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesNovas)}</Texto> },
                { chave: 'encerradas', titulo: 'Encerradas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesEncerradas)}</Texto> },
              ]} />
            )}
          </Cartao>
          <Cartao titulo="Como calculamos estes números" recolhivel recolhido>
            {COMO_CALCULAMOS.map((linha) => <Texto key={linha} variante="suave">{linha}</Texto>)}
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
function Inadimplencia({ painel, lista, buscando, podeAlterar, aoAbrir, aoRegistrar }: {
  painel: Parameters<typeof inadimplenciaParaTela>[0];
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
  return (
    <Cartao titulo="Inadimplência" descricao={i.detalhe}
      acoes={<Texto variante="destaque" numerico accessibilityLabel={`Inadimplência: ${i.percentual}`}>{i.percentual}</Texto>}>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {lista.dados ? (
        <Texto variante="rotulo">
          {lista.dados.total === 0 ? 'Nenhuma cobrança vencida em aberto.' : `${lista.dados.total} ${lista.dados.total === 1 ? 'cobrança vencida' : 'cobranças vencidas'}, ${centavosParaTela(lista.dados.valorTotalCentavos)} no total`}
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
                aoTocar={() => router.push(`/treinador/alunos/${x.alunoId}`)} />
            </LinhaDeAcoes>
          ) },
        ]} />
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  caber: { flexShrink: 1, maxWidth: '100%' },
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  indicador: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: espaco(0.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  lista: { gap: espaco(1) },
  // No celular o tile tem ~140 px úteis: 20 px ainda cabe "R$ 1.200,00" numa linha.
  valorCelular: { fontSize: 20, lineHeight: 26 },
  esticar: { flexGrow: 1 },
});

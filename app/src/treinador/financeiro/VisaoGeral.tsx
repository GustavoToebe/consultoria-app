import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse, Inadimplente, PaginaInadimplentes } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, listarInadimplentes, painelFinanceiro } from '../../api/rotas';
import {
  ATALHOS_DE_PERIODO, atrasoParaTela, cartoesDoPainel, COMO_CALCULAMOS, hojeEmBrasilia, inadimplenciaParaTela, liquidoParaTela,
  periodoDoPainel, rotuloDaForma, serieDoGrafico, valorEQuantidadeParaTela, type AtalhoDePeriodo, NOTA_CONSIDERA_GERADAS,
} from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { contagemParaTela, rotuloDoMes } from '../../dominio/numeros';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { GraficoBarras } from '../../ui/GraficoBarras';
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
  const [baixa, setBaixa] = useState<CobrancaResponse | null>(null);
  const [buscando, setBuscando] = useState<string | null>(null);
  const { recarregar: recarregarPainel } = painel;
  const { recarregar: recarregarAtrasados } = atrasados;
  const dados = painel.dados;
  // Voltando da ficha ou de outra tela, os números são buscados de novo.
  useFocusEffect(useCallback(() => { recarregarPainel(); recarregarAtrasados(); }, [recarregarPainel, recarregarAtrasados]));

  // A lista de inadimplentes não traz a versão da cobrança: busca a do aluno para dar a baixa com ela.
  const registrarPagamentoDe = (i: Inadimplente) => {
    setBuscando(i.cobrancaId);
    listarCobrancasDoAluno(i.alunoId).then(
      (lista) => {
        setBuscando(null);
        const c = lista.find((x) => x.id === i.cobrancaId);
        if (c) setBaixa(c);
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
          <Grade>
            {cartoesDoPainel(dados.cartoes).map((c) => (
              <Cartao key={c.chave} titulo={c.titulo}>
                <Texto variante="destaque" numerico>{c.valor}</Texto>
                {c.detalhe ? <Texto variante="pequeno">{c.detalhe}</Texto> : null}
              </Cartao>
            ))}
          </Grade>
          <Cartao titulo="Recebido e previsto por mês" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`}>
            <GraficoBarras barras={serieDoGrafico(dados.serie)} />
          </Cartao>
          <Liquido liquido={dados.liquido} />
          <ResultadoDoMes resultado={dados.resultadoDoMes} somenteMeus={dados.somenteMeus} />
          <Inadimplencia painel={dados.inadimplencia} lista={atrasados} buscando={buscando} podeAlterar={podeAlterar}
            aoRegistrar={registrarPagamentoDe} />
          <Grade>
            <Cartao titulo="Por forma de pagamento">
              <Tabela rotulo="Recebido por forma de pagamento" linhas={dados.porForma} chave={(f) => f.forma} larguraMinima={300} colunas={[
                { chave: 'forma', titulo: 'Forma', principal: true, flex: 1.4, render: (f) => <Texto>{rotuloDaForma(f.forma)}</Texto> },
                { chave: 'cobrancas', titulo: 'Cobranças', alinhar: 'direita', render: (f) => <Texto numerico>{contagemParaTela(f.cobrancas)}</Texto> },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (f) => <Texto numerico>{centavosParaTela(f.valorCentavos)}</Texto> },
              ]} />
              {dados.porForma.length === 0 ? <Texto variante="suave">Nenhum pagamento recebido no período.</Texto> : null}
            </Cartao>
            <Cartao titulo="Por plano">
              <Tabela rotulo="Recebido por plano" linhas={dados.porPlano} chave={(p) => p.planoId} larguraMinima={300} colunas={[
                { chave: 'plano', titulo: 'Plano', principal: true, flex: 1.4, render: (p) => <Texto numberOfLines={2}>{p.nome}</Texto> },
                { chave: 'cobrancas', titulo: 'Cobranças', alinhar: 'direita', render: (p) => <Texto numerico>{contagemParaTela(p.cobrancas)}</Texto> },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (p) => <Texto numerico>{centavosParaTela(p.valorCentavos)}</Texto> },
              ]} />
              {dados.porPlano.length === 0 ? <Texto variante="suave">Nenhum pagamento recebido no período.</Texto> : null}
            </Cartao>
          </Grade>
          <Cartao titulo="Movimento de alunos" descricao="Contratações novas e encerradas em cada mês.">
            <Tabela rotulo="Movimento de alunos por mês" linhas={dados.movimentoDeAlunos} chave={(m) => m.mes} larguraMinima={300} colunas={[
              { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: (m) => <Texto>{rotuloDoMes(m.mes)}</Texto> },
              { chave: 'novas', titulo: 'Novas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesNovas)}</Texto> },
              { chave: 'encerradas', titulo: 'Encerradas', alinhar: 'direita', render: (m) => <Texto numerico>{contagemParaTela(m.contratacoesEncerradas)}</Texto> },
            ]} />
          </Cartao>
          <Cartao titulo="Próximos recebimentos" descricao={`O previsto ${NOTA_CONSIDERA_GERADAS}.`}>
            <Grade>
              <View accessibilityLabel={`Próximos 7 dias: ${valorEQuantidadeParaTela(dados.proximosRecebimentos.em7Dias)}`}>
                <Texto variante="rotulo">Próximos 7 dias</Texto>
                <Texto numerico>{valorEQuantidadeParaTela(dados.proximosRecebimentos.em7Dias)}</Texto>
              </View>
              <View accessibilityLabel={`Próximos 30 dias: ${valorEQuantidadeParaTela(dados.proximosRecebimentos.em30Dias)}`}>
                <Texto variante="rotulo">Próximos 30 dias</Texto>
                <Texto numerico>{valorEQuantidadeParaTela(dados.proximosRecebimentos.em30Dias)}</Texto>
              </View>
            </Grade>
          </Cartao>
          <Cartao titulo="Como calculamos estes números" recolhivel recolhido>
            {COMO_CALCULAMOS.map((linha) => <Texto key={linha} variante="suave">{linha}</Texto>)}
          </Cartao>
        </>
      ) : null}
      <FolhaDaCobranca cobranca={baixa} podeAlterar={podeAlterar} abrirEmBaixa aoFechar={() => setBaixa(null)} aoMudar={aoMudar} />
    </View>
  );
}

function Liquido({ liquido }: { liquido: Parameters<typeof liquidoParaTela>[0] }) {
  const l = liquidoParaTela(liquido);
  return (
    <Cartao titulo="Líquido para você">
      <Texto variante="destaque">{l.valor}</Texto>
      <Texto variante="suave">{l.detalhe}</Texto>
    </Cartao>
  );
}

function Inadimplencia({ painel, lista, buscando, podeAlterar, aoRegistrar }: {
  painel: Parameters<typeof inadimplenciaParaTela>[0];
  lista: { dados?: PaginaInadimplentes; erro?: unknown; recarregar: () => void };
  buscando: string | null;
  podeAlterar: boolean;
  aoRegistrar: (i: Inadimplente) => void;
}) {
  const i = inadimplenciaParaTela(painel);
  const itens = lista.dados?.itens ?? [];
  return (
    <Cartao titulo="Inadimplência" descricao={NOTA_CONSIDERA_GERADAS}>
      <Texto variante="destaque" numerico>{i.percentual}</Texto>
      <Texto variante="suave">{i.detalhe}</Texto>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
      {lista.dados ? (
        <>
          <Texto variante="rotulo">
            {lista.dados.total === 0 ? 'Nenhuma cobrança vencida em aberto.' : `${lista.dados.total} ${lista.dados.total === 1 ? 'cobrança vencida' : 'cobranças vencidas'}, ${centavosParaTela(lista.dados.valorTotalCentavos)} no total`}
          </Texto>
          {itens.length > 0 ? (
            <Tabela rotulo="Cobranças vencidas em aberto" linhas={itens} chave={(x) => x.cobrancaId} larguraMinima={760} colunas={[
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
        </>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  caber: { flexShrink: 1, maxWidth: '100%' },
});

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse } from '../../api/financeiroTipos';
import { listarCobrancas } from '../../api/rotas';
import {
  atrasoParaTela, ehPagamentoOnline, FILTROS_DE_SITUACAO, hojeEmBrasilia, resumoDaCobranca, ROTULO_ONLINE, rotuloDaForma, seloDaCobranca,
} from '../../dominio/financeiro';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  CHAVES_DE_COBRANCAS, chaveDasCobrancas, chipsDasCobrancas, cobrancasParaEndereco, descricaoDasCobrancas, lerCobrancasDoEndereco,
  SEM_FILTROS_DE_COBRANCAS, semOFiltroDeCobrancas, temVencimento, textoDoVencimento, vencimentoDaApi,
  type ChaveDoFiltroDeCobrancas, type FiltrosDeCobrancas,
} from '../../dominio/filtrosDoFinanceiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { OPCOES_RESPONSABILIDADE } from '../EscolhaResponsabilidade';
import { CamposDePeriodo, CelulaDoFiltro } from '../SeletoresDeFiltro';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { CartaoDeConferencias } from './CartaoDeConferencias';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { ListaOuTabela } from './ListaOuTabela';

const TAMANHO_PAGINA = 50;

/**
 * Cobranças dos alunos, por vencimento. "Vencidas" é só um filtro (a API decide pela data de Brasília); "Em aberto"
 * inclui as vencidas. Tocar na linha abre a cobrança, com Registrar pagamento, Desfazer e Cancelar para quem pode alterar.
 * No topo, com o recebimento online ligado, "Pagamentos para conferir" (só aparece quando há algum). Cobrança paga pelo
 * provedor leva o selo "Online". Na barra de filtros (`docs/planos/filtros-nas-listas.md`, D7): responsável, situação e
 * vencimento (próximos 7 dias ou um período), no endereço junto do `?aba=cobrancas` (`?meus=true&situacao=&vencimento=
 * PROXIMOS_7_DIAS` ou `&de=&ate=`), como os mini-cartões do Início abrem. Valor desconhecido no endereço é ignorado.
 */
export function AbaCobrancas({ podeAlterar }: { podeAlterar: boolean }) {
  const { pode, recebimentoOnlineHabilitado } = useSessao();
  const parametros = useLocalSearchParams<{ situacao?: string; meus?: string; vencimento?: string; de?: string; ate?: string }>();
  const filtros = lerCobrancasDoEndereco(parametros);
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<CobrancaResponse | null>(null);
  const hoje = hojeEmBrasilia();
  const vencimento = vencimentoDaApi(filtros, hoje);
  const lista = useCarregar(`cobrancas|${chaveDasCobrancas(filtros)}|${hoje}|${pagina}`, () =>
    listarCobrancas({ situacao: filtros.situacao, meus: filtros.meus, pagina, ...vencimento }));
  // Trocar um filtro troca o endereço sem empilhar histórico (a aba fica) e volta à página 1.
  const aplicar = (novos: FiltrosDeCobrancas) => {
    setPagina(0);
    router.setParams(paraSetParams(CHAVES_DE_COBRANCAS, cobrancasParaEndereco(novos)));
  };
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const chips = chipsDasCobrancas(filtros, hoje);

  return (
    <View style={estilos.coluna}>
      {recebimentoOnlineHabilitado && pode('ALUNO_LER') ? <CartaoDeConferencias podeAlterar={podeAlterar} /> : null}
      <BarraDeFiltros valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS_DE_COBRANCAS} chips={chips}
        aoTirar={(chave) => aplicar(semOFiltroDeCobrancas(filtros, chave as ChaveDoFiltroDeCobrancas))} rotuloDoResultado="Ver cobranças"
        seletores={(atuais, mudar) => <SeletoresDeCobrancas filtros={atuais} aoMudar={mudar} />} />
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio titulo="Nenhuma cobrança nesta lista"
          texto={temVencimento(filtros) ? `Nenhuma cobrança${filtros.situacao === 'TODAS' ? '' : ' nesta situação'} vence ${textoDoVencimento(filtros, hoje)}.`
            : filtros.situacao === 'TODAS' && !filtros.meus ? 'As cobranças aparecem quando um aluno tem um plano comercial contratado na ficha.' : 'Tente outro filtro.'}
          acao={chips.length ? { rotulo: 'Limpar filtros', aoTocar: () => aplicar(SEM_FILTROS_DE_COBRANCAS) } : undefined} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={descricaoDasCobrancas(filtros, hoje, dados.total)}>
          <View style={lista.carregando ? estilos.esmaecido : null}>
            <ListaOuTabela rotulo="Cobranças" linhas={dados.itens} chave={(c) => c.id} aoTocar={setAberta}
              rotuloDaLinha={(c) => `Abrir cobrança de ${c.alunoNome ?? 'aluno'}`}
              item={(c) => {
                const selo = seloDaCobranca(c);
                return {
                  titulo: c.alunoNome ?? '—',
                  detalhe: `${resumoDaCobranca(c)}${c.situacao === 'PAGA' && ehPagamentoOnline(c) ? ` · ${ROTULO_ONLINE}` : ''}`,
                  selo: { texto: selo.rotulo, tipo: selo.tom },
                };
              }}
              colunas={[
                { chave: 'aluno', titulo: 'Aluno', flex: 1.6, principal: true, render: (c) => <Texto variante="bloco" numberOfLines={2}>{c.alunoNome ?? '—'}</Texto> },
                { chave: 'plano', titulo: 'Plano', flex: 1.2, render: (c) => <Texto numberOfLines={2}>{c.planoNome ?? '—'}</Texto> },
                { chave: 'competencia', titulo: 'Competência', flex: 1, render: (c) => <Texto numerico>{rotuloDoMes(c.competencia)}</Texto> },
                { chave: 'vencimento', titulo: 'Vencimento', flex: 1, render: (c) => <Texto numerico>{dataParaTela(c.vencimento)}</Texto> },
                { chave: 'valor', titulo: 'Valor', flex: 1, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto> },
                { chave: 'situacao', titulo: 'Situação', flex: 1.4, render: (c) => <SituacaoDaCobranca cobranca={c} /> },
                { chave: 'forma', titulo: 'Forma', flex: 1, render: (c) => <Texto>{c.situacao === 'PAGA' ? rotuloDaForma(c.forma) : '—'}</Texto> },
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
      <FolhaDaCobranca cobranca={aberta} podeAlterar={podeAlterar} mostrarFicha aoFechar={() => setAberta(null)} aoMudar={recarregar} />
    </View>
  );
}

type ModoDoVencimento = 'QUALQUER' | 'PROXIMOS_7_DIAS' | 'PERIODO';
const MODOS_DO_VENCIMENTO: { valor: ModoDoVencimento; rotulo: string }[] = [
  { valor: 'QUALQUER', rotulo: 'Qualquer data' },
  { valor: 'PROXIMOS_7_DIAS', rotulo: 'Próximos 7 dias' },
  { valor: 'PERIODO', rotulo: 'Escolher período' },
];

/**
 * Seletores das cobranças: responsável (Todos/Meus), situação e vencimento. "Escolher período" abre os campos De/Até; o
 * modo fica aqui enquanto o período está vazio (vazio no endereço é "qualquer data").
 */
function SeletoresDeCobrancas({ filtros, aoMudar }: { filtros: FiltrosDeCobrancas; aoMudar: (f: FiltrosDeCobrancas) => void }) {
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
      <CelulaDoFiltro>
        <Escolha rotulo="Responsável" opcoes={OPCOES_RESPONSABILIDADE} valor={filtros.meus ? 'meus' : 'todos'} aoMudar={(v) => aoMudar({ ...filtros, meus: v === 'meus' })} />
      </CelulaDoFiltro>
      <CelulaDoFiltro>
        <View style={estilos.caber}>
          <Escolha rotulo="Situação" opcoes={FILTROS_DE_SITUACAO} valor={filtros.situacao} aoMudar={(situacao) => aoMudar({ ...filtros, situacao })} />
        </View>
      </CelulaDoFiltro>
      <CelulaDoFiltro>
        <View style={estilos.coluna}>
          <Escolha rotulo="Vencimento" opcoes={MODOS_DO_VENCIMENTO} valor={modo} aoMudar={mudarModo} />
          {modo === 'PERIODO' ? <CamposDePeriodo rotulo="Vencimento entre" valor={filtros.periodo} aoMudar={(periodo) => aoMudar({ ...filtros, proximos7Dias: false, periodo })} /> : null}
        </View>
      </CelulaDoFiltro>
    </>
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
  caber: { flexShrink: 1, maxWidth: '100%' },
  esmaecido: { opacity: 0.6 },
  selos: { gap: espaco(0.25) },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});

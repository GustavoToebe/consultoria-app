import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse, FiltroDeSituacao } from '../../api/financeiroTipos';
import { listarCobrancas } from '../../api/rotas';
import {
  atrasoParaTela, ehPagamentoOnline, FILTROS_DE_SITUACAO, hojeEmBrasilia, resumoDaCobranca, ROTULO_ONLINE, rotuloDaForma, seloDaCobranca,
} from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela, somarDias } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { EscolhaResponsabilidade, type Responsabilidade } from '../EscolhaResponsabilidade';
import { FiltroDoEndereco } from '../FiltroDoEndereco';
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
/** `?vencimento=PROXIMOS_7_DIAS` (mini-cartão "Vencendo" do Início): vencimento de hoje a hoje + 7, a mesma janela do painel. */
const PROXIMOS_7_DIAS = 'PROXIMOS_7_DIAS';
const DIAS_DA_JANELA = 7;

/**
 * Cobranças dos alunos, por vencimento. "Vencidas" é só um filtro (a API decide pela data de Brasília); "Em aberto"
 * inclui as vencidas. Tocar na linha abre a cobrança, com Registrar pagamento, Desfazer e Cancelar para quem pode alterar.
 * No topo, com o recebimento online ligado, "Pagamentos para conferir" (só aparece quando há algum). Cobrança paga pelo
 * provedor leva o selo "Online". Do endereço vêm a situação inicial (`?situacao=`, valor desconhecido = Todas) e a janela de
 * vencimento dos próximos 7 dias (`?vencimento=PROXIMOS_7_DIAS`), que aparece numa faixa com "Limpar filtro" e soma com
 * qualquer situação e com o Todos/Meus.
 */
export function AbaCobrancas({ escopo, aoMudarEscopo, podeAlterar, situacaoInicial, vencimento }: {
  escopo: Responsabilidade;
  aoMudarEscopo: (v: Responsabilidade) => void;
  podeAlterar: boolean;
  situacaoInicial?: string;
  vencimento?: string;
}) {
  const { pode, recebimentoOnlineHabilitado } = useSessao();
  const [filtro, setFiltro] = useState<FiltroDeSituacao>(FILTROS_DE_SITUACAO.find((f) => f.valor === situacaoInicial)?.valor ?? 'TODAS');
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<CobrancaResponse | null>(null);
  const hoje = hojeEmBrasilia();
  const janela = vencimento === PROXIMOS_7_DIAS ? { de: hoje, ate: somarDias(hoje, DIAS_DA_JANELA) } : null;
  const lista = useCarregar(`cobrancas|${filtro}|${escopo}|${pagina}|${janela ? `${janela.de}:${janela.ate}` : ''}`, () =>
    listarCobrancas({ situacao: filtro, meus: escopo === 'meus', pagina, de: janela?.de, ate: janela?.ate }));
  // Limpar a janela tira só o `vencimento` do endereço; a situação e o Todos/Meus de agora ficam.
  const limparJanela = () => {
    setPagina(0);
    router.replace({
      pathname: '/treinador/financeiro',
      params: { aba: 'cobrancas', ...(filtro !== 'TODAS' ? { situacao: filtro } : {}), ...(escopo === 'meus' ? { meus: 'true' } : {}) },
    });
  };
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const mudar = (aplicar: () => void) => { aplicar(); setPagina(0); };
  const rotuloDoFiltro = FILTROS_DE_SITUACAO.find((f) => f.valor === filtro)?.rotulo ?? 'Todas';

  return (
    <View style={estilos.coluna}>
      {recebimentoOnlineHabilitado && pode('ALUNO_LER') ? <CartaoDeConferencias podeAlterar={podeAlterar} /> : null}
      {janela ? <FiltroDoEndereco rotulo={`Vencimento de hoje até ${dataParaTela(janela.ate)}`} aoLimpar={limparJanela} /> : null}
      <View style={estilos.filtros}>
        <EscolhaResponsabilidade valor={escopo} aoMudar={(v) => mudar(() => aoMudarEscopo(v))} />
        <View style={estilos.caber}>
          <Escolha rotulo="Situação" opcoes={FILTROS_DE_SITUACAO} valor={filtro}
            aoMudar={(v) => mudar(() => setFiltro(v))} />
        </View>
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio titulo="Nenhuma cobrança nesta lista"
          texto={janela ? `Nenhuma cobrança${filtro === 'TODAS' ? '' : ' nesta situação'} vence de hoje até ${dataParaTela(janela.ate)}.` : filtro === 'TODAS'
            ? 'As cobranças aparecem quando um aluno tem um plano comercial contratado na ficha.' : 'Tente outra situação.'} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={`${rotuloDoFiltro}${janela ? `, vencimento até ${dataParaTela(janela.ate)}` : ''}: ${dados.total} ${dados.total === 1 ? 'cobrança' : 'cobranças'}, por vencimento. Toque na linha para abrir.`}>
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
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  caber: { flexShrink: 1, maxWidth: '100%' },
  esmaecido: { opacity: 0.6 },
  selos: { gap: espaco(0.25) },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});

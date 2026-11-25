import { ChevronRight, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type { CobrancaResponse, ContratacaoResponse } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, listarContratacoesDoAluno, mudarSituacaoDaContratacao } from '../../api/rotas';
import {
  abertasDaContratacao, referenciaDaCobranca, resumoDaCobranca, rotuloDaPeriodicidade, rotuloDoTipoDaCobranca,
  seloDaCobranca, seloDaContratacao, seloDoTipoDaCobranca, textoDeAbertasQueContinuam,
} from '../../dominio/financeiro';
import { repeteAPeriodicidade, ultimasCobrancas, valorPorPeriodo, vigenciaDaContratacao } from '../../dominio/fichaDados';
import { planoPodeTerMinimo } from '../../dominio/saidaDoPlano';
import { primeiroNome } from '../../dominio/inscricoes';
import { linkDoWhatsApp, MOTIVO_SEM_TELEFONE } from '../../dominio/lembretesDeCobranca';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { iconeWhatsApp } from '../../ui/IconeWhatsApp';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ICONE_DO_SELO } from '../iconesDosSelos';
import { SituacaoDaCobranca } from './AbaCobrancas';
import { avisoDeConflito, ehConflito } from './comum';
import { ContratoNoCartao } from './ContratoNoCartao';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { FolhaDeContratacao } from './FolhaDeContratacao';
import { FolhaDeEncerrar } from './FolhaDeEncerrar';
import { FolhaPagamentoDoSaldo } from './FolhaPagamentoDoSaldo';
import { ListaOuTabela } from './ListaOuTabela';
import { ResponsavelFinanceiro } from './ResponsavelFinanceiro';

function mensagemDeRenovacao(alunoNome: string | undefined, planoNome: string | null | undefined): string {
  const nome = primeiroNome(alunoNome);
  return `Olá${nome ? `, ${nome}` : ''}! Seu plano${planoNome ? ` ${planoNome}` : ''} está no período de renovação. Vamos combinar a continuidade para o próximo ciclo?`;
}

/** O nome da linha da cobrança (contrato dos e2e do Financeiro): "Abrir cobrança de 11/2026, Paga". */
function rotuloDaCobranca(c: CobrancaResponse): string {
  const selo = seloDaCobranca(c);
  const doTipo = seloDoTipoDaCobranca(c.tipo, c.contratacaoId);
  return `Abrir ${doTipo ? rotuloDoTipoDaCobranca(c.tipo).toLowerCase() : 'cobrança'}${c.tipo === 'AVULSA' ? ':' : ' de'} ${referenciaDaCobranca(c)}, ${selo.rotulo}`;
}

/**
 * Cartão "Plano contratado" da ficha do aluno (`FINANCEIRO_LER` e módulo de pagamentos ligado; quem chama confere os
 * dois). Ficha › Dados (23/11): o plano vigente com nome, situação e ações numa linha, o valor em destaque, a vigência
 * (barra decorativa com o texto equivalente; âmbar com 15 dias ou menos, vermelha vencida), os detalhes numa `ListaDeDados`, as
 * últimas 3 cobranças numa tabela compacta (as colunas das Cobranças do Financeiro) com "Ver todas no Financeiro" já
 * filtrado pelo aluno, e o responsável financeiro numa linha própria. Com `FINANCEIRO_ALTERAR`: contrata, altera, pausa,
 * retoma e encerra, e registra pagamento na folha da cobrança. Aluno inativo ou anonimizado não ganha contratação nova.
 * O valor da cobrança nunca é digitado aqui: sai do plano ou da contratação, no servidor.
 */
export function CartaoPlanoContratado({ alunoId, ativo, anonimizado, alunoNome, telefoneAluno }: { alunoId: string; ativo: boolean; anonimizado: boolean; alunoNome?: string; telefoneAluno?: string | null }) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const podeAlterar = pode('FINANCEIRO_ALTERAR') && !anonimizado;
  const contratacoes = useCarregar(`contratacoes:${alunoId}`, () => listarContratacoesDoAluno(alunoId));
  const cobrancas = useCarregar(`cobrancas-do-aluno:${alunoId}`, () => listarCobrancasDoAluno(alunoId));
  const { recarregar: recarregarContratacoes } = contratacoes;
  const { recarregar: recarregarCobrancas } = cobrancas;
  const recarregar = useCallback(() => { recarregarContratacoes(); recarregarCobrancas(); }, [recarregarContratacoes, recarregarCobrancas]);
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const [formulario, setFormulario] = useState<'contratar' | 'alterar' | null>(null);
  const [cobrancaAberta, setCobrancaAberta] = useState<CobrancaResponse | null>(null);
  // Cobrança criada pelo pagamento do saldo (a API devolve só o id): a folha abre quando a lista recarregada a trouxer.
  const [abrirAoCarregar, setAbrirAoCarregar] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<'pausar' | 'encerrar' | null>(null);
  const [mudando, setMudando] = useState<string | null>(null);
  const [pagandoSaldo, setPagandoSaldo] = useState(false);

  const lista = contratacoes.dados;
  const vigente = lista?.find((c) => c.situacao !== 'ENCERRADA') ?? null;
  const anteriores = lista ? lista.filter((c) => c.situacao === 'ENCERRADA').length : 0;
  // Pausar mantém as cobranças abertas da contratação (inclui as vencidas); o painel avisa só quando há alguma. O encerrar
  // tem a própria conta, vinda da prévia da API (`FolhaDeEncerrar`).
  const avisoDasAbertas = vigente ? textoDeAbertasQueContinuam(abertasDaContratacao(cobrancas.dados, vigente.id)) : null;
  const ultimas = ultimasCobrancas(cobrancas.dados ?? []);
  const podeContratar = !!lista && !vigente && podeAlterar && ativo;
  const situacao = vigente ? seloDaContratacao(vigente.situacao) : null;
  // Contrato fechado (`docs/planos/contrato-fechado.md`): indicadores, barra, atraso e as cobranças do contrato no lugar do valor por período.
  const contrato = vigente?.contrato ?? null;
  const periodicidade = vigente ? rotuloDaPeriodicidade(vigente.periodicidade) : null;
  const porPeriodo = vigente ? valorPorPeriodo(vigente.periodicidade) : null;
  // O WhatsApp só aparece na janela de renovação da contratação ativa (a parcela única encerrada não alerta); quem envia é o treinador.
  const emRenovacao = vigente?.situacao === 'ATIVA' && vigente.alertaRenovacao === 'PROXIMO_VENCIMENTO';
  const linkDaRenovacao = emRenovacao ? linkDoWhatsApp(telefoneAluno, mensagemDeRenovacao(alunoNome, vigente.planoNome)) : null;
  const abrirWhatsApp = () => {
    if (linkDaRenovacao) Linking.openURL(linkDaRenovacao).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'));
  };

  const mudarSituacao = (acao: 'pausar' | 'retomar', mensagem: string) => {
    if (!vigente) return;
    setMudando(acao);
    mudarSituacaoDaContratacao(vigente.id, acao, vigente.versao).then(
      () => { setMudando(null); setConfirmando(null); avisar(mensagem, 'sucesso'); recarregar(); },
      (e: unknown) => {
        setMudando(null);
        setConfirmando(null);
        if (ehConflito(e)) {
          avisar(avisoDeConflito('A contratação foi alterada'), 'neutro');
          recarregar();
          return;
        }
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao titulo="Plano contratado" descricao="O plano comercial deste aluno com você."
      acoes={podeContratar ? <Botao rotulo="Contratar plano" tipo="acao" Icone={Plus} aoTocar={() => setFormulario('contratar')} /> : undefined}>
      {contratacoes.erro ? <MensagemErro texto={textoDoErro(contratacoes.erro)} erro={contratacoes.erro} tentarDeNovo={recarregarContratacoes} /> : null}
      {!lista && contratacoes.carregando ? <Esqueleto /> : null}
      {lista && !vigente ? (
        <View style={estilos.bloco}>
          <Texto variante="suave">Nenhum plano comercial contratado.{anteriores > 0 ? ` ${anteriores} ${anteriores === 1 ? 'contratação encerrada' : 'contratações encerradas'}.` : ''}</Texto>
          {podeAlterar && !ativo ? <Texto variante="pequeno">Reative o aluno para contratar um plano.</Texto> : null}
        </View>
      ) : null}
      {vigente ? (
        <View style={estilos.bloco}>
          <View style={estilos.cabecalhoDoPlano}>
            <View style={estilos.nomeESelo}>
              <Texto variante="bloco" nivel={3} style={estilos.encolher}>{vigente.planoNome ?? 'Plano'}</Texto>
              {situacao ? <Selo texto={situacao.rotulo} tipo={situacao.tom} Icone={ICONE_DO_SELO[situacao.tom]} /> : null}
            </View>
            {podeAlterar ? (
              <View style={estilos.acoesDoPlano}>
                {/* shortcut: "Alterar" (reajuste das abertas) fica escondido no contrato fechado (D11); trocar quando o contrato fechado tiver edição própria. */}
                {contrato ? null : <Botao rotulo="Alterar" tipo="secundario" aoTocar={() => setFormulario('alterar')} />}
                {/* shortcut: "Pausar"/"Retomar" ficam escondidos no contrato fechado (não há mensalidade a suspender e pausado trava o saldo e os lembretes); trocar se o contrato fechado ganhar pausa própria. */}
                {!contrato && vigente.situacao === 'ATIVA' ? <Botao rotulo="Pausar" tipo="secundario" aoTocar={() => setConfirmando('pausar')} /> : null}
                {!contrato && vigente.situacao === 'PAUSADA' ? <Botao rotulo="Retomar" tipo="secundario" carregando={mudando === 'retomar'} aoTocar={() => mudarSituacao('retomar', 'Contratação retomada.')} /> : null}
                <Botao rotulo="Encerrar" tipo="perigoTexto" aoTocar={() => setConfirmando('encerrar')} />
              </View>
            ) : null}
          </View>
          {contrato ? (
            <ContratoNoCartao contratacao={vigente} contrato={contrato} cobrancas={cobrancas.dados} alunoId={alunoId}
              podeRegistrar={podeAlterar && vigente.situacao === 'ATIVA'} aoAbrirCobranca={setCobrancaAberta} aoRegistrarPagamento={() => setPagandoSaldo(true)} />
          ) : null}
          {contrato ? null : <>
          <View style={estilos.valor} accessibilityLabel={`Valor: ${centavosParaTela(vigente.valorCentavos)}${porPeriodo ? ` ${porPeriodo}` : ''}`}>
            <Texto variante="destaque" numerico>{centavosParaTela(vigente.valorCentavos)}</Texto>
            {porPeriodo ? <Texto variante="suave">{porPeriodo}</Texto> : null}
          </View>
          <Vigencia contratacao={vigente} />
          {/* Os detalhes na `ListaDeDados` (24/11), como os Dados do aluno. O tempo mínimo só existe em contratação mensal. */}
          <ListaDeDados>
            <LinhaDeDado rotulo="Vencimento" valor={`Todo dia ${vigente.diaVencimento}`} numerico />
            {periodicidade && !repeteAPeriodicidade(vigente.planoNome, periodicidade) ? <LinhaDeDado rotulo="Periodicidade" valor={periodicidade} /> : null}
            {planoPodeTerMinimo(vigente.periodicidade) ? (
              <LinhaDeDado rotulo="Tempo mínimo" valor={vigente.minimoAte ? `Até ${dataParaTela(vigente.minimoAte)}` : 'Nenhum'} numerico />
            ) : null}
            {vigente.motivoValor ? <LinhaDeDado rotulo="Motivo do valor" valor={vigente.motivoValor} /> : null}
          </ListaDeDados>
          {emRenovacao ? (
            <LinhaDeAcoes>
              <Botao rotulo="Cobrar renovação pelo WhatsApp" tipo="acao" Icone={iconeWhatsApp(!!linkDaRenovacao)} aoTocar={abrirWhatsApp}
                desabilitado={!linkDaRenovacao} motivo={linkDaRenovacao ? undefined : MOTIVO_SEM_TELEFONE} />
            </LinhaDeAcoes>
          ) : null}
          </>}
        </View>
      ) : null}
      {cobrancas.erro ? <MensagemErro texto={textoDoErro(cobrancas.erro)} erro={cobrancas.erro} tentarDeNovo={recarregarCobrancas} /> : null}
      {!contrato && (ultimas.length > 0 || (cobrancas.dados && vigente)) ? (
        <View style={estilos.bloco}>
          <Texto variante="secao" nivel={3}>Cobranças</Texto>
          {ultimas.length > 0 ? (
            <ListaOuTabela rotulo="Últimas cobranças" linhas={ultimas} chave={(c) => c.id} aoTocar={setCobrancaAberta} larguraMinima={LARGURA_DA_TABELA}
              vao={espaco(3)} rotuloDaLinha={rotuloDaCobranca}
              item={(c) => {
                const selo = seloDaCobranca(c);
                const doTipo = seloDoTipoDaCobranca(c.tipo, c.contratacaoId);
                return {
                  titulo: referenciaDaCobranca(c), detalhe: resumoDaCobranca(c), selo: { texto: selo.rotulo, tipo: selo.tom },
                  extra: doTipo ? <View style={estilos.seloDoTipo}><Selo texto={doTipo.rotulo} tipo={doTipo.tom} /></View> : undefined,
                };
              }}
              colunas={[
                // A competência (MM/AAAA); a avulsa e a parcela de acordo, que não têm, dizem o que são.
                { chave: 'competencia', titulo: 'Competência', flex: 1, minimo: 96, principal: true, render: (c) => <Texto numerico numberOfLines={2}>{referenciaDaCobranca(c)}</Texto> },
                { chave: 'valor', titulo: 'Valor', flex: 1, minimo: 112, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto> },
                { chave: 'vencimento', titulo: 'Vencimento', flex: 1, minimo: 92, render: (c) => <Texto numerico numberOfLines={1}>{dataParaTela(c.vencimento)}</Texto> },
                { chave: 'situacao', titulo: 'Situação', largura: 150, render: (c) => <SituacaoDaCobranca cobranca={c} compacta /> },
                { chave: 'abrir', titulo: 'Abrir', largura: 24, acao: true, render: () => <View aria-hidden><ChevronRight size={18} color={cores.textoSuave} /></View> },
              ]} />
          ) : <Texto variante="suave">Nenhuma cobrança gerada ainda.</Texto>}
          {/* As cobranças deste aluno na tela Financeiro, com os filtros de lá (`?alunoId=`). */}
          {ultimas.length > 0 ? <LinkTexto texto="Ver todas no Financeiro" href={`/treinador/financeiro?aba=cobrancas&alunoId=${encodeURIComponent(alunoId)}` as never} /> : null}
        </View>
      ) : null}
      {/* Fora do `vigente`: o responsável vale também sem plano (a avulsa tem lembrete). */}
      <ResponsavelFinanceiro alunoId={alunoId} podeAlterar={podeAlterar} />
      {formulario ? (
        <FolhaDeContratacao alunoId={alunoId} contratacao={formulario === 'alterar' ? vigente : null}
          aoFechar={() => setFormulario(null)} aoMudar={recarregar} />
      ) : null}
      <FolhaDaCobranca cobranca={cobrancaAberta ?? (abrirAoCarregar ? cobrancas.dados?.find((c) => c.id === abrirAoCarregar) ?? null : null)}
        podeAlterar={podeAlterar} aoFechar={() => { setCobrancaAberta(null); setAbrirAoCarregar(null); }} aoMudar={recarregar} />
      <PainelConfirmacao visivel={confirmando === 'pausar'} titulo="Pausar este plano?"
        mensagem="Enquanto estiver pausado, o aluno não recebe novas mensalidades. Você pode retomar quando quiser."
        rotuloConfirmar="Pausar plano" rotuloCancelar="Voltar" carregando={mudando === 'pausar'}
        aoConfirmar={() => mudarSituacao('pausar', 'Contratação pausada.')} aoCancelar={() => setConfirmando(null)}>
        {avisoDasAbertas ? <Texto variante="suave">{avisoDasAbertas}</Texto> : null}
      </PainelConfirmacao>
      {pagandoSaldo && vigente && contrato ? (
        <FolhaPagamentoDoSaldo contratacao={vigente} contrato={contrato} aoFechar={() => setPagandoSaldo(false)} aoMudar={recarregar} aoAbrirCobranca={setAbrirAoCarregar} />
      ) : null}
      {confirmando === 'encerrar' && vigente ? (
        <FolhaDeEncerrar contratacao={vigente} aoFechar={() => setConfirmando(null)} aoMudar={recarregar} />
      ) : null}
    </Cartao>
  );
}

/** Abaixo disso (medido na própria tabela) as cobranças viram cartões: cabem Competência, Valor, Vencimento e Situação. */
const LARGURA_DA_TABELA = 560;

/**
 * Vigência: os dias restantes acima da barra, à direita, e "Início" e "Término" nas pontas, embaixo. A barra é decorativa
 * (`aria-hidden`); o leitor de tela ouve a frase equivalente. Âmbar com 15 dias ou menos e na parcela única encerrada
 * ("Encerrado em dd/mm/aaaa"), na barra e no texto; neutra no resto (`dominio/fichaDados.vigenciaDaContratacao`).
 */
function Vigencia({ contratacao }: { contratacao: ContratacaoResponse }) {
  const { cores } = useTema();
  const v = vigenciaDaContratacao(contratacao);
  if (!v) return null;
  const comTom = v.tom !== 'neutro';
  const cor = comTom ? cores[v.tom] : cores.textoSuave;
  return (
    <View style={estilos.vigencia} accessibilityLabel={v.falado}>
      <Texto variante="pequeno" cor={comTom ? cor : undefined} style={[estilos.restantes, comTom ? estilos.forte : null]}>{v.restantes}</Texto>
      <View aria-hidden style={[estilos.trilho, { backgroundColor: cores.divisor }]}>
        <View style={[estilos.cheio, { width: `${v.fracao * 100}%`, backgroundColor: cor }]} />
      </View>
      <View style={estilos.pontas}>
        <Texto variante="pequeno" numerico>Início {v.inicio}</Texto>
        <Texto variante="pequeno" numerico>Término {v.termino}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  cabecalhoDoPlano: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  nomeESelo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, minWidth: 0 },
  acoesDoPlano: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  encolher: { flexShrink: 1 },
  valor: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1) },
  vigencia: { gap: espaco(0.75) },
  restantes: { alignSelf: 'flex-end' },
  forte: { fontFamily: fontes.semi },
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  cheio: { height: '100%', borderRadius: 3 },
  pontas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: espaco(1) },
  seloDoTipo: { flexDirection: 'row' },
});

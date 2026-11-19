import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type { CobrancaResponse, ContratacaoResponse } from '../../api/financeiroTipos';
import { listarCobrancasDoAluno, listarContratacoesDoAluno, mudarSituacaoDaContratacao } from '../../api/rotas';
import {
  abertasDaContratacao, referenciaDaCobranca, resumoDaCobranca, rotuloDaPeriodicidade, rotuloDoTipoDaCobranca,
  seloDaCobranca, seloDaContratacao, seloDoTipoDaCobranca, textoDeAbertasQueContinuam,
} from '../../dominio/financeiro';
import { planoPodeTerMinimo, textoDoMinimoAte } from '../../dominio/saidaDoPlano';
import { primeiroNome } from '../../dominio/inscricoes';
import { linkDoWhatsApp, MOTIVO_SEM_TELEFONE } from '../../dominio/lembretesDeCobranca';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { iconeWhatsApp } from '../../ui/IconeWhatsApp';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ICONE_DO_SELO } from '../iconesDosSelos';
import { avisoDeConflito, ehConflito } from './comum';
import { FolhaDaCobranca } from './FolhaDaCobranca';
import { FolhaDeContratacao } from './FolhaDeContratacao';
import { FolhaDeEncerrar } from './FolhaDeEncerrar';
import { ResponsavelFinanceiro } from './ResponsavelFinanceiro';

/** Cobranças à vista no cartão; "Ver todas" mostra o resto (a lista do aluno só cresce, um item por competência). */
const COBRANCAS_VISIVEIS = 4;

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/**
 * Selo da vigência pelo alerta que a API calcula (`alertaRenovacao`, a janela de renovação mora lá). Âmbar porque quem
 * renova é o treinador; vencida é problema. Sem alerta (contratação sem término) não há selo.
 */
function seloDaVigencia(c: ContratacaoResponse): { texto: string; tipo: TipoSelo } | null {
  const n = c.diasRestantesVigencia;
  if (n == null || !c.alertaRenovacao) return null;
  if (c.alertaRenovacao === 'VENCIDO') return { texto: `Vigência vencida há ${dias(Math.abs(n))}`, tipo: 'perigo' };
  if (c.alertaRenovacao === 'PROXIMO_VENCIMENTO') return { texto: n === 0 ? 'Renovar hoje' : `Renovar em ${dias(n)}`, tipo: 'atencao' };
  return { texto: `Vigente · ${dias(n)} restantes`, tipo: 'neutro' };
}

function mensagemDeRenovacao(alunoNome: string | undefined, planoNome: string | null | undefined): string {
  const nome = primeiroNome(alunoNome);
  return `Olá${nome ? `, ${nome}` : ''}! Seu plano${planoNome ? ` ${planoNome}` : ''} está no período de renovação. Vamos combinar a continuidade para o próximo ciclo?`;
}

/** Em aberto primeiro (a que vence antes no topo), depois as outras da mais nova para a mais antiga. */
function emOrdemDeAtencao(lista: readonly CobrancaResponse[]): CobrancaResponse[] {
  const abertas = lista.filter((c) => c.situacao === 'ABERTA').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const outras = lista.filter((c) => c.situacao !== 'ABERTA').sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  return [...abertas, ...outras];
}

/**
 * Cartão "Plano contratado" da ficha do aluno (`FINANCEIRO_LER` e módulo de pagamentos ligado; quem chama confere os
 * dois). Mostra o plano comercial vigente, as cobranças do aluno e, com `FINANCEIRO_ALTERAR`, contrata, altera,
 * pausa, retoma e encerra, e registra pagamento. Aluno inativo ou anonimizado não ganha contratação nova. O valor da
 * cobrança nunca é digitado aqui: sai do plano ou da contratação, no servidor.
 */
export function CartaoPlanoContratado({ alunoId, ativo, anonimizado, alunoNome, telefoneAluno }: { alunoId: string; ativo: boolean; anonimizado: boolean; alunoNome?: string; telefoneAluno?: string | null }) {
  const { pode } = useSessao();
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
  const [confirmando, setConfirmando] = useState<'pausar' | 'encerrar' | null>(null);
  const [mudando, setMudando] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);

  const lista = contratacoes.dados;
  const vigente = lista?.find((c) => c.situacao !== 'ENCERRADA') ?? null;
  const anteriores = lista ? lista.filter((c) => c.situacao === 'ENCERRADA').length : 0;
  // Pausar mantém as cobranças abertas da contratação (inclui as vencidas); o painel avisa só quando há alguma. O encerrar
  // tem a própria conta, vinda da prévia da API (`FolhaDeEncerrar`).
  const avisoDasAbertas = vigente ? textoDeAbertasQueContinuam(abertasDaContratacao(cobrancas.dados, vigente.id)) : null;
  const ordenadas = emOrdemDeAtencao(cobrancas.dados ?? []);
  const visiveis = todas ? ordenadas : ordenadas.slice(0, COBRANCAS_VISIVEIS);
  const podeContratar = !!lista && !vigente && podeAlterar && ativo;
  const selo = vigente ? seloDaVigencia(vigente) : null;
  const situacao = vigente ? seloDaContratacao(vigente.situacao) : null;
  // O WhatsApp só aparece na janela de renovação (ou vencida) da contratação ativa; quem envia é o treinador.
  const emRenovacao = vigente?.situacao === 'ATIVA' && (vigente.alertaRenovacao === 'PROXIMO_VENCIMENTO' || vigente.alertaRenovacao === 'VENCIDO');
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
      acoes={podeContratar ? <Botao rotulo="Contratar plano" tipo="secundario" Icone={Plus} aoTocar={() => setFormulario('contratar')} /> : undefined}>
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
          <View style={estilos.linha}>
            <Texto variante="bloco" style={estilos.encolher}>{vigente.planoNome ?? 'Plano'}</Texto>
            <View style={estilos.selos}>
              {situacao ? <Selo texto={situacao.rotulo} tipo={situacao.tom} Icone={ICONE_DO_SELO[situacao.tom]} /> : null}
              {selo ? <Selo texto={selo.texto} tipo={selo.tipo} Icone={ICONE_DO_SELO[selo.tipo]} /> : null}
            </View>
          </View>
          <CamposEmLinha>
            <CampoLeitura rotulo="Valor" valor={centavosParaTela(vigente.valorCentavos)} numerico />
            <CampoLeitura rotulo="Periodicidade" valor={rotuloDaPeriodicidade(vigente.periodicidade)} />
            <CampoLeitura rotulo="Vencimento" valor={`Todo dia ${vigente.diaVencimento}`} />
            <CampoLeitura rotulo="Início" valor={dataParaTela(vigente.inicio)} numerico />
            {vigente.terminoVigencia ? (
              <CampoLeitura rotulo="Término da vigência" valor={dataParaTela(vigente.terminoVigencia)} numerico />
            ) : null}
          </CamposEmLinha>
          {vigente.motivoValor ? <CampoLeitura rotulo="Motivo do valor" valor={vigente.motivoValor} /> : null}
          {/* O tempo mínimo só existe em contratação mensal: nas outras, a linha nem aparece. */}
          {planoPodeTerMinimo(vigente.periodicidade) ? <Texto variante="suave">{textoDoMinimoAte(vigente.minimoAte)}</Texto> : null}
          {emRenovacao ? (
            <LinhaDeAcoes>
              <Botao rotulo="Cobrar renovação pelo WhatsApp" tipo="secundario" Icone={iconeWhatsApp(!!linkDaRenovacao)} aoTocar={abrirWhatsApp}
                desabilitado={!linkDaRenovacao} motivo={linkDaRenovacao ? undefined : MOTIVO_SEM_TELEFONE} />
            </LinhaDeAcoes>
          ) : null}
          {podeAlterar ? (
            <LinhaDeAcoes>
              <Botao rotulo="Alterar" tipo="secundario" aoTocar={() => setFormulario('alterar')} desabilitado={vigente.situacao === 'ENCERRADA'} />
              {vigente.situacao === 'ATIVA' ? <Botao rotulo="Pausar" tipo="secundario" aoTocar={() => setConfirmando('pausar')} /> : null}
              {vigente.situacao === 'PAUSADA' ? <Botao rotulo="Retomar" tipo="secundario" carregando={mudando === 'retomar'} aoTocar={() => mudarSituacao('retomar', 'Contratação retomada.')} /> : null}
              <Botao rotulo="Encerrar" tipo="perigoTexto" aoTocar={() => setConfirmando('encerrar')} />
            </LinhaDeAcoes>
          ) : null}
        </View>
      ) : null}
      {cobrancas.erro ? <MensagemErro texto={textoDoErro(cobrancas.erro)} erro={cobrancas.erro} tentarDeNovo={recarregarCobrancas} /> : null}
      {ordenadas.length > 0 ? (
        <View style={estilos.bloco}>
          <Texto variante="secao">Cobranças</Texto>
          <Grade>
            {visiveis.map((c) => {
              const selo = seloDaCobranca(c);
              const doTipo = seloDoTipoDaCobranca(c.tipo);
              return (
                <ItemDeLista key={c.id} titulo={referenciaDaCobranca(c)} detalhe={resumoDaCobranca(c)}
                  selo={{ texto: selo.rotulo, tipo: selo.tom, Icone: ICONE_DO_SELO[selo.tom] }} aoTocar={() => setCobrancaAberta(c)}
                  rotulo={`Abrir ${doTipo ? rotuloDoTipoDaCobranca(c.tipo).toLowerCase() : 'cobrança'}${c.tipo === 'AVULSA' ? ':' : ' de'} ${referenciaDaCobranca(c)}, ${selo.rotulo}`}>
                  {doTipo ? <View style={estilos.seloDoTipo}><Selo texto={doTipo.rotulo} tipo={doTipo.tom} /></View> : null}
                </ItemDeLista>
              );
            })}
          </Grade>
          {ordenadas.length > COBRANCAS_VISIVEIS ? (
            <LinhaDeAcoes>
              <Botao rotulo={todas ? 'Ver menos' : `Ver todas (${ordenadas.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
            </LinhaDeAcoes>
          ) : null}
          {/* As cobranças deste aluno na tela Financeiro, com os filtros de lá (`?alunoId=`). */}
          <LinkTexto texto="Ver no Financeiro" href={`/treinador/financeiro?aba=cobrancas&alunoId=${encodeURIComponent(alunoId)}` as never} />
        </View>
      ) : null}
      {cobrancas.dados && cobrancas.dados.length === 0 && vigente ? (
        <Texto variante="suave">{vigente.situacao === 'ATIVA' ? 'Nenhuma cobrança ainda. A mensalidade é gerada todo mês, paga ou não.' : 'Nenhuma cobrança.'}</Texto>
      ) : null}
      {/* Fora do `vigente`: o responsável vale também sem plano (a avulsa tem lembrete). */}
      <ResponsavelFinanceiro alunoId={alunoId} podeAlterar={podeAlterar} />
      {formulario ? (
        <FolhaDeContratacao alunoId={alunoId} contratacao={formulario === 'alterar' ? vigente : null}
          aoFechar={() => setFormulario(null)} aoMudar={recarregar} />
      ) : null}
      <FolhaDaCobranca cobranca={cobrancaAberta} podeAlterar={podeAlterar} aoFechar={() => setCobrancaAberta(null)} aoMudar={recarregar} />
      <PainelConfirmacao visivel={confirmando === 'pausar'} titulo="Pausar este plano?"
        mensagem="Enquanto estiver pausado, o aluno não recebe novas mensalidades. Você pode retomar quando quiser."
        rotuloConfirmar="Pausar plano" rotuloCancelar="Voltar" carregando={mudando === 'pausar'}
        aoConfirmar={() => mudarSituacao('pausar', 'Contratação pausada.')} aoCancelar={() => setConfirmando(null)}>
        {avisoDasAbertas ? <Texto variante="suave">{avisoDasAbertas}</Texto> : null}
      </PainelConfirmacao>
      {confirmando === 'encerrar' && vigente ? (
        <FolhaDeEncerrar contratacao={vigente} aoFechar={() => setConfirmando(null)} aoMudar={recarregar} />
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  encolher: { flexShrink: 1 },
  selos: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(0.5) },
  seloDoTipo: { flexDirection: 'row' },
});

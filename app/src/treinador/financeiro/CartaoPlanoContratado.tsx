import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type { CobrancaResponse, ContratacaoResponse, PlanoResponse } from '../../api/financeiroTipos';
import {
  alterarContratacao, contratarPlano, listarCobrancasDoAluno, listarContratacoesDoAluno, listarPlanosComerciais,
  mudarSituacaoDaContratacao,
} from '../../api/rotas';
import {
  abertasDaContratacao, hojeEmBrasilia, LIMITES, resumoDaCobranca, rotuloDaPeriodicidade, seloDaCobranca, seloDaContratacao,
  textoDeAbertasQueContinuam, validarContratacao,
} from '../../dominio/financeiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { rotuloDoMes } from '../../dominio/numeros';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData, CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Grade } from '../../ui/Grade';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { FolhaDaCobranca } from './FolhaDaCobranca';

/** Cobranças à vista no cartão; "Ver todas" mostra o resto (a lista do aluno só cresce, um item por competência). */
const COBRANCAS_VISIVEIS = 4;

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
export function CartaoPlanoContratado({ alunoId, ativo, anonimizado }: { alunoId: string; ativo: boolean; anonimizado: boolean }) {
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
  // Pausar e encerrar mantêm as cobranças abertas da contratação (inclui as vencidas); o painel avisa só quando há alguma.
  const avisoDasAbertas = vigente ? textoDeAbertasQueContinuam(abertasDaContratacao(cobrancas.dados, vigente.id)) : null;
  const ordenadas = emOrdemDeAtencao(cobrancas.dados ?? []);
  const visiveis = todas ? ordenadas : ordenadas.slice(0, COBRANCAS_VISIVEIS);
  const podeContratar = !!lista && !vigente && podeAlterar && ativo;

  const mudarSituacao = (acao: 'pausar' | 'retomar' | 'encerrar', mensagem: string) => {
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
            <Selo texto={seloDaContratacao(vigente.situacao).rotulo} tipo={seloDaContratacao(vigente.situacao).tom} />
          </View>
          <CamposEmLinha>
            <CampoLeitura rotulo="Valor" valor={centavosParaTela(vigente.valorCentavos)} numerico />
            <CampoLeitura rotulo="Periodicidade" valor={rotuloDaPeriodicidade(vigente.periodicidade)} />
            <CampoLeitura rotulo="Vencimento" valor={`Todo dia ${vigente.diaVencimento}`} />
            <CampoLeitura rotulo="Início" valor={dataParaTela(vigente.inicio)} numerico />
          </CamposEmLinha>
          {vigente.motivoValor ? <CampoLeitura rotulo="Motivo do valor" valor={vigente.motivoValor} /> : null}
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
              return <ItemDeLista key={c.id} titulo={rotuloDoMes(c.competencia)} detalhe={resumoDaCobranca(c)}
                selo={{ texto: selo.rotulo, tipo: selo.tom }} aoTocar={() => setCobrancaAberta(c)}
                rotulo={`Abrir cobrança de ${rotuloDoMes(c.competencia)}, ${selo.rotulo}`} />;
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
      {cobrancas.dados && cobrancas.dados.length === 0 && vigente ? <Texto variante="suave">Ainda não há cobranças geradas.</Texto> : null}
      {formulario ? (
        <FolhaDeContratacao alunoId={alunoId} contratacao={formulario === 'alterar' ? vigente : null}
          aoFechar={() => setFormulario(null)} aoMudar={recarregar} />
      ) : null}
      <FolhaDaCobranca cobranca={cobrancaAberta} podeAlterar={podeAlterar} aoFechar={() => setCobrancaAberta(null)} aoMudar={recarregar} />
      <PainelConfirmacao visivel={confirmando === 'pausar'} titulo="Pausar este plano?"
        mensagem="Enquanto estiver pausado, o aluno não recebe novas cobranças. Você pode retomar quando quiser."
        rotuloConfirmar="Pausar plano" rotuloCancelar="Voltar" carregando={mudando === 'pausar'}
        aoConfirmar={() => mudarSituacao('pausar', 'Contratação pausada.')} aoCancelar={() => setConfirmando(null)}>
        {avisoDasAbertas ? <Texto variante="suave">{avisoDasAbertas}</Texto> : null}
      </PainelConfirmacao>
      <PainelConfirmacao visivel={confirmando === 'encerrar'} titulo="Encerrar este plano?"
        mensagem="O aluno deixa de receber novas cobranças. As que já existem continuam e podem ser pagas ou canceladas. Para voltar, será preciso contratar de novo."
        rotuloConfirmar="Encerrar plano" rotuloCancelar="Voltar" perigo carregando={mudando === 'encerrar'}
        aoConfirmar={() => mudarSituacao('encerrar', 'Contratação encerrada.')} aoCancelar={() => setConfirmando(null)}>
        {avisoDasAbertas ? <Texto variante="suave">{avisoDasAbertas}</Texto> : null}
      </PainelConfirmacao>
    </Cartao>
  );
}

function FolhaDeContratacao({ alunoId, contratacao, aoFechar, aoMudar }: {
  alunoId: string;
  /** Preenchida = alterar esta contratação; nula = contratar um plano novo. */
  contratacao: ContratacaoResponse | null;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const planos = useCarregar('planos-comerciais|ficha', () => listarPlanosComerciais(false));
  const [planoId, setPlanoId] = useState<string | null>(contratacao?.planoComercialId ?? null);
  const [valor, setValor] = useState(centavosParaCampo(contratacao?.valorCentavos));
  const [motivo, setMotivo] = useState(contratacao?.motivoValor ?? '');
  const [inicio, setInicio] = useState(dataParaTela(contratacao?.inicio ?? hojeEmBrasilia()));
  const [dia, setDia] = useState<number | null>(contratacao?.diaVencimento ?? Number(hojeEmBrasilia().slice(8, 10)));
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const plano: PlanoResponse | undefined = planos.dados?.find((p) => p.id === planoId);
  const centavos = centavosDaTela(valor);
  const valorIlegivel = valor.trim() !== '' && centavos === null;
  const iso = dataDaTela(inicio);
  // Ao contratar, valor em branco = o do plano; ao alterar, o valor é sempre enviado.
  const problema = valorIlegivel
    ? 'Valor inválido. Use reais, por exemplo 150,00.'
    : contratacao && centavos === null
      ? 'Informe o valor da contratação.'
      : validarContratacao({
        planoId, valorCentavos: centavos, valorDoPlanoCentavos: plano?.valorCentavos ?? null,
        motivoValor: motivo, inicio: iso ?? null, diaVencimento: dia,
      });
  const diferente = centavos !== null && (!plano || centavos !== plano.valorCentavos);
  const motivoVisivel = diferente || !!contratacao?.motivoValor;

  const enviar = () => {
    setTentou(true);
    if (problema || !planoId || dia === null) return;
    setEnviando(true);
    setErro(null);
    const motivoValor = motivoVisivel ? motivo.trim() || null : null;
    const chamada = contratacao
      ? alterarContratacao(contratacao.id, { valorCentavos: centavos as number, motivoValor, diaVencimento: dia, versao: contratacao.versao })
      : contratarPlano(alunoId, { planoComercialId: planoId, valorCentavos: diferente ? centavos : null, motivoValor, inicio: iso as string, diaVencimento: dia });
    chamada.then(
      () => { setEnviando(false); avisar(contratacao ? 'Contratação alterada.' : 'Plano contratado.', 'sucesso'); aoMudar(); aoFechar(); },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          avisar(avisoDeConflito('A contratação foi alterada'), 'neutro');
          aoMudar();
          aoFechar();
          return;
        }
        setErro(e);
      },
    );
  };

  return (
    <Folha visivel titulo={contratacao ? 'Alterar contratação' : 'Contratar plano'} aoFechar={aoFechar}
      rodape={<Botao rotulo={contratacao ? 'Salvar contratação' : 'Contratar plano'} aoTocar={enviar} carregando={enviando} />}>
      <View style={{ gap: espaco(1.5) }}>
        {contratacao ? (
          <CampoLeitura rotulo="Plano" valor={contratacao.planoNome} />
        ) : (
          <>
            {planos.erro ? <MensagemErro texto={textoDoErro(planos.erro)} erro={planos.erro} tentarDeNovo={planos.recarregar} /> : null}
            <EscolhaEmFolha rotulo="Plano" titulo="Escolha o plano" valor={planoId} carregando={planos.carregando && !planos.dados}
              textoVazio="Nenhum plano comercial ativo. Crie um na tela Financeiro."
              opcoes={(planos.dados ?? []).map((p) => ({ valor: p.id as string | null, rotulo: p.nome, detalhe: `${centavosParaTela(p.valorCentavos)} · ${rotuloDaPeriodicidade(p.periodicidade)}` }))}
              aoMudar={setPlanoId} rotuloDoValor="Escolher plano" />
          </>
        )}
        <CampoMoeda rotulo={contratacao ? 'Valor (R$)' : 'Valor (R$), em branco usa o do plano'} texto={valor} aoMudar={setValor}
          ajuda={plano ? `Valor do plano: ${centavosParaTela(plano.valorCentavos)}. Digite outro só se combinou diferente.` : undefined} />
        {motivoVisivel ? (
          <Campo rotulo="Motivo do valor diferente" valor={motivo} aoMudar={setMotivo} maxLength={LIMITES.motivoDoValor}
            ajuda="Obrigatório quando o valor não é o do plano." />
        ) : null}
        {contratacao ? null : <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />}
        <CampoNumerico rotulo="Dia do vencimento" inteiro valor={dia} aoMudar={setDia} ajuda="De 1 a 31. Em meses mais curtos, vale o último dia do mês." />
        {tentou && problema ? <MensagemErro texto={problema} /> : null}
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  encolher: { flexShrink: 1 },
});

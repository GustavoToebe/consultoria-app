import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { previaDaRenegociacao, renegociarCobrancas, type PreviaDaRenegociacao, type PreviaDaRenegociacaoRequest } from '../../api/financeiroRenegociar';
import type { CobrancaResponse } from '../../api/financeiroTipos';
import { hojeEmBrasilia, referenciaDaCobranca, resumoDaCobranca, seloDaCobranca, seloDoTipoDaCobranca } from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import {
  corpoDaPrevia, LIMITES_DA_RENEGOCIACAO, mesmaPrevia, oQueAcontece, quantasCobrancas, rotuloDoConfirmar, separarParaRenegociar,
  textoDaRenegociacaoFeita, tituloDaRenegociacao, traduzirErroDaRenegociacao, validarCondicoes, type CampoDaRenegociacao,
  type ErrosDaRenegociacao, type SeparacaoDaRenegociacao,
} from '../../dominio/renegociar';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { focarPrimeiroComErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { CampoMoeda } from './comum';

type Etapa = 1 | 2 | 3;
const NOMES_DAS_ETAPAS: Record<Etapa, string> = { 1: 'Cobranças', 2: 'Condições', 3: 'Prévia' };
/** Abaixo desta largura da janela o indicador vira uma linha só ("Etapa 2 de 3 · Condições"), como na avulsa. */
const LARGURA_DAS_ETAPAS = 480;

/** A prévia mostrada e o corpo e o motivo que a geraram: a confirmação manda exatamente isso. */
interface PreviaMostrada { corpo: PreviaDaRenegociacaoRequest; motivo: string; dados: PreviaDaRenegociacao }

const reais = (centavos: number) => centavosParaTela(centavos).replace('R$ ', 'R$ ');

/**
 * Renegociar (D14): uma cobrança (recálculo) ou várias do mesmo aluno (acordo), em três etapas na mesma folha, com o estado
 * todo aqui (voltar não perde nada). 1 Cobranças: as que entram e as que ficam de fora, com o motivo (alunos diferentes
 * travam o "Continuar"). 2 Condições: acréscimo e desconto (opcionais), parcelas, primeiro vencimento e o motivo
 * (obrigatório, só a equipe vê). 3 Prévia: tudo do servidor (`POST /cobrancas/renegociar/previa`): soma das originais,
 * ajuste, total, cada parcela com o vencimento e o valor (a sobra dos centavos na última) e o que acontece com as originais;
 * a tela não calcula nada. A prévia já é a revisão: o botão principal confirma, sem outra pergunta (o acordo tem desfazer).
 *
 * Toda confirmação desta abertura leva o mesmo `pedidoId`: sem conexão, repetir não renegocia em dobro. 422 volta às
 * condições com o erro no campo; 404 e os 409 de dado velho (versão, já não aberta, aluno inativo) travam a folha com a
 * mensagem e pedem a lista de novo (`aoMudar`); só resta fechar. Resposta da prévia que chega depois de a pessoa mudar as
 * condições é descartada, e a confirmação manda as condições da prévia mostrada.
 */
export function FolhaRenegociar({ cobrancas, aoFechar, aoCancelar = aoFechar, aoMudar }: {
  /** A seleção como estava ao abrir (a versão que a tela viu vai no pedido). */
  cobrancas: readonly CobrancaResponse[];
  aoFechar: () => void;
  /** "Cancelar" da primeira etapa; na folha de uma cobrança, volta ao detalhe dela. Padrão: fechar. */
  aoCancelar?: () => void;
  /** Depois do sucesso (as renegociadas) ou de um 404/409 (lista vazia): quem chamou recarrega a lista. */
  aoMudar: (renegociadas: string[]) => void;
}) {
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [acrescimo, setAcrescimo] = useState('');
  const [desconto, setDesconto] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [vencimento, setVencimento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentou, setTentou] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosDaRenegociacao>({});
  /** A frase do servidor que trouxe a pessoa de volta às condições (422). */
  const [aviso, setAviso] = useState<string | null>(null);
  /** 404/409 de dado velho: a folha só deixa fechar. */
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [previa, setPrevia] = useState<PreviaMostrada | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroDaPrevia, setErroDaPrevia] = useState<{ mensagem: string; erro: unknown } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  /** Um pedido por abertura (como a D11 da avulsa): repetir depois de uma falha de rede manda o mesmo. */
  const [pedidoId] = useState(novoUid);
  // O segundo toque chega antes de a tela redesenhar: sem a trava sairiam dois pedidos.
  const ocupado = useRef(false);
  // Só a resposta da última prévia pedida vale.
  const vezDaPrevia = useRef(0);

  const refAcrescimo = useRef<TextInput>(null);
  const refDesconto = useRef<TextInput>(null);
  const refParcelas = useRef<TextInput>(null);
  const refVencimento = useRef<TextInput>(null);
  const refMotivo = useRef<TextInput>(null);

  const hoje = hojeEmBrasilia();
  const separacao = separarParaRenegociar(cobrancas);
  const { entram } = separacao;
  const digitado = { acrescimoTexto: acrescimo, descontoTexto: desconto, parcelasTexto: parcelas, primeiroVencimentoTexto: vencimento, motivo };
  const validacao = validarCondicoes(digitado, hoje);
  const locais = tentou && !validacao.ok ? validacao.erros : {};
  const erroDe = (campo: CampoDaRenegociacao) => locais[campo] ?? doServidor[campo] ?? null;
  const mudar = (campo: CampoDaRenegociacao, definir: (t: string) => void) => (t: string) => {
    definir(t);
    if (!doServidor[campo]) return;
    setDoServidor((atuais) => {
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });
  };
  const focar = (erros: ErrosDaRenegociacao) => focarPrimeiroComErro(erros as Record<string, string>, [
    ['acrescimo', refAcrescimo], ['desconto', refDesconto], ['parcelas', refParcelas], ['primeiroVencimento', refVencimento], ['motivo', refMotivo],
  ]);

  const bloquear = (mensagem: string) => {
    setBloqueio(mensagem);
    aoMudar([]);
  };
  const voltarAsCondicoes = (mensagem: string, campos: ErrosDaRenegociacao) => {
    // Erro em `itens` não tem campo nas condições: fica só a frase, no topo.
    setDoServidor(campos);
    setAviso(campos.cobrancas ?? mensagem);
    setEtapa(2);
    focar(campos);
  };

  const buscarPrevia = (corpo: PreviaDaRenegociacaoRequest, comMotivo: string) => {
    vezDaPrevia.current += 1;
    const vez = vezDaPrevia.current;
    setCarregando(true);
    setErroDaPrevia(null);
    setErroDoEnvio(null);
    previaDaRenegociacao(corpo).then(
      (dados) => {
        if (vez !== vezDaPrevia.current) return;
        setCarregando(false);
        setPrevia({ corpo, motivo: comMotivo, dados });
      },
      (e: unknown) => {
        if (vez !== vezDaPrevia.current) return;
        setCarregando(false);
        const t = traduzirErroDaRenegociacao(e, 'previa');
        if (t.bloqueia) bloquear(t.mensagem);
        else if (Object.keys(t.campos).length > 0) voltarAsCondicoes(t.mensagem, t.campos);
        else setErroDaPrevia({ mensagem: t.mensagem, erro: e });
      },
    );
  };

  const verPrevia = () => {
    setTentou(true);
    if (!validacao.ok) {
      focar(validacao.erros);
      return;
    }
    setAviso(null);
    setEtapa(3);
    const corpo = corpoDaPrevia(entram, validacao.condicoes);
    // Nada mudou desde a última prévia: a mesma fica (só o motivo pode ter mudado, e ele não muda a conta).
    if (previa && mesmaPrevia(previa.corpo, corpo)) {
      setPrevia({ ...previa, motivo: validacao.condicoes.motivo });
      return;
    }
    setPrevia(null);
    buscarPrevia(corpo, validacao.condicoes.motivo);
  };

  const confirmar = () => {
    if (!previa || ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setErroDoEnvio(null);
    // 201 ou 200 (o pedido já tinha sido feito): os dois são sucesso, com as contagens do servidor.
    renegociarCobrancas({ ...previa.corpo, pedidoId, motivo: previa.motivo }).then(
      (r) => {
        avisar(textoDaRenegociacaoFeita(r), 'sucesso');
        aoMudar(previa.corpo.itens.map((i) => i.cobrancaId));
        aoFechar();
      },
      (e: unknown) => {
        ocupado.current = false;
        setEnviando(false);
        const t = traduzirErroDaRenegociacao(e, 'confirmar');
        if (t.bloqueia) return bloquear(t.mensagem);
        if (Object.keys(t.campos).length > 0) return voltarAsCondicoes(t.mensagem, t.campos);
        // Sem resposta pode ter gravado: a lista de trás recarrega, e "Renegociar" de novo manda o mesmo pedido.
        setErroDoEnvio(t.mensagem);
        aoMudar([]);
      },
    );
  };

  const titulo = tituloDaRenegociacao(entram.length || cobrancas.length);
  // Sem nada a seguir (dado velho do servidor, ou a seleção não serve), o único caminho é fechar: a frase está no corpo.
  const rodape = bloqueio || (etapa === 1 && separacao.problema) ? <Botao rotulo="Fechar" aoTocar={bloqueio ? aoFechar : aoCancelar} /> : (
    <>
      {etapa === 1
        ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} />
        : <Botao rotulo="Voltar" tipo="secundario" desabilitado={enviando} aoTocar={() => { setAviso(null); setEtapa((etapa - 1) as Etapa); }} />}
      {etapa === 1 ? (
        <Botao rotulo="Continuar" aoTocar={() => setEtapa(2)} />
      ) : etapa === 2 ? (
        <Botao rotulo="Ver prévia" aoTocar={verPrevia} />
      ) : (
        <Botao rotulo={previa ? rotuloDoConfirmar(previa.dados) : 'Renegociar'} aoTocar={confirmar} carregando={enviando}
          desabilitado={!previa} motivo={carregando ? 'Calculando a prévia…' : 'Sem a prévia do servidor não dá para confirmar.'} />
      )}
    </>
  );

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} rodape={rodape}
      faixa={bloqueio ? undefined : <Etapas etapa={etapa} estreita={width < LARGURA_DAS_ETAPAS} />}>
      <View style={estilos.coluna}>
        {bloqueio ? <View aria-live="assertive"><Alerta tom="perigo" texto={bloqueio} /></View> : null}
        {!bloqueio && aviso ? <Alerta tom="perigo" texto={aviso} /> : null}
        {!bloqueio && etapa === 1 ? <EtapaDasCobrancas separacao={separacao} hoje={hoje} /> : null}
        {!bloqueio && etapa === 2 ? (
          <>
            {separacao.alunoNome ? <Texto variante="suave">{`${quantasCobrancas(entram.length)} de ${separacao.alunoNome}.`}</Texto> : null}
            <CamposEmLinha>
              <CampoMoeda ref={refAcrescimo} rotulo="Acréscimo (opcional)" texto={acrescimo} mascara erro={erroDe('acrescimo')}
                aoMudar={mudar('acrescimo', setAcrescimo)} ajuda="Multa ou juros combinados. Somado ao total." />
              <CampoMoeda ref={refDesconto} rotulo="Desconto (opcional)" texto={desconto} mascara erro={erroDe('desconto')}
                aoMudar={mudar('desconto', setDesconto)} ajuda="Abatido do total." />
            </CamposEmLinha>
            <CamposEmLinha>
              <Campo ref={refParcelas} rotulo="Parcelas" valor={parcelas} numerico keyboardType="number-pad" inputMode="numeric" maxLength={2}
                aoMudar={mudar('parcelas', (t) => setParcelas(t.replace(/\D/g, '')))} erro={erroDe('parcelas')}
                ajuda={`De 1 a ${LIMITES_DA_RENEGOCIACAO.parcelas}, uma por mês, de valores iguais.`} />
              <CampoData ref={refVencimento} rotulo="Primeiro vencimento" valor={vencimento} regra="PLANEJAMENTO" erro={erroDe('primeiroVencimento')}
                aoMudar={mudar('primeiroVencimento', setVencimento)} />
            </CamposEmLinha>
            <Campo ref={refMotivo} rotulo="Motivo" valor={motivo} linhas={3} maxLength={LIMITES_DA_RENEGOCIACAO.motivo}
              aoMudar={mudar('motivo', setMotivo)} erro={erroDe('motivo')}
              ajuda={`Só a equipe vê; o aluno não. ${motivo.trim().length} de ${LIMITES_DA_RENEGOCIACAO.motivo} caracteres.`} />
          </>
        ) : null}
        {!bloqueio && etapa === 3 ? (
          <EtapaDaPrevia previa={previa?.dados ?? null} carregando={carregando} erro={erroDaPrevia}
            tentarDeNovo={verPrevia} erroDoEnvio={erroDoEnvio} />
        ) : null}
      </View>
    </Folha>
  );
}

/** Etapa 1: as que entram (o valor e a data de cada, como na lista) e as que ficam de fora, com o motivo. Nada é somado aqui. */
function EtapaDasCobrancas({ separacao, hoje }: { separacao: SeparacaoDaRenegociacao<CobrancaResponse>; hoje: string }) {
  const { entram, ficam, alunoNome, problema } = separacao;
  return (
    <>
      <Texto variante="suave">Só cobranças em aberto (vencidas incluídas) de mensalidade ou avulsa, de um aluno por vez. O total e as parcelas vêm do servidor na prévia.</Texto>
      {problema ? <View aria-live="polite"><Alerta tom="atencao" texto={problema} /></View> : null}
      {entram.length > 0 && !problema ? (
        <View style={estilos.grupo}>
          <Texto variante="secao" nivel={3}>{alunoNome ? `Entram no acordo · ${alunoNome}` : 'Entram no acordo'}</Texto>
          <ListaDeCobrancas itens={entram.map((c) => ({ cobranca: c, motivo: null }))} hoje={hoje} rotulo="Cobranças que entram no acordo" alunoDaVez={alunoNome} />
        </View>
      ) : null}
      {ficam.length > 0 ? (
        <View style={estilos.grupo}>
          <Divisor />
          <Texto variante="secao" nivel={3}>{`Ficam de fora (${ficam.length})`}</Texto>
          <ListaDeCobrancas itens={ficam} hoje={hoje} rotulo="Cobranças que ficam de fora" alunoDaVez={problema ? null : alunoNome} />
        </View>
      ) : null}
      {problema && entram.length > 0 ? (
        <View style={estilos.grupo}>
          <Divisor />
          <Texto variante="secao" nivel={3}>Selecionadas</Texto>
          <ListaDeCobrancas itens={entram.map((c) => ({ cobranca: c, motivo: null }))} hoje={hoje} rotulo="Cobranças selecionadas" alunoDaVez={null} />
        </View>
      ) : null}
    </>
  );
}

/** Cada cobrança com o valor e a data da lista, o selo da situação e o do tipo; o nome do aluno só quando não é o "da vez". */
function ListaDeCobrancas({ itens, hoje, rotulo, alunoDaVez }: {
  itens: readonly { cobranca: CobrancaResponse; motivo: string | null }[]; hoje: string; rotulo: string; alunoDaVez: string | null;
}) {
  return (
    <View role="list" accessibilityLabel={rotulo}>
      {itens.map(({ cobranca: c, motivo }, i) => {
        const selo = seloDaCobranca(c);
        const doTipo = seloDoTipoDaCobranca(c.tipo);
        return (
          <View key={c.id} role="listitem">
            {i > 0 ? <Divisor /> : null}
            <View style={estilos.linha}>
              <View style={estilos.texto}>
                <Texto numberOfLines={2}>{c.alunoNome === alunoDaVez ? referenciaDaCobranca(c) : `${c.alunoNome ?? '—'} · ${referenciaDaCobranca(c)}`}</Texto>
                <Texto variante="pequeno" numerico>{resumoDaCobranca(c, hoje).replace(/R\$ /g, 'R$ ')}</Texto>
                {motivo ? <Texto variante="pequeno">{motivo}</Texto> : null}
              </View>
              <View style={estilos.selos}>
                <Selo texto={selo.rotulo} tipo={selo.tom} />
                {doTipo ? <Selo texto={doTipo.rotulo} tipo={doTipo.tom} /> : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Etapa 3: carregando, erro com "Tentar de novo" ou a prévia do servidor (resumo, parcelas e o que acontece). */
function EtapaDaPrevia({ previa, carregando, erro, tentarDeNovo, erroDoEnvio }: {
  previa: PreviaDaRenegociacao | null;
  carregando: boolean;
  erro: { mensagem: string; erro: unknown } | null;
  tentarDeNovo: () => void;
  erroDoEnvio: string | null;
}) {
  if (erro) return <MensagemErro texto={erro.mensagem} erro={erro.erro} tentarDeNovo={tentarDeNovo} />;
  if (!previa || carregando) return <Esqueleto texto="Calculando a prévia no servidor…" cartoes={2} />;
  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: `Cobranças originais (${previa.quantidadeDeOriginais})`, valor: reais(previa.somaDosOriginaisCentavos) },
    ...(previa.acrescimoCentavos > 0 ? [{ rotulo: 'Acréscimo', valor: `+${reais(previa.acrescimoCentavos)}` }] : []),
    ...(previa.descontoCentavos > 0 ? [{ rotulo: 'Desconto', valor: `−${reais(previa.descontoCentavos)}` }] : []),
  ];
  return (
    <>
      <View style={estilos.grupo} aria-live="polite">
        {linhas.map((l) => (
          <View key={l.rotulo} style={estilos.linhaDoResumo} accessible accessibilityLabel={`${l.rotulo}: ${l.valor}`}>
            <Texto variante="suave">{l.rotulo}</Texto>
            <Texto numerico>{l.valor}</Texto>
          </View>
        ))}
        <Divisor />
        <View style={estilos.linhaDoResumo} accessible accessibilityLabel={`Total do acordo: ${reais(previa.totalCentavos)}`}>
          <Texto variante="bloco">Total do acordo</Texto>
          <Texto variante="bloco" numerico>{reais(previa.totalCentavos)}</Texto>
        </View>
      </View>
      <View style={estilos.grupo}>
        <Divisor />
        <Texto variante="secao" nivel={3}>{`Parcelas (${previa.parcelas.length})`}</Texto>
        <View role="list" accessibilityLabel="Parcelas do acordo">
          {previa.parcelas.map((p, i) => (
            <View key={p.numero} role="listitem">
              {i > 0 ? <Divisor /> : null}
              <View style={estilos.linha}>
                <View style={estilos.texto}>
                  <Texto numberOfLines={2}>{p.descricao}</Texto>
                  <Texto variante="pequeno" numerico>Vence em {dataParaTela(p.vencimento)}</Texto>
                </View>
                <Texto numerico>{reais(p.valorCentavos)}</Texto>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={estilos.grupo}>
        <Divisor />
        <Texto variante="secao" nivel={3}>O que acontece</Texto>
        {oQueAcontece(previa).map((frase) => <Texto key={frase} variante="suave">{`• ${frase}`}</Texto>)}
      </View>
      {erroDoEnvio ? <View aria-live="assertive"><MensagemErro texto={erroDoEnvio} /></View> : null}
    </>
  );
}

/**
 * Indicador das três etapas sob o título, o mesmo desenho da cobrança avulsa (cópia local: a peça ainda não está em `ui/`):
 * a atual com o número cheio e sublinhado em `texto`, as feitas com ✓, as próximas suaves. Estreito, uma linha só.
 */
function Etapas({ etapa, estreita }: { etapa: Etapa; estreita: boolean }) {
  const { cores } = useTema();
  const nome = NOMES_DAS_ETAPAS[etapa];
  const rotulo = `Etapa ${etapa} de 3: ${nome}`;
  if (estreita) {
    return <View aria-live="polite"><Texto variante="rotulo" cor={cores.texto} accessibilityLabel={rotulo}>{`Etapa ${etapa} de 3 · ${nome}`}</Texto></View>;
  }
  return (
    <View style={estilos.etapas} accessible accessibilityLabel={rotulo} aria-live="polite">
      {([1, 2, 3] as const).map((n) => {
        const atual = n === etapa;
        const feita = n < etapa;
        return (
          <View key={n} style={[estilos.etapa, { borderBottomColor: atual ? cores.texto : cores.borda }]}>
            <View style={[estilos.bolinha, { borderColor: atual || feita ? cores.texto : cores.bordaCampo, backgroundColor: atual ? cores.texto : 'transparent' }]}>
              {feita ? <Check size={14} color={cores.texto} aria-hidden /> : <Texto variante="pequeno" cor={atual ? cores.fundo : cores.textoSuave}>{n}</Texto>}
            </View>
            <Texto variante={atual ? 'rotulo' : 'pequeno'} cor={atual ? cores.texto : cores.textoSuave} numberOfLines={2} style={estilos.texto}>{NOMES_DAS_ETAPAS[n]}</Texto>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1), minHeight: 44 },
  linhaDoResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), minHeight: 32 },
  texto: { flex: 1, minWidth: 0, gap: 2 },
  selos: { alignItems: 'flex-end', gap: espaco(0.5) },
  etapas: { flexDirection: 'row', gap: espaco(1) },
  etapa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingVertical: espaco(0.5), borderBottomWidth: 2 },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

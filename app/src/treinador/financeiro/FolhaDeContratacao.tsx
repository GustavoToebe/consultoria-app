import { errosPorCampo } from '@plataforma/web';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ContratacaoResponse, PlanoResponse } from '../../api/financeiroTipos';
import { contratarPlano, previaDeGeracao, type ContratarComGeracaoRequest } from '../../api/financeiroF1';
import { alterarContratacao, listarPlanosComerciais } from '../../api/rotas';
import {
  AJUDA_GERAR_MESES_ANTERIORES, inicioAntesDoMesCorrente, PREVIA_CARREGANDO, PREVIA_ERRO, PREVIA_INCOMPLETA, ROTULO_GERAR_MESES_ANTERIORES,
  textoDaPrevia,
} from '../../dominio/contratarNoPassado';
import { hojeEmBrasilia, LIMITES, rotuloDaPeriodicidade, validarContratacao } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { planoPodeTerMinimo, validarMinimoAte } from '../../dominio/saidaDoPlano';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoData, CampoNumerico, Interruptor } from '../../ui/Campos';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';

type PedidoDaPrevia = ContratarComGeracaoRequest & { alunoId: string };

/**
 * Folha de contratar (ou alterar) o plano comercial do aluno, aberta pelo cartão "Plano contratado". Ao contratar com início
 * num mês anterior ao corrente (Brasília), aparece o interruptor dos meses anteriores (D10), desligado por padrão; ligado, a
 * prévia da API diz quantas mensalidades nascem em aberto e o total (o app não conta nem soma). A prévia é refeita a cada
 * mudança do corpo, com espera curta enquanto digita; resposta de um corpo que já mudou é descartada (`useCarregar`).
 */
export function FolhaDeContratacao({ alunoId, contratacao, aoFechar, aoMudar }: {
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
  const [gerarAnteriores, setGerarAnteriores] = useState(false);
  const [minimoTexto, setMinimoTexto] = useState(dataParaTela(contratacao?.minimoAte));
  const [erroDoMinimoNoServidor, setErroDoMinimoNoServidor] = useState<string | null>(null);
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
  // O fim do mínimo só se edita em contratação mensal; nas outras o `PUT` reenvia o que já está gravado.
  const editaMinimo = !!contratacao && planoPodeTerMinimo(contratacao.periodicidade);
  const minimo = contratacao && editaMinimo ? validarMinimoAte(minimoTexto, contratacao.inicio) : null;
  const erroDoMinimo = (tentou ? minimo?.erro : null) ?? erroDoMinimoNoServidor;
  const motivoVisivel = diferente || !!contratacao?.motivoValor;
  const motivoValor = motivoVisivel ? motivo.trim() || null : null;

  // D10: o interruptor só existe ao contratar com início num mês anterior; escondido, vale desligado (o estado guardado não
  // conta), para quem ligou e depois trouxe o início para este mês.
  const comInterruptor = !contratacao && inicioAntesDoMesCorrente(iso);
  const gerarMesesAnteriores = comInterruptor && gerarAnteriores;
  const corpo: ContratarComGeracaoRequest | null = !contratacao && !problema && planoId && dia !== null && iso
    ? { planoComercialId: planoId, valorCentavos: diferente ? centavos : null, motivoValor, inicio: iso, diaVencimento: dia, gerarMesesAnteriores }
    : null;
  const pedido: PedidoDaPrevia | null = gerarMesesAnteriores && corpo ? { alunoId, ...corpo } : null;
  const chavePedida = pedido ? JSON.stringify(pedido) : null;
  const chaveDaPrevia = useAtrasado(chavePedida, 400);
  const previa = useCarregar(chaveDaPrevia, (chave) => {
    const daChave: PedidoDaPrevia = JSON.parse(chave);
    return previaDeGeracao(daChave);
  });
  // Enquanto a espera não passou ou a resposta é de outro corpo, a tela diz "calculando" (nunca o número velho).
  const previaEmDia = chavePedida !== null && chaveDaPrevia === chavePedida && !previa.carregando;
  const previaCarregando = chavePedida !== null && !previaEmDia;

  const enviar = () => {
    setTentou(true);
    if (problema || !planoId || dia === null || minimo?.erro || previaCarregando) return;
    setEnviando(true);
    setErro(null);
    setErroDoMinimoNoServidor(null);
    // O `PUT` substitui inteiro: `minimoAte` vai sempre (vazio apaga).
    const minimoAte = editaMinimo ? (minimo?.iso ?? null) : (contratacao?.minimoAte ?? null);
    const chamada = contratacao
      ? alterarContratacao(contratacao.id, { valorCentavos: centavos as number, motivoValor, diaVencimento: dia, minimoAte, versao: contratacao.versao })
      : contratarPlano(alunoId, {
        planoComercialId: planoId, valorCentavos: diferente ? centavos : null, motivoValor, inicio: iso as string, diaVencimento: dia, gerarMesesAnteriores,
      });
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
        const doMinimo = errosPorCampo(e).minimoAte;
        if (doMinimo) { setErroDoMinimoNoServidor(doMinimo); return; }
        setErro(e);
      },
    );
  };

  return (
    <Folha visivel titulo={contratacao ? 'Alterar contratação' : 'Contratar plano'} aoFechar={aoFechar}
      rodape={(
        <Botao rotulo={contratacao ? 'Salvar contratação' : 'Contratar plano'} aoTocar={enviar} carregando={enviando}
          desabilitado={previaCarregando} motivo={previaCarregando ? PREVIA_CARREGANDO : undefined} />
      )}>
      <View style={estilos.bloco}>
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
        <CampoMoeda mascara rotulo={contratacao ? 'Valor' : 'Valor, em branco usa o do plano'} texto={valor} aoMudar={setValor}
          ajuda={plano ? `Valor do plano: ${centavosParaTela(plano.valorCentavos)}. Digite outro só se combinou diferente.` : undefined} />
        {motivoVisivel ? (
          <Campo rotulo="Motivo do valor diferente" valor={motivo} aoMudar={setMotivo} maxLength={LIMITES.motivoDoValor}
            ajuda="Obrigatório quando o valor não é o do plano." />
        ) : null}
        {contratacao ? null : <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />}
        {comInterruptor ? (
          <View style={estilos.interruptorComPrevia}>
            <Interruptor rotulo={ROTULO_GERAR_MESES_ANTERIORES} valor={gerarAnteriores} aoMudar={setGerarAnteriores} ajuda={AJUDA_GERAR_MESES_ANTERIORES} />
            {gerarMesesAnteriores ? (
              <PreviaDosMesesAnteriores incompleta={!pedido} carregando={previaCarregando} erro={previaEmDia ? previa.erro : undefined}
                texto={previaEmDia && previa.dados ? textoDaPrevia(previa.dados) : null} tentarDeNovo={previa.recarregar} />
            ) : null}
          </View>
        ) : null}
        <CampoNumerico rotulo="Dia do vencimento" inteiro valor={dia} aoMudar={setDia} ajuda="De 1 a 31. Em meses mais curtos, vale o último dia do mês." />
        {editaMinimo ? (
          <View style={estilos.campoComAjuda}>
            <CampoData rotulo="Fim do tempo mínimo" valor={minimoTexto} erro={erroDoMinimo}
              aoMudar={(t) => { setMinimoTexto(t); setErroDoMinimoNoServidor(null); }} />
            <Texto variante="pequeno">Até quando vale o tempo mínimo deste aluno. Em branco, a contratação fica sem mínimo.</Texto>
          </View>
        ) : null}
        {tentou && problema ? <MensagemErro texto={problema} /> : null}
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
    </Folha>
  );
}

/** O resultado da prévia, logo abaixo do interruptor; anunciado ao leitor de tela quando muda (região viva educada). */
function PreviaDosMesesAnteriores({ incompleta, carregando, erro, texto, tentarDeNovo }: {
  incompleta: boolean;
  carregando: boolean;
  erro: unknown;
  texto: string | null;
  tentarDeNovo: () => void;
}) {
  if (erro) return <MensagemErro texto={PREVIA_ERRO} erro={erro} tentarDeNovo={tentarDeNovo} />;
  const frase = incompleta ? PREVIA_INCOMPLETA : carregando || !texto ? PREVIA_CARREGANDO : texto;
  return (
    <View accessibilityLiveRegion="polite" aria-live="polite" role="status">
      <Texto variante={incompleta || carregando ? 'suave' : 'rotulo'}>{frase}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  campoComAjuda: { gap: espaco(0.5) },
  // A prévia é o resultado da escolha, não parte da ajuda: um pouco mais de espaço que entre a ajuda e o rótulo.
  interruptorComPrevia: { gap: espaco(1) },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { previaDoContrato, type PreviaDoContrato, type PreviaDoContratoRequest } from '../../api/financeiroContrato';
import type { FormaDePagamento, ModoDeCobranca } from '../../api/financeiroTipos';
import {
  cobrancasCriadas, corpoDaPreviaDoContrato, ehModoFechado, estadoDoCriar, LEGENDA_DAS_PARCELAS, LIMITES_DO_CONTRATO, linhaDaConferencia, NOTA_DO_RESUMO,
  errosNaLinha, ordemPorVencimento, parcelasDaPrevia, parcelasParaEditar, parcelasResumidas, primeiroVencimentoSugerido, rotuloDoModo, traduzirErroDoContrato, validarContrato,
  type CampoDoContrato, type ContratoDigitado, type ErrosDoContrato, type ParcelaDigitada,
} from '../../dominio/contratoFechado';
import { FORMAS_MANUAIS, hojeEmBrasilia } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { LinhaDeDado, ListaDeDados } from '../../ui/ListaDeDados';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CampoMoeda } from './comum';
import { PassoDeDias } from './PassoDeDias';

/**
 * O contrato fechado dentro da folha de contratar (`docs/planos/contrato-fechado.md`): estado dos campos, a prévia do
 * servidor e as peças que os mostram. O app não faz conta de dinheiro (D14): "Dividir o restante igual", a tabela das
 * parcelas e a linha "A soma fecha" vêm de `POST /contratacoes/previa-do-contrato`, pedida com espera curta enquanto
 * digita (`useAtrasado`); resposta de um corpo que já mudou não vale (`emDia`). As parcelas editadas ficam aqui (`editadas`):
 * nulo = o servidor divide; mudar a quantidade ou o primeiro vencimento volta a nulo (a lista antiga não serve mais);
 * mudar o total ou a entrada mantém a edição, e a conferência mostra a soma errada.
 */
export function useContrato(modo: ModoDeCobranca) {
  const hoje = hojeEmBrasilia();
  const [totalTexto, setTotalTexto] = useState('');
  const [semEntrada, setSemEntrada] = useState(false);
  const [entradaTexto, setEntradaTexto] = useState('');
  const [entradaDataTexto, setEntradaDataTexto] = useState(() => dataParaTela(hoje));
  const [entradaJaPaga, setEntradaJaPaga] = useState(false);
  const [entradaForma, setEntradaForma] = useState<FormaDePagamento | null>(null);
  const [quantidade, setQuantidadeBruta] = useState(3);
  const [primeiroVencimentoTexto, setPrimeiroBruto] = useState(() => primeiroVencimentoSugerido(hoje));
  const [editadas, setEditadas] = useState<ParcelaDigitada[] | null>(null);
  const [doServidor, setDoServidor] = useState<ErrosDoContrato>({});

  const fechado = ehModoFechado(modo) ? modo : null;
  const digitado: ContratoDigitado | null = fechado ? {
    modo: fechado, totalTexto, semEntrada, entradaTexto, entradaDataTexto, entradaJaPaga, entradaForma, quantidade, primeiroVencimentoTexto,
  } : null;
  const validado = digitado ? validarContrato(digitado) : null;
  const corpo = digitado && validado ? corpoDaPreviaDoContrato(digitado, validado, editadas) : null;
  const chavePedida = corpo ? JSON.stringify(corpo) : null;
  const chave = useAtrasado(chavePedida, 400);
  const previa = useCarregar(chave, (k) => {
    const pedido: PreviaDoContratoRequest = JSON.parse(k);
    return previaDoContrato(pedido);
  });
  // Só vale a resposta do corpo que está na tela: enquanto espera, nada habilita nem fica à vista como certo.
  const emDia = chavePedida !== null && chave === chavePedida && !previa.carregando;
  const dadosEmDia: PreviaDoContrato | null = emDia && !previa.erro ? previa.dados ?? null : null;
  // A tela fica na ordem digitada; a API vê as parcelas por vencimento (`ordem[k]` = a linha da parcela k).
  const ordem = editadas ? ordemPorVencimento(editadas) : null;
  // 422 da prévia (ex.: entrada acima do total) vai para o campo, como o do contratar; o da parcela, para a linha dela.
  const traduzido = emDia && previa.erro ? traduzirErroDoContrato(previa.erro) : null;
  const daPrevia = traduzido ? { ...traduzido, campos: errosNaLinha(traduzido.campos, ordem) } : null;

  const limpar = (campo: CampoDoContrato) => setDoServidor((e) => {
    if (!e[campo]) return e;
    const resto = { ...e };
    delete resto[campo];
    return resto;
  });
  const com = <T,>(campo: CampoDoContrato, definir: (v: T) => void) => (v: T) => { definir(v); limpar(campo); };

  const editar = (i: number, campo: keyof ParcelaDigitada, texto: string) => {
    // Sem a prévia em dia não há lista certa para editar (a quantidade acabou de mudar, por exemplo).
    const base = editadas ?? (dadosEmDia ? parcelasParaEditar(dadosEmDia) : null);
    if (!base) return;
    setEditadas(base.map((p, j) => (j === i ? { ...p, [campo]: texto } : p)));
    limpar('parcelas');
    limpar(campo === 'vencimentoTexto' ? `vencimento${i}` : `valor${i}`);
  };

  const estado = fechado && validado
    // O 422 da prévia (ex.: entrada acima do total) conta como campo destacado, como o erro local.
    ? estadoDoCriar(fechado, Object.keys(validado.erros).length > 0 || Object.keys(daPrevia?.campos ?? {}).length > 0, { emDia, dados: dadosEmDia, erro: !!previa.erro, pedida: chavePedida !== null })
    : null;

  return {
    fechado, digitado, validado, previa, emDia, dadosEmDia, chavePedida, daPrevia, editadas, ordem, estado,
    erros: { ...(daPrevia?.campos ?? {}), ...doServidor },
    // O contratar manda as parcelas da prévia (ordenadas): o índice do erro volta para a linha da tela.
    definirErrosDoServidor: (campos: ErrosDoContrato) => setDoServidor(errosNaLinha(campos, ordem)),
    campos: {
      totalTexto, setTotalTexto: com('total', setTotalTexto),
      semEntrada, setSemEntrada: com('entrada', setSemEntrada),
      entradaTexto, setEntradaTexto: com('entrada', setEntradaTexto),
      entradaDataTexto, setEntradaDataTexto: com('entradaData', setEntradaDataTexto),
      entradaJaPaga, setEntradaJaPaga: com('entradaForma', setEntradaJaPaga),
      entradaForma, setEntradaForma: com('entradaForma', setEntradaForma),
      quantidade, setQuantidade: (n: number) => { setQuantidadeBruta(n); setEditadas(null); limpar('parcelas'); limpar('quantidade'); },
      primeiroVencimentoTexto, setPrimeiroVencimentoTexto: (t: string) => { setPrimeiroBruto(t); setEditadas(null); limpar('primeiroVencimento'); },
      dividirIgual: () => { setEditadas(null); limpar('parcelas'); },
      editar,
    },
  };
}

export type Contrato = ReturnType<typeof useContrato>;

/** Valor total, entrada e (nas parcelas fixas) o passo, o primeiro vencimento, a tabela e a conferência. */
export function CamposDoContrato({ contrato, tentou }: { contrato: Contrato; tentou: boolean }) {
  const { fechado, validado, campos: c } = contrato;
  if (!fechado || !validado) return null;
  // Erro local só depois da primeira tentativa (como o resto da folha); o do servidor, sempre.
  const erroDe = (campo: CampoDoContrato) => contrato.erros[campo] ?? (tentou ? validado.erros[campo] : undefined) ?? null;
  return (
    <>
      <CampoMoeda mascara rotulo="Valor total do contrato" texto={c.totalTexto} aoMudar={c.setTotalTexto} erro={erroDe('total')}
        ajuda="O valor fechado com o aluno, somando a entrada e o resto." />
      <View style={estilos.grupo}>
        <Texto variante="secao" nivel={3}>Entrada</Texto>
        <Interruptor rotulo="Sem entrada" valor={c.semEntrada} aoMudar={c.setSemEntrada} />
        {c.semEntrada ? null : (
          <>
            <CamposEmLinha minimo={200}>
              <CampoMoeda mascara rotulo="Valor da entrada" texto={c.entradaTexto} aoMudar={c.setEntradaTexto} erro={erroDe('entrada')} />
              <CampoData rotulo="Data da entrada" valor={c.entradaDataTexto} aoMudar={c.setEntradaDataTexto} erro={erroDe('entradaData')} />
            </CamposEmLinha>
            <Interruptor rotulo="A entrada já foi paga" valor={c.entradaJaPaga} aoMudar={c.setEntradaJaPaga}
              ajuda="Ligado, a entrada já nasce paga. Desligado, nasce em aberto e pode ser paga pelo link ou com baixa manual." />
            {c.entradaJaPaga ? (
              <Escolha rotulo="Como foi paga" valor={c.entradaForma} aoMudar={c.setEntradaForma} erro={erroDe('entradaForma')}
                opcoes={FORMAS_MANUAIS.map((f) => ({ valor: f.valor as FormaDePagamento | null, rotulo: f.rotulo }))} />
            ) : null}
          </>
        )}
      </View>
      {fechado === 'PARCELADO_FIXO' ? <ParcelasDoContrato contrato={contrato} erroDe={erroDe} /> : (
        <View style={estilos.grupo}>
          <Texto variante="secao" nivel={3}>Saldo</Texto>
          <Texto variante="suave">O resto do valor total fica em aberto: cada pagamento do aluno você registra no cartão do plano, com o valor e a data, quando ele pagar.</Texto>
          <Conferencia contrato={contrato} pedida={contrato.chavePedida !== null} dados={contrato.dadosEmDia} />
        </View>
      )}
    </>
  );
}

function ParcelasDoContrato({ contrato, erroDe }: { contrato: Contrato; erroDe: (c: CampoDoContrato) => string | null }) {
  const { campos: c, dadosEmDia, emDia, previa, editadas, chavePedida, ordem } = contrato;
  // Linhas: as editadas, senão as da última resposta (enquanto a nova não chega, esmaecidas e sem toque).
  const daResposta = previa.dados ?? null;
  const linhas: (ParcelaDigitada & { descricao: string })[] = (editadas ?? (daResposta ? parcelasParaEditar(daResposta) : []))
    .map((p, i, todas) => {
      // O rótulo é o da posição da linha na ordem por vencimento (a mesma da API), não o da posição na tela.
      const k = ordem ? ordem.indexOf(i) : i;
      return { ...p, descricao: (daResposta ? parcelasDaPrevia(daResposta)[k]?.descricao : undefined) ?? `Parcela ${k + 1}/${todas.length}` };
    });
  const esperando = !editadas && !emDia;
  const entrada = contrato.validado?.entrada ?? null;
  return (
    <View style={estilos.grupo}>
      <Texto variante="secao" nivel={3}>Parcelas</Texto>
      <CamposEmLinha minimo={200}>
        <PassoDeDias rotulo="Quantidade de parcelas" valor={c.quantidade} minimo={1} maximo={LIMITES_DO_CONTRATO.parcelas} aoMudar={c.setQuantidade}
          texto={(n) => (n === 1 ? '1 parcela' : `${n} parcelas`)} ajuda={`De 1 a ${LIMITES_DO_CONTRATO.parcelas}.`} erro={erroDe('quantidade')} />
        <CampoData rotulo="Primeiro vencimento" valor={c.primeiroVencimentoTexto} aoMudar={c.setPrimeiroVencimentoTexto} erro={erroDe('primeiroVencimento')} />
        <CampoLeitura rotulo="Repetir" valor="Todo mês" />
      </CamposEmLinha>
      <View style={estilos.linhaDoDividir}>
        <Botao rotulo="Dividir o restante igual" tipo="secundario" aoTocar={c.dividirIgual} desabilitado={!editadas}
          motivo={editadas ? undefined : 'As parcelas já estão divididas igualmente pelo servidor.'} />
      </View>
      <Texto variante="pequeno">{LEGENDA_DAS_PARCELAS}</Texto>
      {linhas.length > 0 || entrada ? (
        <View style={esperando ? estilos.esperando : null} pointerEvents={esperando ? 'none' : 'auto'} aria-busy={esperando}>
          <Tabela rotulo="Cobranças do contrato" chave={(l) => l.chave} larguraMinima={480} vao={espaco(2)}
            linhas={[
              ...(entrada ? [{ chave: 'entrada', tipo: 'entrada' as const, i: -1 }] : []),
              ...linhas.map((_, i) => ({ chave: `p${i}`, tipo: 'parcela' as const, i })),
            ]}
            colunas={[
              { chave: 'cobranca', titulo: 'Cobrança', flex: 1, minimo: 110, principal: true,
                render: (l) => <Texto>{l.tipo === 'entrada' ? 'Entrada' : linhas[l.i].descricao}</Texto> },
              { chave: 'vencimento', titulo: 'Vencimento', largura: 190,
                render: (l) => (l.tipo === 'entrada' && entrada
                  ? <Texto variante="suave">{`${dataParaTela(entrada.data)}: ${entrada.jaPaga ? 'já paga' : 'nasce em aberto'}`}</Texto>
                  : <CampoData rotulo="Vencimento" rotuloOculto rotuloAcessivel={`Vencimento da parcela ${l.i + 1}`} valor={linhas[l.i].vencimentoTexto}
                      erro={erroDe(`vencimento${l.i}`)} aoMudar={(t) => c.editar(l.i, 'vencimentoTexto', t)} />) },
              { chave: 'valor', titulo: 'Valor', largura: 160, alinhar: 'direita',
                render: (l) => (l.tipo === 'entrada' && entrada
                  ? <Texto numerico>{centavosParaTela(entrada.valorCentavos)}</Texto>
                  : <CampoMoeda mascara rotulo="Valor" rotuloOculto rotuloAcessivel={`Valor da parcela ${l.i + 1}`} texto={linhas[l.i].valorTexto}
                      erro={erroDe(`valor${l.i}`)} aoMudar={(t) => c.editar(l.i, 'valorTexto', t)} />) },
            ]} />
        </View>
      ) : null}
      {erroDe('parcelas') ? <MensagemErro texto={erroDe('parcelas') as string} /> : null}
      <Conferencia contrato={contrato} pedida={chavePedida !== null} dados={dadosEmDia} />
    </View>
  );
}

/** A linha de conferência, sempre com o que o servidor disse; anunciada ao leitor de tela quando muda. */
function Conferencia({ contrato, pedida, dados }: { contrato: Contrato; pedida: boolean; dados: PreviaDoContrato | null }) {
  const { emDia, previa, daPrevia, validado, fechado } = contrato;
  if (emDia && previa.erro && daPrevia && Object.keys(daPrevia.campos).length === 0) {
    return <MensagemErro texto="Não foi possível conferir a soma no servidor." erro={previa.erro} tentarDeNovo={previa.recarregar} />;
  }
  const total = validado?.totalCentavos ?? null;
  const conferencia = dados && total !== null && fechado ? linhaDaConferencia(dados, total, fechado) : null;
  const texto = !pedida ? (fechado === 'SALDO_ABERTO' ? 'Preencha o valor total e a entrada para conferir.' : 'Preencha o valor total, a entrada e as parcelas para conferir a soma.') : !conferencia ? (emDia ? null : 'Conferindo a soma no servidor…') : null;
  return (
    <View role="status" aria-live="polite" accessibilityLiveRegion="polite">
      {conferencia ? (
        <Alerta tom={conferencia.fecha ? 'sucesso' : 'perigo'} titulo={conferencia.titulo} texto={conferencia.detalhe} />
      ) : texto ? <Texto variante="suave">{texto}</Texto> : null}
    </View>
  );
}

/**
 * Cartão "Resumo" (à direita no PC, embaixo no celular): só o que a pessoa escolheu e o que a prévia disse, nada somado.
 * No recorrente, só o modo e como as cobranças nascem.
 */
export function ResumoDaContratacao({ modo, contrato, planoNome }: { modo: ModoDeCobranca; contrato: Contrato; planoNome: string | null }) {
  const { cores } = useTema();
  const { fechado, validado, dadosEmDia } = contrato;
  const total = fechado ? centavosDaTela(contrato.campos.totalTexto) : null;
  const entrada = validado?.entrada ?? null;
  return (
    <View style={[estilos.resumo, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]} accessibilityLabel="Resumo do contrato">
      <Texto variante="secao" nivel={3}>Resumo</Texto>
      <ListaDeDados>
        <LinhaDeDado rotulo="Modo" valor={rotuloDoModo(modo)} />
        {planoNome ? <LinhaDeDado rotulo="Plano" valor={planoNome} /> : null}
        {fechado ? (
          <>
            <LinhaDeDado rotulo="Valor total" valor={total !== null ? centavosParaTela(total) : ''} numerico />
            <LinhaDeDado rotulo="Entrada" valor={contrato.campos.semEntrada ? 'Sem entrada' : entrada ? `${centavosParaTela(entrada.valorCentavos)} em ${dataParaTela(entrada.data)}` : ''} numerico />
            {fechado === 'PARCELADO_FIXO' ? <LinhaDeDado rotulo="Parcelas" valor={dadosEmDia ? parcelasResumidas(parcelasDaPrevia(dadosEmDia)) : ''} numerico /> : <LinhaDeDado rotulo="Saldo" valor="Livre, até quitar" />}
            <LinhaDeDado rotulo="Cobranças criadas" valor={cobrancasCriadas(fechado, !contrato.campos.semEntrada, dadosEmDia ? parcelasDaPrevia(dadosEmDia).length : null)} />
          </>
        ) : <LinhaDeDado rotulo="Cobranças" valor="Uma por período, sem data para acabar" />}
      </ListaDeDados>
      <Texto variante="pequeno">{NOTA_DO_RESUMO}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  linhaDoDividir: { flexDirection: 'row', flexWrap: 'wrap' },
  // A lista da resposta anterior enquanto a nova não chega (como a lista de alunos com filtro novo carregando).
  esperando: { opacity: 0.6 },
  resumo: { gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
});

import { ChevronRight, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { CobrancaResponse, ContratacaoResponse, ResumoDoContrato } from '../../api/financeiroTipos';
import {
  alertaDeAtraso, cobrancasDoContrato, detalheDaFalta, motivoSemSaldo, situacaoNoContrato, subtituloDoContrato,
} from '../../dominio/contratoFechado';
import { referenciaDaCobranca, resumoDaCobranca, seloDaCobranca } from '../../dominio/financeiro';
import { centavosParaTela, dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Botao } from '../../ui/Botao';
import { CartaoDeIndicador } from '../../ui/CartaoDeIndicador';
import { Alerta } from '../../ui/Estados';
import { GradeDeIndicadores } from '../../ui/GradeDeIndicadores';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { ListaOuTabela } from './ListaOuTabela';

/**
 * O contrato fechado no cartão "Plano contratado" (`docs/planos/contrato-fechado.md`, prancha da pág. 2): Valor total, Pago
 * e Falta pagar com os números da API (bloco `contrato`; nada é somado aqui), a barra com o texto equivalente, o alerta de
 * atraso (D8: a mesma pílula "Vencida" e o mesmo `perigo` da folha da cobrança, sem cor nova nem tinta de linha), as
 * cobranças do contrato (a lista do aluno filtrada pela contratação) e, no saldo livre, "Registrar pagamento do saldo".
 */
export function ContratoNoCartao({ contratacao, contrato, cobrancas, alunoId, podeRegistrar, aoAbrirCobranca, aoRegistrarPagamento }: {
  contratacao: ContratacaoResponse;
  contrato: ResumoDoContrato;
  cobrancas: readonly CobrancaResponse[] | undefined;
  alunoId: string;
  /** `FINANCEIRO_ALTERAR`, aluno não anonimizado e contratação ATIVA. */
  podeRegistrar: boolean;
  aoAbrirCobranca: (c: CobrancaResponse) => void;
  aoRegistrarPagamento: () => void;
}) {
  const { cores } = useTema();
  const doContrato = cobrancasDoContrato(cobrancas, contratacao.id);
  const alerta = alertaDeAtraso(contrato);
  const semSaldo = motivoSemSaldo(contrato);
  const pago = centavosParaTela(contrato.pagoCentavos);
  const total = centavosParaTela(contrato.valorTotalCentavos);
  const falta = centavosParaTela(contrato.saldoCentavos);
  const saldoLivre = contrato.modo === 'SALDO_ABERTO';
  return (
    <View style={estilos.bloco}>
      <Texto variante="suave" numerico>{subtituloDoContrato(contrato.modo, doContrato, contratacao.inicio, contratacao.terminoVigencia)}</Texto>
      <GradeDeIndicadores minimo={180}>
        <CartaoDeIndicador rotulo="Valor total" valor={total} tamanho="medio" lugar="cartao" />
        <CartaoDeIndicador rotulo="Pago" valor={pago} tom="sucesso" estado={contrato.pagoCentavos > 0 ? 'valor' : 'zero'} tamanho="medio" lugar="cartao"
          detalhe={`${contrato.cobrancasPagas} de ${contrato.cobrancasTotal} ${contrato.cobrancasTotal === 1 ? 'cobrança' : 'cobranças'}`} />
        <CartaoDeIndicador rotulo="Falta pagar" valor={falta} tom="atencao" estado={contrato.saldoCentavos > 0 ? 'valor' : 'zero'} tamanho="medio" lugar="cartao"
          detalhe={detalheDaFalta(doContrato) ?? (contrato.saldoCentavos > 0 ? null : 'Contrato quitado')} />
      </GradeDeIndicadores>
      <View style={estilos.barra}>
        <BarraProgresso feitas={contrato.pagoCentavos} total={contrato.valorTotalCentavos} cor={cores.sucesso} trilho={cores.divisor}
          rotulo="Pago do contrato" valorEmTexto={`Pago ${pago} de ${total}`} />
        <View style={estilos.pontas} aria-hidden>
          <Texto variante="pequeno" numerico>{`Pago ${pago}`}</Texto>
          <Texto variante="pequeno" numerico>{`Falta ${falta}`}</Texto>
        </View>
      </View>
      {alerta ? <Alerta tom="perigo" titulo={alerta.titulo} texto={alerta.texto} /> : null}
      {saldoLivre && podeRegistrar ? (
        <View style={estilos.acao}>
          <Botao rotulo="Registrar pagamento do saldo" Icone={Plus} aoTocar={aoRegistrarPagamento} desabilitado={!!semSaldo} motivo={semSaldo ?? undefined} />
        </View>
      ) : null}
      <View style={estilos.bloco}>
        <Texto variante="secao" nivel={3}>Cobranças do contrato</Texto>
        {doContrato.length > 0 ? (
          <ListaOuTabela rotulo="Cobranças do contrato" linhas={doContrato} chave={(c) => c.id} aoTocar={aoAbrirCobranca} larguraMinima={560} vao={espaco(3)}
            rotuloDaLinha={(c) => `Abrir ${referenciaDaCobranca(c)}, ${seloDaCobranca(c).rotulo}`}
            item={(c) => {
              const selo = seloDaCobranca(c);
              return { titulo: referenciaDaCobranca(c), detalhe: resumoDaCobranca(c), selo: { texto: selo.rotulo, tipo: selo.tom } };
            }}
            colunas={[
              { chave: 'cobranca', titulo: 'Cobrança', flex: 1.2, minimo: 120, principal: true, render: (c) => <Texto numberOfLines={2}>{referenciaDaCobranca(c)}</Texto> },
              { chave: 'vencimento', titulo: 'Vencimento', flex: 1, minimo: 92, render: (c) => <Texto numerico numberOfLines={1}>{dataParaTela(c.vencimento)}</Texto> },
              { chave: 'valor', titulo: 'Valor', flex: 1, minimo: 112, alinhar: 'direita', render: (c) => <Texto numerico>{centavosParaTela(c.valorCentavos)}</Texto> },
              { chave: 'situacao', titulo: 'Situação', largura: 170, render: (c) => <SituacaoNoContrato cobranca={c} /> },
              { chave: 'abrir', titulo: 'Abrir', largura: 24, acao: true, render: () => <View aria-hidden><ChevronRight size={18} color={cores.textoSuave} /></View> },
            ]} />
        ) : <Texto variante="suave">{saldoLivre ? 'Nenhuma cobrança ainda. Cada pagamento do saldo registrado aparece aqui.' : 'Nenhuma cobrança do contrato.'}</Texto>}
        <LinkTexto texto="Ver todas no Financeiro" href={`/treinador/financeiro?aba=cobrancas&alunoId=${encodeURIComponent(alunoId)}` as never} />
      </View>
    </View>
  );
}

/** A pílula da situação (a mesma `seloDaCobranca` da folha da cobrança) e, embaixo, os dias de atraso, o pagamento ou "Vence hoje" (neutro). */
function SituacaoNoContrato({ cobranca }: { cobranca: CobrancaResponse }) {
  const { cores } = useTema();
  const selo = seloDaCobranca(cobranca);
  const linha = situacaoNoContrato(cobranca);
  const atrasada = cobranca.situacao === 'ABERTA' && cobranca.vencida;
  return (
    <View style={estilos.situacao}>
      <View style={estilos.inicio}><Selo texto={selo.rotulo} tipo={selo.tom} /></View>
      {linha ? <Texto variante="pequeno" cor={atrasada ? cores.perigo : undefined} numerico>{linha}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  barra: { gap: espaco(0.75) },
  pontas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: espaco(1) },
  acao: { flexDirection: 'row', flexWrap: 'wrap' },
  situacao: { gap: espaco(0.5) },
  inicio: { flexDirection: 'row' },
});

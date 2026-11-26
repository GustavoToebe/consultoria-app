import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { enfaseDoNumero } from '../../dominio/destaque';
import { motivoDoResultadoNulo, resultadoDoMesParaTela } from '../../dominio/financeiro';
import { useTema } from '../../tema/TemaProvider';
import { corDaEntradaAvulsa } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { CartaoDeIndicador, type TomDoIndicador } from '../../ui/CartaoDeIndicador';
import { GradeDeIndicadores } from '../../ui/GradeDeIndicadores';
import { Texto } from '../../ui/Texto';

/** Com "Meus" os avulsos (e a conta que depende deles) vêm sem valor de propósito: o motivo diz isso. */
const MOTIVO_DO_FILTRO_MEUS = 'Fora do filtro “Meus”';

/**
 * Célula mínima dos quatro números (variante `titulo`, 26 px, dentro do cartão): "R$ 100.000,00" cabe inteiro. Com o vão
 * de 12: 4 colunas a partir de ~880 px de cartão, 2 + 2 a partir de ~434, 1 abaixo (nunca 3 + 1).
 */
const MINIMO_DA_PARCELA = 211;

/**
 * Resultado do mês: o que entrou menos o que saiu, só do que foi registrado ("entradas − saídas registradas"). Não é
 * lucro nem resultado contábil. Com o filtro "Meus" os lançamentos avulsos ficam de fora e aparecem como "—". Os quatro
 * números na ordem da conta, em colunas iguais (`GradeDeIndicadores`: 4, 2 + 2 ou 1, todos com a mesma altura na linha).
 * Cor como sinal (cartão pintado, Gustavo, 23/11; sem azul nem roxo desde 25/11): recebido das cobranças `sucesso`, entradas
 * avulsas no verde mais claro (`corDaEntradaAvulsa`, o mesmo da seta dos Lançamentos), saídas avulsas `perigo` e o resultado neutro.
 */
export function ResultadoDoMes({ resultado, somenteMeus, periodo }: {
  resultado: ResultadoApi | null | undefined;
  somenteMeus?: boolean;
  /** Pílula sob o título (a do `Cartao`): na Visão geral diz que o cartão é o mês atual, não o período do filtro. */
  periodo?: string;
}) {
  const verdeDaEntrada = corDaEntradaAvulsa(useTema().variante);
  const r = resultadoDoMesParaTela(resultado);
  const motivo = somenteMeus ? MOTIVO_DO_FILTRO_MEUS : undefined;
  // Resultado nulo: o motivo fica escrito sob o "—" (nunca zero). Resultado 0 de verdade segue "R$ 0,00".
  const motivoDoResultado = typeof resultado?.resultadoCentavos === 'number' ? undefined : motivoDoResultadoNulo({
    somenteMeus, entradas: resultado?.entradasAvulsasCentavos, saidas: resultado?.saidasAvulsasCentavos,
  }) ?? undefined;
  return (
    <Cartao titulo={r.rotulo} descricao={r.descricao} periodo={periodo}>
      <GradeDeIndicadores minimo={MINIMO_DA_PARCELA}>
        <Parcela rotulo="Recebido das cobranças" valor={r.recebido} centavos={r.centavos.recebido} tom="sucesso" />
        <Parcela rotulo="Entradas avulsas" valor={r.entradas} centavos={r.centavos.entradas} motivo={motivo} cor={verdeDaEntrada} />
        <Parcela rotulo="Saídas avulsas" valor={r.saidas} centavos={r.centavos.saidas} motivo={motivo} tom="perigo" />
        <Parcela rotulo="Resultado" valor={r.resultado} centavos={r.centavos.resultado} motivo={motivoDoResultado} />
      </GradeDeIndicadores>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

/** Uma parcela da conta: poço dentro do cartão, número `titulo`; zero e "—" sem cor (o "—" com o motivo embaixo). */
function Parcela({ rotulo, valor, centavos, tom = 'neutro', cor, motivo }: {
  rotulo: string; valor: string; centavos: number | null | undefined; tom?: TomDoIndicador; cor?: string; motivo?: string;
}) {
  // A cor vem do `tom`/`cor`; aqui só interessa se é zero ou sem dado (a função de cor não entra: sem azul, 25/11).
  const enfase = enfaseDoNumero(null, centavos);
  const estado = enfase === 'zero' || enfase === 'indisponivel' ? enfase : 'valor';
  return (
    <CartaoDeIndicador rotulo={rotulo} valor={valor} estado={estado} tom={tom} corDeCategoria={cor} motivo={motivo}
      tamanho="medio" lugar="cartao" />
  );
}

import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { enfaseDoNumero } from '../../dominio/destaque';
import { motivoDoResultadoNulo, resultadoDoMesParaTela } from '../../dominio/financeiro';
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
 * Cor como sinal (financeiro 19/11): o recebido das cobranças é sucesso; entradas, saídas e o resultado ficam neutros (saída
 * não é atraso nem erro, e o vermelho diria isso).
 */
export function ResultadoDoMes({ resultado, somenteMeus, periodo }: {
  resultado: ResultadoApi | null | undefined;
  somenteMeus?: boolean;
  /** Pílula sob o título (a do `Cartao`): na Visão geral diz que o cartão é o mês atual, não o período do filtro. */
  periodo?: string;
}) {
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
        <Parcela rotulo="Entradas avulsas" valor={r.entradas} centavos={r.centavos.entradas} motivo={motivo} />
        <Parcela rotulo="Saídas avulsas" valor={r.saidas} centavos={r.centavos.saidas} motivo={motivo} />
        <Parcela rotulo="Resultado" valor={r.resultado} centavos={r.centavos.resultado} motivo={motivoDoResultado} />
      </GradeDeIndicadores>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

/** Uma parcela da conta: poço dentro do cartão, número `titulo`; zero e "—" sem tom (o "—" com o motivo embaixo). */
function Parcela({ rotulo, valor, centavos, tom = 'neutro', motivo }: {
  rotulo: string; valor: string; centavos: number | null | undefined; tom?: TomDoIndicador; motivo?: string;
}) {
  const enfase = enfaseDoNumero(tom === 'neutro' ? null : 'azul', centavos);
  const estado = enfase === 'zero' || enfase === 'indisponivel' ? enfase : 'valor';
  return (
    <CartaoDeIndicador rotulo={rotulo} valor={valor} estado={estado} tom={enfase === 'neutro' ? 'neutro' : tom} motivo={motivo}
      tamanho="medio" lugar="cartao" />
  );
}

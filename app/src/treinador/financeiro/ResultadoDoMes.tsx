import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { enfaseDoNumero, type FuncaoDeDestaque } from '../../dominio/destaque';
import { resultadoDoMesParaTela } from '../../dominio/financeiro';
import { colunasDosIndicadores } from '../../dominio/grade';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Grade } from '../../ui/Grade';
import { NumeroDeDestaque } from '../../ui/NumeroDeDestaque';
import { Texto } from '../../ui/Texto';

/** Com "Meus" os avulsos (e a conta que depende deles) vêm sem valor de propósito: o motivo diz isso. */
const MOTIVO_DO_FILTRO_MEUS = 'Fora do filtro “Meus”';

/**
 * Resultado do mês: o que entrou menos o que saiu, só do que foi registrado ("entradas − saídas registradas"). Não é
 * lucro nem resultado contábil. Com o filtro "Meus" os lançamentos avulsos ficam de fora e aparecem como "—". Os quatro
 * números na ordem da conta, em 4, 2 ou 1 coluna pela largura do cartão (a regra dos indicadores de Interessados, que já
 * acompanha o tamanho do texto): no celular um por linha, para "R$ 100.000,00" caber inteiro no tamanho normal. Cores
 * (D14, a mesma direção da aba Lançamentos, D13): o que entra em azul, o que sai em vermelho (direção, não falha); o
 * resultado, neutro.
 */
export function ResultadoDoMes({ resultado, somenteMeus, periodo }: {
  resultado: ResultadoApi | null | undefined;
  somenteMeus?: boolean;
  /** Pílula sob o título (a do `Cartao`): na Visão geral diz que o cartão é o mês atual, não o período do filtro. */
  periodo?: string;
}) {
  const { fatorTexto } = useTema();
  const r = resultadoDoMesParaTela(resultado);
  const motivo = somenteMeus ? MOTIVO_DO_FILTRO_MEUS : undefined;
  return (
    <Cartao titulo={r.rotulo} descricao={r.descricao} periodo={periodo}>
      <Grade gap={espaco(1.5)} colunas={(l) => colunasDosIndicadores(l, fatorTexto)}>
        <Parcela rotulo="Recebido das cobranças" valor={r.recebido} centavos={r.centavos.recebido} destaque="azul" />
        <Parcela rotulo="Entradas avulsas" valor={r.entradas} centavos={r.centavos.entradas} destaque="azul" motivo={motivo} />
        <Parcela rotulo="Saídas avulsas" valor={r.saidas} centavos={r.centavos.saidas} destaque="vermelho" motivo={motivo} />
        <Parcela rotulo="Resultado" valor={r.resultado} centavos={r.centavos.resultado} destaque={null} motivo={motivo} />
      </Grade>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

/** Uma parcela da conta; o rótulo acessível mantém "Rótulo: valor" do antigo `CampoLeitura`. */
function Parcela({ rotulo, valor, centavos, destaque, motivo }: {
  rotulo: string; valor: string; centavos: number | null | undefined; destaque: FuncaoDeDestaque | null; motivo?: string;
}) {
  return (
    <NumeroDeDestaque rotulo={rotulo} valor={valor} enfase={enfaseDoNumero(destaque, centavos)} motivo={motivo} tamanho="medio"
      rotuloAcessivel={`${rotulo}: ${valor}`} />
  );
}

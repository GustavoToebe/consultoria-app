import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { resultadoDoMesParaTela } from '../../dominio/financeiro';
import { Cartao } from '../../ui/Cartao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Texto } from '../../ui/Texto';

/**
 * Resultado do mês: o que entrou menos o que saiu, só do que foi registrado ("entradas − saídas registradas"). Não é
 * lucro nem resultado contábil. Com o filtro "Meus" os lançamentos avulsos ficam de fora e aparecem como "—". Os quatro
 * números numa linha no PC (dois por linha no celular), na ordem da conta.
 */
export function ResultadoDoMes({ resultado, somenteMeus }: { resultado: ResultadoApi | null | undefined; somenteMeus?: boolean }) {
  const r = resultadoDoMesParaTela(resultado);
  return (
    <Cartao titulo={r.rotulo} descricao={`Mês de ${r.mes}`}>
      <CamposEmLinha>
        <CampoLeitura rotulo="Recebido das cobranças" valor={r.recebido} numerico />
        <CampoLeitura rotulo="Entradas avulsas" valor={r.entradas} numerico />
        <CampoLeitura rotulo="Saídas avulsas" valor={r.saidas} numerico />
        <CampoLeitura rotulo="Resultado" valor={r.resultado} numerico />
      </CamposEmLinha>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

import { StyleSheet, useWindowDimensions, type TextStyle } from 'react-native';

import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { enfaseDoNumero, type FuncaoDeDestaque } from '../../dominio/destaque';
import { resultadoDoMesParaTela } from '../../dominio/financeiro';
import { LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { NumeroDeDestaque } from '../../ui/NumeroDeDestaque';
import { Texto } from '../../ui/Texto';

/**
 * Resultado do mês: o que entrou menos o que saiu, só do que foi registrado ("entradas − saídas registradas"). Não é
 * lucro nem resultado contábil. Com o filtro "Meus" os lançamentos avulsos ficam de fora e aparecem como "—". Os quatro
 * números numa linha no PC (dois por linha no celular), na ordem da conta. Cores (D14, a mesma direção da aba
 * Lançamentos, D13): o que entra em azul, o que sai em vermelho (direção, não falha); o resultado, neutro.
 */
export function ResultadoDoMes({ resultado, somenteMeus, periodo }: {
  resultado: ResultadoApi | null | undefined;
  somenteMeus?: boolean;
  /** Pílula sob o título (a do `Cartao`): na Visão geral diz que o cartão é o mês atual, não o período do filtro. */
  periodo?: string;
}) {
  const r = resultadoDoMesParaTela(resultado);
  // Com "Meus" os avulsos vêm sem valor de propósito: o motivo diz isso em vez de "Sem dados".
  const motivoDosAvulsos = somenteMeus ? 'Fora do filtro “Meus”' : undefined;
  // Dois por linha no celular: em 24 o "R$" se separava do número; em 20 cabe como nos cartões da Visão geral.
  const estiloDoValor = useWindowDimensions().width < LARGURA_MENU_LATERAL ? estilos.valorCelular : undefined;
  return (
    <Cartao titulo={r.rotulo} descricao={r.descricao} periodo={periodo}>
      <CamposEmLinha>
        <Parcela rotulo="Recebido das cobranças" valor={r.recebido} centavos={resultado?.recebidoCentavos} destaque="azul" estilo={estiloDoValor} />
        <Parcela rotulo="Entradas avulsas" valor={r.entradas} centavos={resultado?.entradasAvulsasCentavos} destaque="azul" motivo={motivoDosAvulsos} estilo={estiloDoValor} />
        <Parcela rotulo="Saídas avulsas" valor={r.saidas} centavos={resultado?.saidasAvulsasCentavos} destaque="vermelho" motivo={motivoDosAvulsos} estilo={estiloDoValor} />
        <Parcela rotulo="Resultado" valor={r.resultado} centavos={resultado?.resultadoCentavos} destaque={null} estilo={estiloDoValor} />
      </CamposEmLinha>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

/** Uma parcela da conta; o rótulo acessível mantém "Rótulo: valor" do antigo `CampoLeitura`. */
function Parcela({ rotulo, valor, centavos, destaque, motivo, estilo }: {
  rotulo: string; valor: string; centavos: number | null | undefined; destaque: FuncaoDeDestaque | null; motivo?: string; estilo?: TextStyle;
}) {
  return (
    <NumeroDeDestaque rotulo={rotulo} valor={valor} enfase={enfaseDoNumero(destaque, centavos)} motivo={motivo} tamanho="medio"
      rotuloAcessivel={`${rotulo}: ${valor}`} estiloDoValor={estilo} />
  );
}

const estilos = StyleSheet.create({ valorCelular: { fontSize: 20, lineHeight: 26 } });

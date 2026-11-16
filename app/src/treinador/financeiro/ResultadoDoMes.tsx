import { StyleSheet, View } from 'react-native';
import type { ResultadoDoMes as ResultadoApi } from '../../api/financeiroTipos';
import { enfaseDoNumero, type FuncaoDeDestaque } from '../../dominio/destaque';
import { motivoDoResultadoNulo, resultadoDoMesParaTela } from '../../dominio/financeiro';
import { colunasDosIndicadores } from '../../dominio/grade';
import { useTema } from '../../tema/TemaProvider';
import { espaco, type TokenNeon, type TokensStndrd } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { contornoDoNumero } from '../../ui/destaqueDoNumero';
import { Grade } from '../../ui/Grade';
import { MotivoDoIndisponivel } from '../../ui/NumeroDeDestaque';
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
  // Resultado nulo: o motivo fica escrito sob o "—" (nunca zero). Resultado 0 de verdade segue "R$ 0,00".
  const motivoDoResultado = typeof resultado?.resultadoCentavos === 'number' ? undefined : motivoDoResultadoNulo({
    somenteMeus, entradas: resultado?.entradasAvulsasCentavos, saidas: resultado?.saidasAvulsasCentavos,
  }) ?? undefined;
  return (
    <Cartao titulo={r.rotulo} descricao={r.descricao} periodo={periodo}>
      <Grade gap={espaco(1.5)} colunas={(l) => colunasDosIndicadores(l, fatorTexto)}>
        <Parcela rotulo="Recebido das cobranças" valor={r.recebido} centavos={r.centavos.recebido} destaque="azul" />
        <Parcela rotulo="Entradas avulsas" valor={r.entradas} centavos={r.centavos.entradas} destaque="violeta" motivo={motivo} />
        <Parcela rotulo="Saídas avulsas" valor={r.saidas} centavos={r.centavos.saidas} destaque="vermelho" motivo={motivo} />
        <Parcela rotulo="Resultado" valor={r.resultado} centavos={r.centavos.resultado} destaque={null} motivo={motivoDoResultado} />
      </Grade>
      {somenteMeus ? <Texto variante="suave">Com o filtro “Meus”, os lançamentos avulsos não entram, porque não pertencem a um aluno.</Texto> : null}
    </Cartao>
  );
}

function neonDaParcela(destaque: FuncaoDeDestaque | null, stndrd: TokensStndrd): TokenNeon | null {
  switch (destaque) {
    case 'azul':
      return stndrd.neon.emerald;
    case 'violeta':
      return stndrd.neon.electricPurple;
    case 'vermelho':
      return stndrd.neon.crimson;
    default:
      return null;
  }
}

/** Uma parcela da conta; poço Nível 2 dentro do cartão Nível 1 com filete Neon semântico. */
function Parcela({ rotulo, valor, centavos, destaque, motivo }: {
  rotulo: string; valor: string; centavos: number | null | undefined; destaque: FuncaoDeDestaque | null; motivo?: string;
}) {
  const { cores, bordas, stndrd } = useTema();
  const enfase = enfaseDoNumero(destaque, centavos);
  const indisponivel = enfase === 'indisponivel';
  const zero = enfase === 'zero';
  const neon = indisponivel || zero ? null : neonDaParcela(destaque, stndrd);
  const corValor = indisponivel || zero ? cores.textoSuave : cores.texto;
  return (
    <View
      accessibilityLabel={`${rotulo}: ${valor}${motivo && typeof centavos !== 'number' ? `. ${motivo}` : ''}`}
      style={[
        estilos.parcela,
        contornoDoNumero(neon?.accent ?? null, { divisor: neon ? neon.tintBorder : cores.divisor }, bordas.bloco, espaco(1.5)),
        { backgroundColor: cores.superficie2, borderRadius: 12 },
      ]}>
      <View style={estilos.topo}>
        {neon ? <View aria-hidden style={[estilos.ponto, { backgroundColor: neon.accent }]} /> : null}
        <Texto variante="rotulo" cor={cores.textoSuave}>{rotulo}</Texto>
      </View>
      <Texto variante="titulo" numerico cor={corValor}>{valor}</Texto>
      {indisponivel ? <MotivoDoIndisponivel texto={motivo} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  parcela: { flexGrow: 1, minWidth: 0, paddingVertical: espaco(1.5), paddingRight: espaco(1.5), gap: espaco(0.5) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
});

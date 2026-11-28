import { Clock, Pill } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ItemErgogenico, Suplemento } from '../api/tipos';
import { agruparPorHorario, espacarUnidades, partesDaDose } from '../dominio/complementosDoAluno';
import { duasColunasCom } from '../dominio/grade';
import { linkParaAbrir } from '../dominio/links';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { CupomDoProduto, VerProduto } from '../ui/AcoesDoProduto';
import { Cartao } from '../ui/Cartao';
import { Grade } from '../ui/Grade';
import { Texto } from '../ui/Texto';
import { PilulaDaQuantidade } from './PilulaDaQuantidade';

/** Largura mínima de cada cartão para os dois ficarem lado a lado (medida na área, não pela faixa da tela). */
const MINIMO_DO_CARTAO = 360;

/**
 * "Medicação e ergogênicos" e "Suplementação" da dieta do aluno (25/11): cada item numa linha, o nome à esquerda e a dose
 * na pílula da quantidade dos alimentos (neutra), agrupados pelo horário que o treinador escreveu, na ordem do dia
 * (`agruparPorHorario`), com "Sem horário definido" no fim. Lado a lado quando a área mede dois cartões de 360 px,
 * empilhados abaixo disso; lista vazia não mostra o cartão. Nada é calculado: dose e horário são texto do treinador, só
 * com o espaço entre número e unidade (`espacarUnidades`).
 */
export function CartoesDosComplementos({ ergogenicos, suplementacao, esticar = false }: {
  ergogenicos: ItemErgogenico[]; suplementacao: Suplemento[];
  /** Dieta no PC (28/11): sem a grade própria, cada cartão cresce até a altura da linha da grade de quem chama. */
  esticar?: boolean;
}) {
  const cartoes: ReactNode[] = [];
  const estilo = esticar ? estilos.esticado : undefined;
  if (ergogenicos.length) {
    cartoes.push(
      <CartaoDoComplemento key="ergogenicos" titulo="Medicação e ergogênicos" itens={ergogenicos} style={estilo} detalhe={(e) => (
        <>
          {e.principioAtivo ? <Texto numerico variante="suave">{e.principioAtivo}</Texto> : null}
          {e.observacao?.trim() ? <Texto numerico variante="suave">{espacarUnidades(e.observacao.trim())}</Texto> : null}
          {e.prescricao ? <Texto numerico variante="suave">Prescrição: {e.prescricao}</Texto> : null}
        </>
      )} />,
    );
  }
  if (suplementacao.length) {
    cartoes.push(
      <CartaoDoComplemento key="suplementacao" titulo="Suplementação" itens={suplementacao} style={estilo}
        detalhe={(s) => (s.observacao?.trim() ? <Texto numerico variante="suave">{espacarUnidades(s.observacao.trim())}</Texto> : null)}
        acoes={(s) => (
          <>
            {linkParaAbrir(s.link) ? <VerProduto link={s.link} /> : null}
            {s.cupom?.trim() ? <CupomDoProduto uid={s.uid} nome={s.nome} cupom={s.cupom.trim()} /> : null}
          </>
        )} />,
    );
  }
  if (!cartoes.length) return null;
  if (esticar) return <>{cartoes}</>;
  const duas = duasColunasCom(MINIMO_DO_CARTAO, espaco(3));
  return (
    <Grade gap={espaco(3)} alinhar="inicio" colunas={(l) => Math.min(cartoes.length, duas(l))}>
      {cartoes}
    </Grade>
  );
}

function CartaoDoComplemento<T extends { uid: string; nome: string; dose: string; horario: string }>({ titulo, itens, detalhe, acoes, style }: {
  titulo: string; itens: T[]; detalhe: (item: T) => ReactNode; acoes?: (item: T) => ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { cores } = useTema();
  return (
    <Cartao titulo={titulo} marcador={<Pill size={20} color={cores.textoSuave} aria-hidden />} style={style}>
      <View style={estilos.grupos}>
        {agruparPorHorario(itens).map((g) => (
          <View key={g.horario ?? ''} style={estilos.grupo}>
            <View style={estilos.tituloDoGrupo}>
              <Clock size={14} color={cores.textoSuave} aria-hidden />
              <Texto variante="secao" numerico nivel={3} style={estilos.rotuloDoGrupo}>{g.rotulo}</Texto>
            </View>
            {g.itens.map((item, i) => {
              const dose = partesDaDose(item.dose);
              return (
                <View key={item.uid} style={[estilos.item, i > 0 ? [estilos.comDivisor, { borderColor: cores.divisor }] : null]}>
                  <View style={estilos.linha}>
                    <View style={estilos.nome}>
                      <Texto numerico style={estilos.forte}>{item.nome || '—'}</Texto>
                      {detalhe(item)}
                    </View>
                    <PilulaDaQuantidade numero={dose.numero} resto={dose.resto} cor={cores.texto} borda={cores.bordaCampo}
                      rotuloAcessivel={`Dose: ${dose.numero || dose.resto ? [dose.numero, dose.resto].filter(Boolean).join(' ') : 'não informada'}`} />
                  </View>
                  {acoes?.(item)}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  // Entre os horários o dobro do vão de dentro deles (24 × 8).
  grupos: { gap: espaco(3) },
  grupo: { gap: espaco(1) },
  tituloDoGrupo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  // O horário é texto livre do treinador: quebra em vez de vazar do cartão.
  rotuloDoGrupo: { flexShrink: 1 },
  item: { gap: espaco(0.5) },
  comDivisor: { borderTopWidth: 1, paddingTop: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  nome: { flex: 1, minWidth: 0, gap: 2 },
  forte: { fontFamily: fontes.semi },
  esticado: { flexGrow: 1 },
});

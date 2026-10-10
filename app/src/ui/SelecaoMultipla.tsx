import { StyleSheet, View } from 'react-native';

import { alternarComLimite, marcarVisiveis } from '../dominio/selecaoMultipla';
import { espaco } from '../tema/tokens';
import { Botao } from './Botao';
import { CaixaSelecao } from './CaixaSelecao';
import { Texto } from './Texto';

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
}

interface Props {
  rotulo: string;
  opcoes: OpcaoMultipla[];
  marcados: ReadonlySet<string>;
  aoMudar: (marcados: Set<string>) => void;
  /** Máximo de marcados ao mesmo tempo; sem ele, "Marcar todos" marca tudo. */
  limite?: number;
  /** Chamado quando o limite barra uma marcação ou deixa itens sem marca (para avisar o usuário). */
  aoPassarDoLimite?: () => void;
}

/**
 * Lista de opções com caixa de seleção (várias de uma vez), com "Marcar" e "Limpar". Sem rolagem própria: o pai
 * rola (na `Folha` ou na tela).
 */
export function SelecaoMultipla({ rotulo, opcoes, marcados, aoMudar, limite, aoPassarDoLimite }: Props) {
  const alternar = (valor: string, marcar: boolean) => {
    if (limite === undefined) {
      const novo = new Set(marcados);
      if (marcar) novo.add(valor);
      else novo.delete(valor);
      aoMudar(novo);
      return;
    }
    const r = alternarComLimite(marcados, valor, marcar, limite);
    if (r.recusado) aoPassarDoLimite?.();
    else aoMudar(r.marcados);
  };
  const marcarTodos = () => {
    if (limite === undefined) return aoMudar(new Set(opcoes.map((o) => o.valor)));
    const r = marcarVisiveis(opcoes.map((o) => o.valor), marcados, limite);
    aoMudar(r.marcados);
    if (r.deixados > 0) aoPassarDoLimite?.();
  };
  const quantos = opcoes.filter((o) => marcados.has(o.valor)).length;
  return (
    <View style={estilos.campo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View style={estilos.acoes}>
        <Texto variante="pequeno" numerico style={estilos.contagem}>
          {quantos} de {opcoes.length} marcados{limite === undefined ? '' : ` · máximo ${limite} no total`}
        </Texto>
        <Botao rotulo={limite === undefined ? 'Marcar todos' : `Marcar os visíveis (até ${limite})`} tipo="secundario" aoTocar={marcarTodos} />
        <Botao rotulo="Limpar" tipo="secundario" aoTocar={() => aoMudar(new Set())} />
      </View>
      <View style={estilos.lista}>
        {opcoes.map((o) => (
          <CaixaSelecao key={o.valor} rotulo={o.rotulo} marcado={marcados.has(o.valor)} aoMudar={(m) => alternar(o.valor, m)} />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.75) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  contagem: { flexGrow: 1 },
  lista: { gap: espaco(0.75) },
});

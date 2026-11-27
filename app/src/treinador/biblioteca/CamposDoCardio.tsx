import { StyleSheet, View } from 'react-native';

import type { MedidaDeCardio, TipoDeCardio } from '../../api/tipos';
import { MEDIDAS_DE_CARDIO, TIPOS_DE_CARDIO } from '../../dominio/cardio';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { MensagemDeErro } from '../../ui/Campo';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Texto } from '../../ui/Texto';

/**
 * Campos do exercício de Cardio na folha da Biblioteca (docs/planos/cardio-e-hiit.md, D12 e D13): o "Tipo de cardio" fica
 * na linha da Modalidade, no lugar de Grupo muscular e Equipamento, e o resto (erro do tipo, o aviso do que sai ao salvar e
 * "Medidas que fazem sentido") vem logo abaixo da linha, para o erro não desalinhar a base dos dois campos.
 */

const OPCOES_DO_TIPO: readonly { valor: TipoDeCardio | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Não informado' },
  ...TIPOS_DE_CARDIO.map((t) => ({ valor: t.codigo, rotulo: t.rotulo })),
];

export const AJUDA_DAS_MEDIDAS = 'O editor do treino mostra só as marcadas. Duração e zona aparecem sempre.';

/** As medidas na ordem fixa da API, sem repetir. */
export const medidasEmOrdem = (marcadas: readonly MedidaDeCardio[]): MedidaDeCardio[] =>
  MEDIDAS_DE_CARDIO.map((m) => m.codigo).filter((m) => marcadas.includes(m));

export function TipoDoCardio({ valor, aoMudar }: { valor: TipoDeCardio | null; aoMudar: (v: TipoDeCardio | null) => void }) {
  return <EscolhaSuspensa rotulo="Tipo de cardio (opcional)" opcoes={OPCOES_DO_TIPO} valor={valor} aoMudar={aoMudar} semBusca />;
}

export function DetalhesDoCardio({ medidas, aoMudar, emColunas, erroDoTipo, erroDasMedidas, saemAoSalvar }: {
  medidas: readonly MedidaDeCardio[]; aoMudar: (m: MedidaDeCardio[]) => void; emColunas: boolean;
  erroDoTipo?: string; erroDasMedidas?: string;
  /** O que o Cardio não guarda e sai ao salvar (D13), já com o nome: "o grupo muscular (Pernas)", "o equipamento (Esteira)". */
  saemAoSalvar: string[];
}) {
  const { cores } = useTema();
  const alternar = (m: MedidaDeCardio, marcado: boolean) =>
    aoMudar(medidasEmOrdem(marcado ? [...medidas, m] : medidas.filter((x) => x !== m)));
  return (
    <>
      {erroDoTipo ? <MensagemDeErro erro={erroDoTipo} /> : null}
      {saemAoSalvar.length ? (
        <Texto variante="pequeno">
          Ao salvar como Cardio, saem do exercício {saemAoSalvar.join(' e ')}; o tipo de cardio fica no lugar deles.
        </Texto>
      ) : null}
      <View role="group" aria-label="Medidas que fazem sentido" style={estilos.grupo}>
        {/* Mesmo rótulo dos campos (cor do texto), como o "O que inclui" do plano comercial. */}
        <Texto variante="rotulo" cor={cores.texto}>Medidas que fazem sentido</Texto>
        <View style={emColunas ? estilos.lado : estilos.coluna}>
          {MEDIDAS_DE_CARDIO.map((m) => (
            <View key={m.codigo} style={emColunas ? estilos.igual : null}>
              <CaixaSelecao rotulo={m.rotulo} marcado={medidas.includes(m.codigo)} aoMudar={(v) => alternar(m.codigo, v)} />
            </View>
          ))}
        </View>
        {erroDasMedidas ? <MensagemDeErro erro={erroDasMedidas} /> : <Texto variante="pequeno">{AJUDA_DAS_MEDIDAS}</Texto>}
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(0.5) },
  lado: { flexDirection: 'row', gap: espaco(2) },
  coluna: { gap: espaco(1) },
  igual: { flex: 1, minWidth: 0 },
});

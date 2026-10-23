import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { semAcento } from '../../dominio/telas';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { Folha } from '../../ui/Folha';
import { OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

export interface ItemDoCatalogo {
  id: string;
  nome: string;
  /** Papel do tipo ou grupo da técnica, mais a primeira linha da explicação. */
  detalhe: string;
  grupo?: string;
  presente: boolean;
}

/**
 * Folha de vários itens do catálogo: toque marca e desmarca, o que já está na metodologia fica desabilitado.
 * Busca sem acento quando há mais de oito. O rodapé acrescenta os marcados.
 */
export function FolhaDoCatalogo({
  visivel,
  titulo,
  itens,
  nota,
  aoFechar,
  aoAdicionar,
}: {
  visivel: boolean;
  titulo: string;
  itens: readonly ItemDoCatalogo[];
  nota?: string;
  aoFechar: () => void;
  aoAdicionar: (ids: string[]) => void;
}) {
  const { cores } = useTema();
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [filtro, setFiltro] = useState('');
  const comBusca = itens.length > OPCOES_PARA_BUSCAR;
  const consulta = semAcento(filtro);
  const visiveis = useMemo(
    () => (consulta ? itens.filter((i) => semAcento(`${i.nome} ${i.detalhe} ${i.grupo ?? ''}`).includes(consulta)) : itens),
    [itens, consulta],
  );
  const alternar = (id: string) => setMarcados((atual) => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    return novo;
  });
  const grupos = new Set(visiveis.map((i) => i.grupo).filter((g): g is string => !!g));
  const faixas = grupos.size > 0 ? [...grupos] : [undefined];
  const n = marcados.size;
  return (
    <Folha visivel={visivel} titulo={titulo} aoFechar={aoFechar} rodape={
      <View style={estilos.rodape}>
        {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
        <Botao rotulo={`Adicionar (${n})`} tipo="primario" desabilitado={n === 0} motivo={n === 0 ? 'Marque ao menos um item.' : undefined}
          aoTocar={() => aoAdicionar([...marcados])} />
      </View>
    }>
      {comBusca ? <Campo rotulo="Buscar" valor={filtro} aoMudar={setFiltro} autoCorrect={false} /> : null}
      {visiveis.length === 0 ? <Texto variante="suave">Nenhum item com esse texto.</Texto> : null}
      {faixas.map((grupo) => {
        const doGrupo = visiveis.filter((i) => (grupo ? i.grupo === grupo : true));
        return <View key={grupo ?? 'lista'} style={estilos.lista}>
          {grupo ? <CabecalhoDeGrupo titulo={grupo} /> : null}
          {doGrupo.map((item) => {
            const marcado = marcados.has(item.id);
            const detalhe = item.presente ? 'Já está na metodologia' : item.detalhe;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityLabel={item.presente ? `${item.nome}, já está na metodologia` : item.nome}
                accessibilityState={{ checked: marcado, disabled: item.presente }}
                disabled={item.presente}
                onPress={() => alternar(item.id)}
                style={(estado) => [estilos.opcao, {
                  borderColor: marcado ? cores.texto : cores.borda,
                  backgroundColor: marcado ? cores.texto : sobre(estado) ? cores.superficie3 : cores.superficie2,
                  opacity: item.presente ? 0.5 : 1,
                }]}>
                <View style={estilos.textos}>
                  <Texto style={[estilos.nome, { color: marcado ? cores.fundo : cores.texto }]}>{item.nome}</Texto>
                  {detalhe ? <Texto variante="pequeno" cor={marcado ? cores.fundo : undefined}>{detalhe}</Texto> : null}
                </View>
                {marcado ? <Check size={18} color={cores.fundo} strokeWidth={2.5} /> : null}
              </Pressable>
            );
          })}
        </View>;
      })}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(0.75) },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderWidth: 1, borderRadius: RAIO },
  textos: { flex: 1, gap: 1 },
  nome: { fontFamily: fontes.semi },
  rodape: { gap: espaco(1) },
});

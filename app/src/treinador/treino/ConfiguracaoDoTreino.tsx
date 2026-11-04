import { StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../../api/tipos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Texto } from '../../ui/Texto';
import { useDuasColunas } from '../plano/ColunasDoEditor';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import type { usePlanoEditor } from '../plano/usePlanoEditor';

/**
 * "Configuração do plano" do treino: título, período, objetivo, orientações e a metodologia. A metodologia aparece uma
 * vez só por layout: em duas colunas, com uma sessão aberta, ela fica no topo da lista de exercícios (perto das séries
 * que ela orienta); no empilhado, aqui.
 */
export function ConfiguracaoDoTreino({ editor, modelo, temSessao, aoTrocarMetodologia }: {
  editor: ReturnType<typeof usePlanoEditor<ConteudoTreino>>;
  modelo: boolean;
  temSessao: boolean;
  aoTrocarMetodologia: () => void;
}) {
  const duas = useDuasColunas();
  const estado = editor.estado;
  if (!estado) return null;
  const c = estado.conteudo;
  const metodologiaAqui = !(duas && temSessao);
  return (
    <ConfiguracaoDoPlano
      editor={editor}
      modelo={modelo}
      recolhido={c.sessoes.length > 0 && estado.titulo.trim() !== ''}
      descricao={metodologiaAqui ? 'Título, período, metodologia e orientações gerais do plano.' : 'Título, período e orientações gerais do plano.'}>
      {metodologiaAqui ? (
        <>
          <View style={estilos.metodologia}>
            <Texto style={estilos.metodologiaTexto}>{c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Metodologia: nenhuma vinculada'}</Texto>
            <Botao rotulo={c.metodologia ? 'Trocar' : 'Vincular'} tipo="secundario" aoTocar={aoTrocarMetodologia} />
          </View>
          <Texto variante="suave">Uma cópia das regras acompanha este treino. Vincular outra metodologia orienta as novas séries; as séries existentes continuam editáveis.</Texto>
        </>
      ) : null}
      <Campo
        rotulo="Objetivo (opcional)"
        valor={c.objetivo ?? ''}
        aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, objetivo: t || null }))}
        maxLength={200}
      />
      <Campo
        rotulo="Orientações gerais (opcional)"
        valor={c.orientacoes ?? ''}
        aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, orientacoes: t || null }))}
        linhas={4}
        maxLength={8000}
      />
    </ConfiguracaoDoPlano>
  );
}

const estilos = StyleSheet.create({
  metodologia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  metodologiaTexto: { flexShrink: 1 },
});

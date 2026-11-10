import { StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../../api/tipos';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import type { usePlanoEditor } from '../plano/usePlanoEditor';

/**
 * Nome do modelo de treino (10/11): o nome é o título da tela e se edita pelo "Editar nome" do cabeçalho. Sem nome
 * (modelo novo, ou apagado) o campo fica aberto com o erro, porque o "Salvar modelo" depende dele.
 */
export function NomeDoModeloDeTreino({ editor, aberto, aoConcluir }: {
  editor: ReturnType<typeof usePlanoEditor<ConteudoTreino>>;
  aberto: boolean;
  aoConcluir: () => void;
}) {
  const e = editor.estado;
  if (!e) return null;
  const vazio = !e.titulo.trim();
  if (!aberto && !vazio) return null;
  return (
    <View style={estilos.linha}>
      <View style={estilos.campo}>
        <Campo rotulo="Nome do modelo" valor={e.titulo} aoMudar={(titulo) => editor.alterar(() => ({ titulo }))} maxLength={120}
          erro={vazio ? 'Informe o nome do modelo.' : null} autoFocus={aberto} />
      </View>
      {vazio ? null : <Botao rotulo="Concluir" tipo="secundario" aoTocar={aoConcluir} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1), maxWidth: LARGURA_EDITOR },
  campo: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
});

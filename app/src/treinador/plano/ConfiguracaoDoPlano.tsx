import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import type { usePlanoEditor } from './usePlanoEditor';

type Editor<C> = ReturnType<typeof usePlanoEditor<C>>;

interface Props<C> {
  editor: Editor<C>;
  /** Plano de modelo: o nome fica no topo do modelo, sem período. */
  modelo?: boolean;
  /** Começa recolhido (plano que já tem conteúdo); só vale na primeira exibição. */
  recolhido: boolean;
  descricao?: string;
  /** Campos próprios do tipo de plano (metodologia, objetivo, orientações...). */
  children?: ReactNode;
}

/**
 * "Configuração do plano": título, período (quando não vem da pasta) e os campos do tipo. Recolhível: o treinador mexe
 * pouco aqui depois de montado o plano.
 */
export function ConfiguracaoDoPlano<C>({ editor, modelo, recolhido, descricao, children }: Props<C>) {
  const e = editor.estado;
  if (!e) return null;
  return (
    <Cartao titulo="Configuração do plano" descricao={descricao} recolhivel recolhido={recolhido}>
      {modelo ? null : (
        <Campo
          rotulo="Título"
          valor={e.titulo}
          aoMudar={(titulo) => editor.alterar(() => ({ titulo }))}
          maxLength={120}
          erro={e.titulo.trim() ? null : 'Informe o título.'}
        />
      )}
      {modelo ? null : e.plano.pastaId ? (
        <Texto variante="suave">
          Período da pasta: {e.inicio || '—'} a {e.fim || '—'}. Para mudar, edite a pasta na ficha do aluno.
        </Texto>
      ) : (
        <View style={estilos.datas}>
          <View style={estilos.data}>
            <CampoData rotulo="Início" valor={e.inicio} aoMudar={(inicio) => editor.alterar(() => ({ inicio }))} />
          </View>
          <View style={estilos.data}>
            <CampoData rotulo="Fim" valor={e.fim} aoMudar={(fim) => editor.alterar(() => ({ fim }))} />
          </View>
        </View>
      )}
      {children}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 190 },
});

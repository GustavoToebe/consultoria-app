import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { ParDeDatas } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import type { usePlanoEditor } from './usePlanoEditor';

type Editor<C> = ReturnType<typeof usePlanoEditor<C>>;

interface Props<C> {
  editor: Editor<C>;
  /** Plano de modelo: o nome fica no topo do modelo, sem período. */
  modelo?: boolean;
  /** Nasce recolhido (regra de 18/11); `false` só onde o layout já mostra tudo. Só vale na primeira exibição. */
  recolhido?: boolean;
  descricao?: string;
  /**
   * Resumo que fica à vista também recolhido ("Objetivo: X · Metodologia: Y"), na faixa ao lado do título.
   * shortcut: vai nas `acoes` do `Cartao` porque a `descricao` dele some quando fechado; trocar por uma prop do `Cartao`.
   */
  resumo?: string;
  /** Campos próprios do tipo de plano (metodologia, objetivo, orientações...). */
  children?: ReactNode;
}

/**
 * "Configuração do plano": título, período (quando não vem da pasta) e os campos do tipo. Recolhível: o treinador mexe
 * pouco aqui depois de montado o plano. Os campos preenchem a largura do cartão. Dieta e mobilidade não passam
 * `recolhido` (nascem fechadas); o treino passa o dele (lote do treino).
 */
export function ConfiguracaoDoPlano<C>({ editor, modelo, recolhido = true, descricao, resumo, children }: Props<C>) {
  const e = editor.estado;
  if (!e) return null;
  return (
    <Cartao faixa titulo="Configuração do plano" descricao={descricao} recolhivel recolhido={recolhido}
      acoes={resumo ? <Texto variante="suave" style={estilos.resumo}>{resumo}</Texto> : undefined}>
      <View style={estilos.medida}>
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
            Período: {e.inicio || e.fim ? `${e.inicio || '—'} a ${e.fim || '—'}` : '—'}. Vem da pasta; para mudar, edite a pasta na ficha do aluno.
          </Texto>
        ) : (
          <ParDeDatas>
            <CampoData rotulo="Início" nome="Início do plano" regra="PLANEJAMENTO" valor={e.inicio} aoMudar={(inicio) => editor.alterar(() => ({ inicio }))} />
            <CampoData rotulo="Fim" nome="Fim do plano" regra="PLANEJAMENTO" valor={e.fim} aoMudar={(fim) => editor.alterar(() => ({ fim }))} />
          </ParDeDatas>
        )}
        {children}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  medida: { width: '100%', gap: espaco(2) },
  resumo: { flexShrink: 1 },
});

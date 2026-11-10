import { StyleSheet, View } from 'react-native';

import type { ConteudoTreino } from '../../api/tipos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Texto } from '../../ui/Texto';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import type { usePlanoEditor } from '../plano/usePlanoEditor';

/**
 * "Configuração do plano" do treino: título, período, a metodologia, objetivo e orientações. A metodologia mora só aqui,
 * em qualquer largura (o exercício não a repete).
 */
export function ConfiguracaoDoTreino({ editor, modelo, aberta = false, aoTrocarMetodologia }: {
  editor: ReturnType<typeof usePlanoEditor<ConteudoTreino>>;
  modelo: boolean;
  /** Abre na montagem (o editor remonta por `key` para abrir no "Ir à primeira pendência" de um campo daqui). */
  aberta?: boolean;
  aoTrocarMetodologia: () => void;
}) {
  const estado = editor.estado;
  if (!estado) return null;
  const c = estado.conteudo;
  return (
    <ConfiguracaoDoPlano
      editor={editor}
      modelo={modelo}
      recolhido={!aberta && c.sessoes.length > 0 && estado.titulo.trim() !== ''}
      resumo={resumoDaConfiguracao(c)}>
      <View style={estilos.metodologia}>
        <Texto style={estilos.metodologiaTexto}>{c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Metodologia: nenhuma vinculada'}</Texto>
        <Botao rotulo={c.metodologia ? 'Trocar' : 'Vincular'} tipo="secundario" aoTocar={aoTrocarMetodologia} />
      </View>
      <Texto variante="suave">Uma cópia das regras acompanha este treino. Vincular outra metodologia orienta as novas séries; as séries existentes continuam editáveis.</Texto>
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

/** Resumo na faixa, à vista também recolhida (10/11): "Objetivo: hipertrofia · Metodologia: Padrão". */
export function resumoDaConfiguracao(c: Pick<ConteudoTreino, 'objetivo' | 'metodologia'>): string {
  return [c.objetivo ? `Objetivo: ${c.objetivo}` : 'Sem objetivo', c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Sem metodologia'].join(' · ');
}

const estilos = StyleSheet.create({
  metodologia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  metodologiaTexto: { flexShrink: 1 },
});

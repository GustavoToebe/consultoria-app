import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { atalhosDoAlunoGravado, resumoDoResultado } from '../../dominio/importacaoAssistida';
import type { ConfirmacaoResultado } from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Alerta } from '../../ui/Estados';
import { LinkTexto } from '../../ui/LinkTexto';
import { Texto } from '../../ui/Texto';

/**
 * O que a gravação fez: as contagens que aconteceram, o alerta pela situação e, por aluno gravado (2.5), "Abrir ficha" e
 * "Abrir rascunho do treino" (e o da dieta, quando houve). Sem `ALUNO_LER` a API não manda a lista: ficam só as contagens.
 */
export function ResultadoDaGravacao({ resultado, titulo = true }: { resultado: ConfirmacaoResultado; titulo?: boolean }) {
  const { cores } = useTema();
  const resumo = resumoDoResultado(resultado);
  const alunos = resultado.alunos ?? [];
  return (
    <View style={estilos.coluna}>
      {titulo ? (
        <View style={estilos.lista}>
          <Texto variante="bloco" nivel={3}>{resumo.titulo}</Texto>
          {resumo.descricao ? <Texto variante="suave">{resumo.descricao}</Texto> : null}
        </View>
      ) : null}
      {resumo.alerta ? <Alerta tom={resumo.alerta.tom} texto={resumo.alerta.texto} /> : null}
      <View style={estilos.lista}>
        {resumo.linhas.map((l) => <Texto key={l} numerico>{l}</Texto>)}
      </View>
      {alunos.length ? (
        <View role="list" aria-label="Alunos gravados">
          {alunos.map((a, i) => (
            <View key={a.alunoId} role="listitem" style={[estilos.aluno, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
              <Texto variante="bloco">{a.nome}</Texto>
              <Texto variante="suave">{a.criado ? 'Aluno novo' : 'Aluno já cadastrado'}</Texto>
              <View style={estilos.atalhos}>
                {atalhosDoAlunoGravado(a).map((l) => <LinkTexto key={l.href} href={l.href as Href} texto={l.rotulo} />)}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  lista: { gap: espaco(1) },
  aluno: { paddingVertical: espaco(1), gap: espaco(0.5) },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3) },
});

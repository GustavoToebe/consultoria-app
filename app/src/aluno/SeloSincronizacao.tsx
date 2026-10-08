import { Pressable } from 'react-native';

import { useAluno } from '../offline/AlunoProvider';
import { SeloAnimado } from '../ui/SeloAnimado';
import { estadoSincronizacao } from './estadoSincronizacao';

/**
 * Estado do envio no topo das telas do aluno: verde "Sincronizado"; âmbar "N aguardando envio"; cinza "Sem conexão
 * — salvo no aparelho"; vermelho "Falha ao enviar — tentar de novo" (toque para reenviar).
 */
export function SeloSincronizacao() {
  const { pendentes, falhas, envio, online, tentarDeNovo } = useAluno();
  const estado = estadoSincronizacao({ pendentes, falhas: falhas.length, envio, online });
  if (estado.tentar) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Falha ao enviar. Tentar de novo" onPress={() => void tentarDeNovo()}>
        <SeloAnimado {...estado} />
      </Pressable>
    );
  }
  return <SeloAnimado {...estado} />;
}

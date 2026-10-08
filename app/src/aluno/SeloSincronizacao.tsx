import { Pressable } from 'react-native';

import { useAluno } from '../offline/AlunoProvider';
import { Selo } from '../ui/Selo';

/**
 * Estado do envio no topo das telas do aluno: verde "Sincronizado"; âmbar "N aguardando envio"; cinza "Sem conexão
 * — salvo no aparelho"; vermelho "Falha ao enviar — tentar de novo" (toque para reenviar).
 */
export function SeloSincronizacao() {
  const { pendentes, falhas, envio, online, tentarDeNovo } = useAluno();
  if (falhas.length) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Falha ao enviar. Tentar de novo" onPress={() => void tentarDeNovo()}>
        <Selo texto="Falha ao enviar — tentar de novo" tipo="perigo" />
      </Pressable>
    );
  }
  if (!online || envio === 'semConexao') {
    return <Selo texto={pendentes ? `Sem conexão — ${pendentes} salvo(s) no aparelho` : 'Sem conexão — salvo no aparelho'} tipo="neutro" />;
  }
  if (envio === 'enviando' && pendentes) return <Selo texto="Enviando…" tipo="neutro" />;
  if (envio === 'erro') return <Selo texto="Falha ao enviar — tentar de novo" tipo="perigo" />;
  if (pendentes) return <Selo texto={`${pendentes} aguardando envio`} tipo="atencao" />;
  return <Selo texto="Sincronizado" tipo="sucesso" />;
}

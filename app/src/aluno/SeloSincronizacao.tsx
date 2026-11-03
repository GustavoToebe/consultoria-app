import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAluno } from '../offline/AlunoProvider';
import { espaco } from '../tema/tokens';
import { SeloAnimado } from '../ui/SeloAnimado';
import { estadoSincronizacao } from './estadoSincronizacao';

/** O "Sem conexão" do rodapé só aparece depois deste tempo seguido sem rede, para não piscar quando a conexão oscila. */
export const ATRASO_SEM_CONEXAO_MS = 2500;

/**
 * Estado do envio no topo das telas do aluno: verde "Sincronizado"; âmbar "N aguardando envio"; cinza "Sem conexão
 * — salvo no aparelho"; vermelho "Falha ao enviar — tentar de novo" (toque para reenviar).
 * `noRodape` (todas as telas, acima da barra) só aparece com algo a dizer: com tudo enviado não mostra "Sincronizado" (N28);
 * a Conta mostra o estado completo. No rodapé o "Sem conexão" sem nada pendente espera `ATRASO_SEM_CONEXAO_MS` sem rede;
 * pendente e falha aparecem na hora.
 */
export function SeloSincronizacao({ noRodape = false }: { noRodape?: boolean }) {
  const { pendentes, falhas, falhasDeMobilidade, falhasDeConclusao, falhasDeAgua, envio, online, tentarDeNovo } = useAluno();
  const estado = estadoSincronizacao({ pendentes, falhas: falhas.length + falhasDeMobilidade.length + falhasDeConclusao.length + falhasDeAgua.length, envio, online });
  // Só o "Sem conexão" puro (sem nada pendente nem falha) espera; com algo a enviar o selo já tem o que dizer.
  const soSemRede = noRodape && !estado.tentar && (!online || envio === 'semConexao') && pendentes === 0;
  const [passouOAtraso, setPassouOAtraso] = useState(false);
  useEffect(() => {
    if (!soSemRede) return;
    const espera = setTimeout(() => setPassouOAtraso(true), ATRASO_SEM_CONEXAO_MS);
    return () => {
      clearTimeout(espera);
      setPassouOAtraso(false);
    };
  }, [soSemRede]);
  if (noRodape && estado.tipo === 'sucesso') return null;
  if (soSemRede && !passouOAtraso) return null;
  const selo = estado.tentar ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Falha ao enviar. Tentar de novo" onPress={() => void tentarDeNovo()}>
      <SeloAnimado {...estado} />
    </Pressable>
  ) : <SeloAnimado {...estado} />;
  return noRodape ? <View style={estilos.rodape}>{selo}</View> : selo;
}

const estilos = StyleSheet.create({
  rodape: { alignItems: 'center', paddingVertical: espaco(0.5) },
});

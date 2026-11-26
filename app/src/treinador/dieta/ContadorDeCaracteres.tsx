import { StyleSheet } from 'react-native';

import { inteiroComMilhar } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { Texto } from '../../ui/Texto';

/**
 * "123/2.000" no canto de baixo, à direita do campo (o padrão do comentário do treino concluído, `aluno/ConcluirTreino`):
 * o leitor de tela ouve "123 de 2.000 caracteres". Acima do limite (texto que veio de fora), em `perigo`.
 */
export function ContadorDeCaracteres({ usados, maximo }: { usados: number; maximo: number }) {
  const { cores } = useTema();
  return (
    <Texto variante="pequeno" numerico style={estilos.contador} cor={usados > maximo ? cores.perigo : undefined}
      accessibilityLabel={`${inteiroComMilhar(usados)} de ${inteiroComMilhar(maximo)} caracteres`}>
      {inteiroComMilhar(usados)}/{inteiroComMilhar(maximo)}
    </Texto>
  );
}

const estilos = StyleSheet.create({ contador: { alignSelf: 'flex-end' } });

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listarAlimentos, listarExercicios } from '../../api/rotas';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

const ESPERA_MS = 300;
const MAXIMO = 6;

/**
 * Busca na biblioteca enquanto a pessoa escreve o nome correto do termo (2.4): exercícios para termo de exercício,
 * alimentos para termo de alimento. Escolher liga a resposta ao item. Espera 300 ms depois da última tecla e descarta a
 * resposta que chega depois de o texto mudar. Erro da busca não trava nada: o nome digitado continua valendo.
 */
export function BuscaNaBiblioteca({ tipo, texto, aoEscolher }: {
  tipo: string;
  texto: string;
  aoEscolher: (nome: string, referenciaId: string) => void;
}) {
  // A resposta guarda a busca de que veio: só vale enquanto o texto é o mesmo.
  const [resposta, setResposta] = useState<{ busca: string; itens: { id: string; nome: string }[] } | null>(null);
  const exercicio = tipo.startsWith('EXERCICIO');
  const busca = texto.trim();
  const achados = busca.length >= 2 && resposta?.busca === busca ? resposta.itens : null;

  useEffect(() => {
    if (busca.length < 2) return undefined;
    let ativo = true;
    const espera = setTimeout(() => {
      const pedido = exercicio ? listarExercicios(busca) : listarAlimentos(busca, 'ALIMENTO');
      pedido.then(
        (lista) => { if (ativo) setResposta({ busca, itens: lista.slice(0, MAXIMO).map((i) => ({ id: i.id, nome: i.nome })) }); },
        () => undefined,
      );
    }, ESPERA_MS);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca, exercicio]);

  if (!achados) return null;
  return (
    <View style={estilos.bloco} accessibilityLiveRegion="polite">
      <Texto variante="rotulo">Na biblioteca</Texto>
      {achados.length ? (
        <LinhaDeAcoes>
          {achados.map((a) => (
            <Botao key={a.id} rotulo={a.nome} rotuloAcessivel={`Usar ${a.nome} da biblioteca`} tipo="secundario" aoTocar={() => aoEscolher(a.nome, a.id)} />
          ))}
        </LinhaDeAcoes>
      ) : (
        <Texto variante="suave">{`Nenhum ${exercicio ? 'exercício' : 'alimento'} da biblioteca com esse nome. O nome digitado entra sem vínculo.`}</Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});

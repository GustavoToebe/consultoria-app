import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';

import { nomeSemQuebra } from '../../dominio/complementosDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { Campo } from '../../ui/Campo';

/** Sem a alça de redimensionar do textarea (o preflight da web põe `resize: vertical`): o campo já cresce sozinho. */
const SEM_ALCA = 'resize-none';

/**
 * Linhas de um campo da tabela (26/11): uma quando o texto cabe, duas quando não; o que passa de duas rola
 * dentro do campo (a linha da tabela não cresce sem fim). A mesma conta folgada de `linhasDoNome` (9 px por caractere da
 * fonte de 16 px, vezes o "Tamanho do texto", menos o recuo interno); sem medida ainda, uma.
 */
function ateDuasLinhas(texto: string, larguraDoCampo: number, fatorDoTexto: number): 1 | 2 {
  const util = larguraDoCampo - 28;
  if (util <= 0) return 1;
  return texto.length <= Math.max(1, Math.floor(util / (9 * fatorDoTexto))) ? 1 : 2;
}

/**
 * Campo de uma célula das tabelas dos Complementos (Suplementação e Outros, 26/11): cresce sozinho de uma a duas linhas
 * com o texto (`ateDuasLinhas`, medido na própria célula), sem a alça de redimensionar e sem gravar quebra pelo Enter.
 * Sempre textarea: trocar de input para textarea no meio da digitação perderia o foco. Por padrão o rótulo fica no
 * cabeçalho da tabela (o leitor de tela lê `rotuloAcessivel`); Outros passa `rotuloOculto={false}` e mostra o rótulo.
 */
export function CampoDaTabela({ valor, aoMudar, rotuloOculto = true, ...resto }: Omit<ComponentProps<typeof Campo>, 'linhas'>) {
  const { fatorTexto } = useTema();
  const [largura, setLargura] = useState(0);
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <Campo {...resto} rotuloOculto={rotuloOculto} valor={valor} linhas={ateDuasLinhas(valor, largura, fatorTexto)} className={SEM_ALCA}
        blurOnSubmit onSubmitEditing={() => undefined} aoMudar={(v) => aoMudar(nomeSemQuebra(v))} />
    </View>
  );
}

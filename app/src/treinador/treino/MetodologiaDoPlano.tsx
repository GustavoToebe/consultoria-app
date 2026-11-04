import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from './BotaoDeAbrir';

interface Props {
  /** Nome da metodologia copiada para o plano; nulo = nenhuma vinculada (valem os tipos padrão). */
  nome: string | null;
  config: Configuracao;
  /** "Trocar"/"Vincular" (a mesma folha da configuração do plano); sem ele (modelo de sessão), só leitura. */
  aoTrocar?: () => void;
}

/**
 * Cartão curto da metodologia no topo da lista de exercícios (duas colunas): o nome e, atrás do "O que é?", os tipos de
 * série que ela traz e as instruções de treino que ela já tem. Nada é calculado aqui.
 */
export function MetodologiaDoPlano({ nome, config, aoTrocar }: Props) {
  const { cores, bordas } = useTema();
  const [aberto, setAberto] = useState(false);
  const tipos = config.tipos.map((t) => t.nome || t.codigo).filter(Boolean);
  return (
    <View style={[estilos.bloco, { backgroundColor: cores.superficie2, borderColor: cores.borda, borderWidth: bordas.item }]}>
      <View style={estilos.topo}>
        <View style={estilos.texto}>
          <Texto variante="secao" nivel={3}>Metodologia</Texto>
          <Texto style={estilos.nome}>{nome ?? 'Nenhuma vinculada'}</Texto>
        </View>
        {aoTrocar ? <Botao rotulo={nome ? 'Trocar' : 'Vincular'} rotuloAcessivel={nome ? 'Trocar a metodologia' : 'Vincular metodologia'} tipo="fantasma" aoTocar={aoTrocar} /> : null}
      </View>
      <BotaoDeAbrir texto="O que é?" rotuloAcessivel={`O que é ${nome ? `a metodologia ${nome}` : 'a metodologia padrão'}?`} aberto={aberto} aoAlternar={() => setAberto((v) => !v)} />
      {aberto ? (
        <View style={estilos.explicacao}>
          <Texto variante="suave">
            {nome
              ? 'Uma cópia das regras acompanha este treino: os tipos de série, as técnicas e os padrões de carga e esforço das novas séries.'
              : 'Sem metodologia vinculada, as séries usam os tipos padrão.'}
          </Texto>
          {tipos.length ? <Texto variante="pequeno">{`Tipos de série: ${tipos.join(', ')}`}</Texto> : null}
          {config.instrucoesTreino ? <Texto variante="pequeno">{config.instrucoesTreino}</Texto> : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 160, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 15 },
  explicacao: { gap: espaco(0.5) },
});

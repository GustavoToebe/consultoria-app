import { Plus, Repeat, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AlternativaDeExercicio, ExercicioPlano } from '../../api/tipos';
import { motivoSemAdicionarAlternativa, removerAlternativa } from '../../dominio/alternativasDoExercicio';
import { resumoDasAlternativas } from '../../dominio/camposDaSerie';
import { MAXIMO_DE_ALTERNATIVAS } from '../../dominio/exercicioDoDia';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { SecaoRecolhivel } from '../../ui/SecaoRecolhivel';

/**
 * "Alternativas de troca" do exercício (Lote B, `docs/planos/trocar-exercicio.md`; seção recolhível de 27/11): até 3
 * exercícios da biblioteca que o aluno pode pôr no lugar deste só no dia, com as mesmas séries. Fechada, o resumo
 * ("Nenhuma alternativa" ou os nomes); abre sozinha com erro dentro (`alternativas` e `alternativas[i].campo`). Aberta,
 * as escolhidas são chips (nome, trocar em todas as sessões quando o principal é da biblioteca, remover) e "Adicionar
 * alternativa" fecha a linha dos chips. A explicação fica no ⓘ do título.
 */
export function AlternativasDoExercicio({ exercicio: e, erros, aoMudar, aoAdicionar, aoTrocarEmTodas }: {
  exercicio: ExercicioPlano;
  erros: Problemas;
  aoMudar: (e: ExercicioPlano) => void;
  aoAdicionar: () => void;
  aoTrocarEmTodas: (alternativa: AlternativaDeExercicio) => void;
}) {
  const { cores } = useTema();
  const lista = e.alternativas ?? [];
  const erroDaLinha = (i: number) => {
    const p = `alternativas[${i}].`;
    return erros[`${p}exercicioId`] ?? erros[`${p}nome`] ?? erros[`${p}videoUrl`] ?? null;
  };
  const comErro = !!erros.alternativas || lista.some((_, i) => erroDaLinha(i));
  // Nasce fechado, mesmo com alternativas (18/11; o resumo diz quais); com erro, sempre aberto.
  const [escolha, setEscolha] = useState(false);
  const aberto = comErro || escolha;
  const motivo = motivoSemAdicionarAlternativa(e);
  const nome = e.nome || 'o exercício';
  const titulo = `Alternativas de troca · ${lista.length} de ${MAXIMO_DE_ALTERNATIVAS}`;

  return (
    <SecaoRecolhivel titulo={titulo} resumo={resumoDasAlternativas(lista)} aberta={aberto} aoMudar={setEscolha}
      ajuda={`O aluno pode trocar ${nome} por uma destas só no dia, com as mesmas séries. Até ${MAXIMO_DE_ALTERNATIVAS}, da biblioteca e do mesmo tipo.`}>
        <View style={estilos.bloco}>
          <View role="list" style={estilos.chips}>
            {lista.map((a, i) => {
              const erro = erroDaLinha(i);
              const nomeDela = a.nome || 'Alternativa sem nome';
              return (
                // Com índice: um rascunho com repetida (a API recusa "Alternativa repetida") não mistura os chips.
                <View key={`${i}:${a.exercicioId}`} role="listitem" style={[estilos.chip, { borderColor: erro ? cores.perigo : cores.bordaCampo, backgroundColor: cores.superficie2 }]}>
                  <Texto style={estilos.nome} numberOfLines={1}>{nomeDela}</Texto>
                  {e.exercicioId ? <IconeBotao compacto Icone={Repeat} rotulo={`Trocar em todas as sessões: ${nome} por ${nomeDela}`} aoTocar={() => aoTrocarEmTodas(a)} /> : null}
                  <IconeBotao compacto Icone={X} rotulo={`Remover a alternativa ${nomeDela}`} aoTocar={() => aoMudar(removerAlternativa(e, i))} />
                </View>
              );
            })}
            <Botao rotulo="Adicionar alternativa" rotuloAcessivel={`Adicionar alternativa a ${nome}`} tipo="acao" Icone={Plus}
              aoTocar={aoAdicionar} desabilitado={!!motivo} motivo={motivo ?? undefined} />
          </View>
          {lista.map((a, i) => {
            const erro = erroDaLinha(i);
            return erro ? <MensagemDeErro key={`erro-${i}`} erro={`${a.nome || 'Alternativa sem nome'}: ${erro}`} /> : null;
          })}
          {erros.alternativas ? <MensagemDeErro erro={erros.alternativas} /> : null}
          {lista.length && !e.exercicioId ? (
            <Texto variante="pequeno">Para trocar em todas as sessões, ligue este exercício à biblioteca pelo “Trocar”.</Texto>
          ) : null}
        </View>
    </SecaoRecolhivel>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 0, borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), maxWidth: '100%', minHeight: 44 },
  nome: { flexShrink: 1, marginRight: espaco(0.25) },
});

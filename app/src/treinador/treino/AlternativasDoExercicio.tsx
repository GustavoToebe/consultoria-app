import { Plus, Repeat, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { AlternativaDeExercicio, ExercicioPlano } from '../../api/tipos';
import { motivoSemAdicionarAlternativa, removerAlternativa } from '../../dominio/alternativasDoExercicio';
import { MAXIMO_DE_ALTERNATIVAS } from '../../dominio/exercicioDoDia';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from './BotaoDeAbrir';

/**
 * "Alternativas de troca" do exercício (Lote B, `docs/planos/trocar-exercicio.md`): até 3 exercícios da biblioteca que o
 * aluno pode pôr no lugar deste só no dia, com as mesmas séries. Recolhido diz quantas tem; abre sozinho com erro dentro
 * (`alternativas` e `alternativas[i].campo`, a mesma chave relativa dos outros erros do exercício). Cada linha remove a
 * alternativa e, se o principal é da biblioteca, troca-a com ele em todas as sessões (o editor confirma).
 */
export function AlternativasDoExercicio({ exercicio: e, erros, aoMudar, aoAdicionar, aoTrocarEmTodas }: {
  exercicio: ExercicioPlano;
  erros: Problemas;
  aoMudar: (e: ExercicioPlano) => void;
  aoAdicionar: () => void;
  aoTrocarEmTodas: (alternativa: AlternativaDeExercicio) => void;
}) {
  const { cores } = useTema();
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const lista = e.alternativas ?? [];
  const erroDaLinha = (i: number) => {
    const p = `alternativas[${i}].`;
    return erros[`${p}exercicioId`] ?? erros[`${p}nome`] ?? erros[`${p}videoUrl`] ?? null;
  };
  const comErro = !!erros.alternativas || lista.some((_, i) => erroDaLinha(i));
  // Nasce fechado, mesmo com alternativas (18/11; o botão diz quantas há); com erro, sempre aberto.
  const [escolha, setEscolha] = useState(false);
  const aberto = comErro || escolha;
  const motivo = motivoSemAdicionarAlternativa(e);
  const nome = e.nome || 'o exercício';
  const texto = `Alternativas de troca (${lista.length ? `${lista.length} de ${MAXIMO_DE_ALTERNATIVAS}` : 'nenhuma'})`;

  return (
    <>
      <BotaoDeAbrir texto={texto} aberto={aberto} aoAlternar={() => setEscolha(!aberto)} />
      {aberto ? (
        <View style={[estilos.bloco, { borderColor: cores.borda }]}>
          <Texto variante="pequeno">
            {`O aluno pode trocar ${nome} por uma destas só no dia, com as mesmas séries. Até ${MAXIMO_DE_ALTERNATIVAS}, da biblioteca e do mesmo tipo.`}
          </Texto>
          {lista.length ? (
            <View role="list" style={estilos.lista}>
              {lista.map((a, i) => {
                const erro = erroDaLinha(i);
                const nomeDela = a.nome || 'Alternativa sem nome';
                // O nome acessível começa pelo texto visível do botão largo (WCAG 2.5.3).
                const trocar = `Trocar em todas as sessões: ${nome} por ${nomeDela}`;
                return (
                  // Com índice: um rascunho com repetida (a API recusa "Alternativa repetida") não mistura as linhas.
                  <View key={`${i}:${a.exercicioId}`} role="listitem" style={[estilos.linha, { borderColor: erro ? cores.perigo : cores.borda }]}>
                    <View style={estilos.topoDaLinha}>
                      <Texto style={estilos.nome}>{nomeDela}</Texto>
                      <View style={estilos.acoes}>
                        {e.exercicioId ? (largo
                          ? <Botao rotulo="Trocar em todas as sessões" rotuloAcessivel={trocar} tipo="fantasma" Icone={Repeat} aoTocar={() => aoTrocarEmTodas(a)} />
                          : <IconeBotao moldura Icone={Repeat} rotulo={trocar} aoTocar={() => aoTrocarEmTodas(a)} />) : null}
                        <IconeBotao moldura Icone={X} rotulo={`Remover a alternativa ${nomeDela}`} aoTocar={() => aoMudar(removerAlternativa(e, i))} />
                      </View>
                    </View>
                    {erro ? <MensagemDeErro erro={erro} /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          {erros.alternativas ? <MensagemDeErro erro={erros.alternativas} /> : null}
          {lista.length && !e.exercicioId ? (
            <Texto variante="pequeno">Para trocar em todas as sessões, ligue este exercício à biblioteca pelo “Trocar”.</Texto>
          ) : null}
          <Botao rotulo="Adicionar alternativa" rotuloAcessivel={`Adicionar alternativa a ${nome}`} tipo="acao" Icone={Plus}
            aoTocar={aoAdicionar} desabilitado={!!motivo} motivo={motivo ?? undefined} />
        </View>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  // A mesma régua à esquerda do "Nome de exibição e instruções": o trecho é do botão de cima.
  bloco: { gap: espaco(1.5), paddingLeft: espaco(1.5), borderLeftWidth: 2, alignItems: 'flex-start' },
  lista: { gap: espaco(1), alignSelf: 'stretch' },
  linha: { borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(0.5), paddingLeft: espaco(1.5), paddingRight: espaco(0.5), gap: espaco(0.5) },
  topoDaLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), marginLeft: 'auto' },
});

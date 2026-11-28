import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoQuestionario } from '../../api/tipos';
import { removerPergunta } from '../../dominio/editorQuestionario';
import { AVISO_PERGUNTA_DO_INSTAGRAM, perguntasParecidasComInstagram } from '../../dominio/inscricoes';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Alerta } from '../../ui/Estados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

/**
 * Editor das perguntas da inscrição (D4 de `docs/planos/decisoes-e-pendencias-25-11.md`): uma pergunta do treinador com
 * "instagram" no texto repete o campo fixo "Instagram (opcional)" da página. Só avisa, uma por pergunta; quem remove é o
 * treinador, pela mesma confirmação e pela mesma `removerPergunta` da lixeira da pergunta (`SecoesDoQuestionario`).
 * Fica acima das seções porque o cartão da pergunta mora noutro arquivo; o título diz qual é e em que seção está.
 */
export function AvisoDePerguntaDoInstagram({ conteudo, aoMudar }: {
  conteudo: ConteudoQuestionario;
  aoMudar: (mudar: (c: ConteudoQuestionario) => ConteudoQuestionario) => void;
}) {
  // O id (não o índice): a pergunta pode mudar de lugar enquanto o painel está aberto.
  const [removendo, setRemovendo] = useState<string | null>(null);
  const parecidas = perguntasParecidasComInstagram(conteudo);
  const alvo = parecidas.find((p) => p.id === removendo);
  if (!parecidas.length) return null;

  const remover = () => {
    setRemovendo(null);
    if (!alvo) return;
    aoMudar((c) => {
      const secao = c.secoes.findIndex((s) => s.perguntas.some((p) => p.id === alvo.id));
      return secao < 0 ? c : removerPergunta(c, secao, c.secoes[secao].perguntas.findIndex((p) => p.id === alvo.id));
    });
  };

  return <View style={estilos.lista}>
    {parecidas.map((p) => (
      <Alerta key={p.id} tom="atencao" texto={AVISO_PERGUNTA_DO_INSTAGRAM}>
        <Texto variante="suave">{`Pergunta “${p.rotulo.trim()}”, na seção ${p.secao + 1}.`}</Texto>
        <View style={estilos.acoes}>
          <Botao rotulo="Remover pergunta" rotuloAcessivel={`Remover a pergunta “${p.rotulo.trim()}”`} tipo="perigo" Icone={Trash2}
            aoTocar={() => setRemovendo(p.id)} />
        </View>
      </Alerta>
    ))}
    <PainelConfirmacao visivel={alvo !== undefined} titulo={`Remover a pergunta “${alvo?.rotulo || 'sem texto'}”?`}
      mensagem="Quem já respondeu mantém as respostas na versão que respondeu. Nada é salvo até você salvar o rascunho."
      rotuloConfirmar="Remover pergunta" perigo aoCancelar={() => setRemovendo(null)} aoConfirmar={remover} />
  </View>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1), marginTop: espaco(0.5) },
});

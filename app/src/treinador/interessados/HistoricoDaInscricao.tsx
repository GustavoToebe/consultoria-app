import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { InscricaoDetalhe } from '../../api/inscricoesTipos';
import { dataHoraParaTela, SEM_DADO } from '../../dominio/formatos';
import { historicoDaInscricao, LIMITES_INSCRICAO } from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

/** Quantos itens o histórico mostra antes de "Ver tudo". */
const ITENS_INICIAIS = 8;

/**
 * Histórico do atendimento: mudanças de etapa, encerramentos, propostas, retornos, mensagens preparadas e as notas da
 * equipe, do mais novo ao mais antigo, com quem e quando. "Mensagem preparada" quer dizer copiada ou WhatsApp aberto,
 * nunca enviada. A nota nova fica em cima; o rascunho dela é da folha (não some ao salvar o andamento).
 */
export function HistoricoDaInscricao({ dados, podeAlterar, nota, aoMudarNota, aoAcrescentar, acrescentando }: {
  dados: InscricaoDetalhe;
  podeAlterar: boolean;
  nota: string;
  aoMudarNota: (texto: string) => void;
  aoAcrescentar: () => void;
  acrescentando: boolean;
}) {
  const { cores } = useTema();
  const [tudo, setTudo] = useState(false);
  const itens = historicoDaInscricao(dados.eventos, dados.notas);
  const visiveis = tudo ? itens : itens.slice(0, ITENS_INICIAIS);
  return (
    <Cartao titulo="Histórico e notas" descricao="Só a equipe vê. Ficam guardados junto com a inscrição.">
      {podeAlterar ? (
        <>
          <Campo rotulo="Nova nota" valor={nota} aoMudar={aoMudarNota} linhas={3} maxLength={LIMITES_INSCRICAO.nota} />
          <LinhaDeAcoes>
            <Botao rotulo="Acrescentar nota" tipo="secundario" aoTocar={aoAcrescentar} carregando={acrescentando}
              desabilitado={!nota.trim()} motivo="Escreva a nota antes." />
          </LinhaDeAcoes>
        </>
      ) : null}
      {itens.length === 0 ? <Texto variante="suave">Nada registrado ainda.</Texto> : null}
      {visiveis.map((item) => (
        <View key={`${item.tipo}:${item.id}`} style={[estilos.item, { borderLeftColor: item.tipo === 'nota' ? cores.texto : cores.borda }]}>
          <Texto variante="pequeno">{item.tipo === 'nota' ? 'Nota' : 'Atendimento'} · {item.autor ?? SEM_DADO} · {dataHoraParaTela(item.quando)}</Texto>
          <Texto selectable>{item.texto}</Texto>
        </View>
      ))}
      {itens.length > ITENS_INICIAIS ? (
        <LinhaDeAcoes>
          <Botao rotulo={tudo ? 'Mostrar menos' : `Ver tudo (${itens.length})`} tipo="fantasma" aoTocar={() => setTudo(!tudo)} />
        </LinhaDeAcoes>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  item: { gap: 2, borderLeftWidth: 2, paddingLeft: espaco(1) },
});

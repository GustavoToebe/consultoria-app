import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { InscricaoDetalhe, InscricaoSemelhante } from '../../api/inscricoesTipos';
import { desfazerRelacaoDaInscricao, inscricoesSemelhantes, relacionarInscricao } from '../../api/rotas';
import { dataHoraParaTela } from '../../dominio/formatos';
import { seloDaSituacao, textoDaDuplicidade } from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import type { Executar } from './executar';

const COINCIDE: Record<'EMAIL' | 'WHATSAPP', string> = { EMAIL: 'mesmo e-mail', WHATSAPP: 'mesmo WhatsApp' };

/**
 * Possível duplicidade e a relação confirmada pela equipe. Coincidir e-mail ou WhatsApp é só possível: pessoas
 * diferentes podem dividir um telefone. "É a mesma pessoa" só liga as duas inscrições no histórico; nada é juntado,
 * movido nem apagado.
 */
export function SemelhantesDaInscricao({ dados, podeAlterar, podeVerAluno, executar, ocupado, aoAbrirOutra, aoAbrirFicha }: {
  dados: InscricaoDetalhe;
  podeAlterar: boolean;
  podeVerAluno: boolean;
  executar: Executar;
  ocupado: string | null;
  aoAbrirOutra: (id: string) => void;
  aoAbrirFicha: (alunoId: string) => void;
}) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState(false);
  const [confirmar, setConfirmar] = useState<InscricaoSemelhante | null>(null);
  const semelhantes = useCarregar(aberta ? `semelhantes:${dados.id}:${dados.versao}` : null, () => inscricoesSemelhantes(dados.id));
  const texto = textoDaDuplicidade(dados.duplicidade);
  const relacionada = dados.relacionadaA;
  if (!texto && !relacionada) return null;

  const relacionar = (outra: InscricaoSemelhante) => {
    setConfirmar(null);
    executar('relacionar', () => relacionarInscricao(dados.id, outra.id, dados.versao), 'Inscrições relacionadas.');
  };
  const desfazer = () => executar('relacao', () => desfazerRelacaoDaInscricao(dados.id, dados.versao), 'Relação desfeita.');

  return (
    <Cartao titulo={relacionada ? 'Mesma pessoa' : 'Possível duplicidade'}
      descricao="Só um aviso: nada é juntado sozinho. Confira antes de aceitar.">
      {relacionada ? (
        <View style={estilos.bloco}>
          <Texto>Mesma pessoa de: {relacionada.nome} ({seloDaSituacao(relacionada.situacao).texto}, {dataHoraParaTela(relacionada.criadaEm)})</Texto>
          <LinhaDeAcoes>
            <Botao rotulo="Abrir a anterior" tipo="secundario" aoTocar={() => aoAbrirOutra(relacionada.id)} />
            {podeAlterar ? <Botao rotulo="Desfazer relação" tipo="perigoTexto" aoTocar={desfazer} carregando={ocupado === 'relacao'} /> : null}
          </LinhaDeAcoes>
        </View>
      ) : null}
      {texto ? <Alerta tom="atencao" texto={texto} /> : null}
      {dados.duplicidade.alunoId && podeVerAluno ? (
        <LinhaDeAcoes>
          <Botao rotulo="Abrir ficha do aluno" tipo="secundario" aoTocar={() => aoAbrirFicha(dados.duplicidade.alunoId ?? '')} />
        </LinhaDeAcoes>
      ) : null}
      {!aberta ? (
        <LinhaDeAcoes><Botao rotulo="Ver inscrições semelhantes" tipo="secundario" aoTocar={() => setAberta(true)} /></LinhaDeAcoes>
      ) : null}
      {aberta && semelhantes.erro ? <MensagemErro texto={textoDoErro(semelhantes.erro)} erro={semelhantes.erro} tentarDeNovo={semelhantes.recarregar} /> : null}
      {aberta && !semelhantes.dados && !semelhantes.erro ? <Esqueleto /> : null}
      {aberta && semelhantes.dados ? (
        <View style={estilos.lista}>
          {semelhantes.dados.inscricoes.length === 0 ? <Texto variante="suave">Nenhuma outra inscrição com o mesmo contato.</Texto> : null}
          {semelhantes.dados.inscricoes.map((s) => {
            const selo = seloDaSituacao(s.situacao);
            return (
              <View key={s.id} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
                <View style={estilos.linha}>
                  <Texto variante="bloco">{s.nome}</Texto>
                  <Selo texto={selo.texto} tipo={selo.tipo} />
                  {s.relacionada ? <Selo texto="Mesma pessoa" tipo="neutro" /> : null}
                </View>
                <Texto variante="pequeno">
                  {dataHoraParaTela(s.criadaEm)} · {s.coincide.map((c) => COINCIDE[c]).join(' e ')}
                </Texto>
                <LinhaDeAcoes>
                  <Botao rotulo="Abrir" tipo="secundario" aoTocar={() => aoAbrirOutra(s.id)} />
                  {podeAlterar && !s.relacionada && relacionada?.id !== s.id ? (
                    <Botao rotulo="É a mesma pessoa" tipo="secundario" aoTocar={() => setConfirmar(s)} carregando={ocupado === 'relacionar'} />
                  ) : null}
                </LinhaDeAcoes>
              </View>
            );
          })}
          {semelhantes.dados.aluno ? (
            <View style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <Texto variante="bloco">{semelhantes.dados.aluno.nome ? `Aluno com este e-mail: ${semelhantes.dados.aluno.nome}` : 'Aluno com este e-mail'}</Texto>
              {semelhantes.dados.aluno.id && podeVerAluno ? (
                <LinhaDeAcoes><Botao rotulo="Abrir ficha" tipo="secundario" aoTocar={() => aoAbrirFicha(semelhantes.dados?.aluno?.id ?? '')} /></LinhaDeAcoes>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      <PainelConfirmacao visivel={!!confirmar} titulo="É a mesma pessoa?"
        mensagem={`Esta inscrição fica ligada à de ${confirmar?.nome ?? ''} no histórico. Nada é juntado, movido nem apagado; dá para desfazer.`}
        rotuloConfirmar="Relacionar" aoConfirmar={() => { if (confirmar) relacionar(confirmar); }} aoCancelar={() => setConfirmar(null)} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  lista: { gap: espaco(1) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
});

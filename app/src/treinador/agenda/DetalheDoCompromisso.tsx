import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Compromisso, Participante } from '../../api/agendaTipos';
import { rotuloDoDia } from '../../dominio/agenda';
import {
  type AcaoDeSituacao, acoesDeSituacao, seloDaSituacao, seloDoCompromisso, textoDaDuracao, textoDaOcorrencia, textoDoHorario,
} from '../../dominio/agendaPresencial';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

interface Props {
  compromisso: Compromisso;
  hoje: string;
  agora: Date;
  /** Ação em andamento (`<alunoId>:<situacao>`), para o "carregando" do botão certo. */
  enviando: string | null;
  aoAgirNoAluno: (aluno: Participante, acao: AcaoDeSituacao) => void;
}

/**
 * Detalhe do compromisso com aluno: quando, duração, local, responsável, observação (só com `ALUNO_SENSIVEL_LER`) e os
 * participantes, cada um com a situação dele e as ações de realizado, falta, cancelar ou reabrir a participação (rota por
 * aluno). Cancelar ou reabrir o compromisso inteiro fica no rodapé da folha, separado. A ficha só com um aluno.
 */
export function DetalheDoCompromisso({ compromisso: c, hoje, agora, enviando, aoAgirNoAluno }: Props) {
  const { pode } = useSessao();
  const podeAlterar = pode('AGENDA_ALTERAR');
  const varios = c.participantes.length > 1;
  const selo = seloDoCompromisso(c);
  const ocorrencia = textoDaOcorrencia(c);
  const unico = c.participantes.length === 1 ? c.participantes[0] : null;
  // Antes do início, realizado e falta não valem para ninguém: uma frase só, em vez de um botão apagado por aluno.
  const comecou = Date.parse(c.inicio) <= agora.getTime();

  return (
    <View style={estilos.coluna}>
      <View style={estilos.topo}>
        <Texto variante="bloco">{`${rotuloDoDia(c.data, hoje)}, ${dataSemAnoCorrente(c.data, hoje)} · ${textoDoHorario(c)}`}</Texto>
        {varios || ocorrencia ? <View style={estilos.linhaSelo}>
          {varios ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
          {ocorrencia ? <Texto variante="suave" numerico>{ocorrencia}</Texto> : null}
        </View> : null}
      </View>
      <CampoLeitura rotulo="Duração" valor={textoDaDuracao(c.duracaoMinutos)} />
      <CampoLeitura rotulo="Local" valor={c.local} />
      <CampoLeitura rotulo="Responsável" valor={c.responsavelNome ?? (c.responsavelId ? 'Membro inativo' : null)} />
      {pode('ALUNO_SENSIVEL_LER') ? <CampoLeitura rotulo="Observação" valor={c.observacao} /> : null}

      <Texto variante="secao" nivel={3}>{varios ? `Alunos (${c.participantes.length})` : 'Aluno'}</Texto>
      {podeAlterar && !comecou && !c.cancelado ? (
        <Texto variante="pequeno">Realizado e falta ficam disponíveis a partir do horário do compromisso.</Texto>
      ) : null}
      <ListaDeLinhas>
        {c.participantes.map((p) => {
          const s = seloDaSituacao(p.situacao);
          const acoes = podeAlterar
            ? acoesDeSituacao({ situacao: p.situacao, inicio: c.inicio }, agora, { nome: p.nome, sozinho: !varios, cancelado: c.cancelado })
              .filter((a) => !a.motivo)
            : [];
          return (
            <LinhaDaLista key={p.id} titulo={p.nome ?? 'Aluno'} selos={[s]} esmaecido={p.situacao === 'CANCELADO'}
              acoes={acoes.length ? <LinhaDeAcoes>
                {acoes.map((a) => (
                  <Botao key={a.situacao} rotulo={a.rotulo} rotuloAcessivel={a.rotuloAcessivel} tipo={a.perigo ? 'perigoTexto' : 'secundario'}
                    carregando={enviando === `${p.id}:${a.situacao}`} desabilitado={enviando !== null} motivo="Salvando."
                    aoTocar={() => aoAgirNoAluno(p, a)} />
                ))}
              </LinhaDeAcoes> : undefined} />
          );
        })}
      </ListaDeLinhas>
      {pode('ALUNO_LER') && unico ? <LinkTexto texto="Abrir ficha do aluno" href={`/treinador/alunos/${unico.id}` as Href} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  topo: { gap: espaco(1) },
  linhaSelo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
});

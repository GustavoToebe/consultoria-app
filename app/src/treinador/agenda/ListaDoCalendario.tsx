import { StyleSheet, View } from 'react-native';

import type { AtualizacaoDaLista } from '../../api/tipos';
import { rotuloDoDia } from '../../dominio/agenda';
import { agruparPorDia, type ItemDoCalendario } from '../../dominio/agendaCalendario';
import { resumoDoDia, textoDaOcorrencia, textoDoHorario } from '../../dominio/agendaPresencial';
import { caminhoAtualizacaoTreinador } from '../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Texto } from '../../ui/Texto';
import { type AoAbrirItem, MarcadorDaAgenda, rotuloDoItem, seloDaAtualizacaoNaAgenda, seloDoCompromissoComIcone } from './itemDaAgenda';

interface Props {
  itens: readonly ItemDoCalendario[];
  de: string;
  ate: string;
  hoje: string;
  meus: boolean;
  /** Nome de cada agenda pessoal pelo id (os metadados do evento dizem de qual agenda ele é). */
  nomesDasAgendas: ReadonlyMap<string, string>;
  /** Atualizações sem data, no grupo "Sem data" (só quando o período inclui hoje, como antes). */
  semData?: readonly AtualizacaoDaLista[];
  aoAbrir: AoAbrirItem;
  /** Chave do item aberto na folha: a linha dele fica marcada (seleção neutra). */
  escolhido?: string | null;
}

/** "Hoje, 19/10", "Amanhã, 20/10", "Quarta-feira, 21/10". */
export const tituloDoDia = (data: string, hoje: string) => `${rotuloDoDia(data, hoje)}, ${dataSemAnoCorrente(data, hoje)}`;

/**
 * Dia e Semana no celular (e o dia escolhido no Mês compacto): um cartão por dia com compromisso, com a faixa do dia e o
 * resumo; o dia vazio é uma linha compacta com divisória ("Quinta-feira, 12/11 · Nada marcado"), para a semana caber na
 * tela sem esconder nenhuma data. Cada linha tem a faixa da cor da agenda (8 px, como na grade) sobre o fundo neutro; o
 * título começa pelo horário e o status do compromisso vai num selo escrito, depois; a atualização é link para a ficha.
 */
export function ListaDoCalendario({ itens, de, ate, hoje, meus, nomesDasAgendas, semData = [], aoAbrir, escolhido = null }: Props) {
  const { cores } = useTema();
  const dias = agruparPorDia(itens, de, ate);
  const comSemData = semData.length > 0 && de <= hoje && hoje <= ate;
  return (
    <View>
      {dias.map((dia) => {
        const conta = (origem: ItemDoCalendario['origem']) => dia.itens.filter((i) => i.origem === origem).length;
        if (!dia.itens.length) return (
          <View key={dia.data} style={[estilos.diaVazio, { borderBottomColor: cores.divisor }]}>
            <Texto variante="bloco">{tituloDoDia(dia.data, hoje)}</Texto>
            <Texto variante="suave" aria-hidden>·</Texto>
            <Texto variante="suave">{resumoDoDia(0, 0)}</Texto>
          </View>
        );
        return (
          <Cartao key={dia.data} style={estilos.noMeio}
            cabecalho={<CabecalhoDeGrupo titulo={tituloDoDia(dia.data, hoje)} resumo={resumoDoDia(conta('COMPROMISSO'), conta('ATUALIZACAO'), conta('EVENTO'))} />}>
            <ListaDeLinhas>
              {dia.itens.map((item) => <Linha key={`${item.chave}@${dia.data}`} item={item} dia={dia.data} hoje={hoje} meus={meus}
                nomesDasAgendas={nomesDasAgendas} aoAbrir={aoAbrir} escolhido={item.chave === escolhido} />)}
            </ListaDeLinhas>
          </Cartao>
        );
      })}
      {comSemData ? <View style={estilos.noMeio}><CartaoSemData semData={semData} meus={meus} /></View> : null}
    </View>
  );
}

/** As atualizações sem data (pasta sem fim), num cartão à parte: na lista, na grade e no mês, quando o período inclui hoje. */
export function CartaoSemData({ semData, meus }: { semData: readonly AtualizacaoDaLista[]; meus: boolean }) {
  return (
    <Cartao cabecalho={<CabecalhoDeGrupo titulo="Sem data" resumo={resumoDoDia(0, semData.length)} />}>
      <ListaDeLinhas>
        {semData.map((a) => {
          const nome = a.nomeAluno ?? 'Aluno';
          return <LinhaDaLista key={`a:${a.pastaId ?? a.alunoId}`} titulo={nome} metadados="Atualização"
            inicio={<MarcadorDaAgenda cor="ARDOSIA" forma="faixa" />}
            href={caminhoAtualizacaoTreinador(a, { situacao: 'PROXIMAS', meus })} rotulo={`Abrir atualização de ${nome}, sem data`} />;
        })}
      </ListaDeLinhas>
    </Cartao>
  );
}

function Linha({ item, dia, hoje, meus, nomesDasAgendas, aoAbrir, escolhido }: {
  item: ItemDoCalendario; dia: string; hoje: string; meus: boolean; nomesDasAgendas: ReadonlyMap<string, string>; aoAbrir: AoAbrirItem;
  escolhido: boolean;
}) {
  const f = item.fonte;
  // A faixa de 8 px da cor da agenda, como na grade; o status vai no selo (nunca só na cor ou na opacidade).
  const marcador = <MarcadorDaAgenda cor={item.cor} forma="faixa" />;
  if (f.origem === 'ATUALIZACAO') {
    const selo = seloDaAtualizacaoNaAgenda(f.atualizacao, hoje);
    // O dia já está no título do cartão: o selo só entra quando diz algo a mais (adiada, atrasada).
    return <LinhaDaLista titulo={item.titulo} metadados="Atualização" inicio={marcador}
      selos={selo ? [{ texto: selo.curto, tipo: selo.tipo, Icone: selo.Icone }] : undefined}
      href={caminhoAtualizacaoTreinador(f.atualizacao, { situacao: 'PROXIMAS', meus })}
      rotulo={`Abrir atualização de ${item.titulo}, ${tituloDoDia(dia, hoje)}${selo ? `, ${selo.curto}` : ''}`} />;
  }
  if (f.origem === 'COMPROMISSO') {
    const c = f.compromisso;
    // Horário e quem antes; embaixo o que é, o local e o responsável (o compromisso não tem tipo nem descrição).
    const meta = ['Compromisso', c.local, c.responsavelNome ? `com ${c.responsavelNome}` : null, textoDaOcorrencia(c)].filter((p): p is string => !!p);
    return <LinhaDaLista titulo={`${textoDoHorario(c)} · ${item.titulo}`} metadados={meta.join(' · ')} selos={[seloDoCompromissoComIcone(c)]}
      inicio={marcador} marcado={escolhido}
      aoTocarTextos={() => aoAbrir(item)}
      acoes={<Botao rotulo="Abrir" tipo="secundario" rotuloAcessivel={rotuloDoItem(item, hoje)} aoTocar={() => aoAbrir(item)} />} />;
  }
  const o = f.ocorrencia;
  const horario = o.diaInteiro ? 'Dia inteiro' : `${o.hora ?? ''}–${o.horaFim ?? ''}`;
  const partes = ['Evento', o.local, nomesDasAgendas.get(o.agendaId)].filter((p): p is string => !!p);
  return <LinhaDaLista titulo={`${horario} · ${item.titulo}`} metadados={partes.join(' · ')} inicio={marcador} marcado={escolhido}
    aoTocarTextos={() => aoAbrir(item)}
    acoes={<Botao rotulo="Abrir" tipo="secundario" rotuloAcessivel={rotuloDoItem(item, hoje)} aoTocar={() => aoAbrir(item)} />} />;
}

const estilos = StyleSheet.create({
  // A lista não tem `gap`: o cartão leva o respiro dele e o dia vazio fica compacto, colado na divisória do vizinho.
  noMeio: { marginVertical: espaco(1.5) },
  // Dia sem nada: uma linha só, com a divisória embaixo, no lugar do cartão (o cartão fica para o dia com compromisso).
  diaVazio: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1), paddingHorizontal: espaco(2), paddingVertical: espaco(1.5), borderBottomWidth: 1 },
});

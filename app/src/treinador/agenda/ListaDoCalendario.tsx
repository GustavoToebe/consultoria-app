import { StyleSheet, View } from 'react-native';

import type { AtualizacaoDaLista } from '../../api/tipos';
import { rotuloDoDia } from '../../dominio/agenda';
import { agruparPorDia, type ItemDoCalendario } from '../../dominio/agendaCalendario';
import { metadadosDoCompromisso, resumoDoDia, seloDoCompromisso } from '../../dominio/agendaPresencial';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { type AoAbrirItem, MarcadorDaAgenda, rotuloDoItem } from './itemDaAgenda';

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
}

/** "Hoje, 19/10", "Amanhã, 20/10", "Quarta-feira, 21/10". */
export const tituloDoDia = (data: string, hoje: string) => `${rotuloDoDia(data, hoje)}, ${dataSemAnoCorrente(data, hoje)}`;

/**
 * Dia e Semana no celular (e o dia escolhido no Mês compacto): um cartão por dia com a faixa do dia e o resumo; o dia vazio
 * fica só na faixa, para a semana caber na tela. Cada linha tem o marcador da cor da agenda; o status do compromisso
 * continua num selo; a atualização é link para a ficha.
 */
export function ListaDoCalendario({ itens, de, ate, hoje, meus, nomesDasAgendas, semData = [], aoAbrir }: Props) {
  const dias = agruparPorDia(itens, de, ate);
  const comSemData = semData.length > 0 && de <= hoje && hoje <= ate;
  return (
    <View style={estilos.lista}>
      {dias.map((dia) => {
        const conta = (origem: ItemDoCalendario['origem']) => dia.itens.filter((i) => i.origem === origem).length;
        return (
          <Cartao key={dia.data}
            cabecalho={<CabecalhoDeGrupo titulo={tituloDoDia(dia.data, hoje)} resumo={resumoDoDia(conta('COMPROMISSO'), conta('ATUALIZACAO'), conta('EVENTO'))} />}>
            {dia.itens.length ? <ListaDeLinhas>
              {dia.itens.map((item) => <Linha key={`${item.chave}@${dia.data}`} item={item} dia={dia.data} hoje={hoje} meus={meus}
                nomesDasAgendas={nomesDasAgendas} aoAbrir={aoAbrir} />)}
            </ListaDeLinhas> : null}
          </Cartao>
        );
      })}
      {comSemData ? <CartaoSemData semData={semData} meus={meus} /> : null}
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
            inicio={<MarcadorDaAgenda cor="ARDOSIA" />}
            href={caminhoAtualizacaoTreinador(a, { situacao: 'PROXIMAS', meus })} rotulo={`Abrir atualização de ${nome}, sem data`} />;
        })}
      </ListaDeLinhas>
    </Cartao>
  );
}

function Linha({ item, dia, hoje, meus, nomesDasAgendas, aoAbrir }: {
  item: ItemDoCalendario; dia: string; hoje: string; meus: boolean; nomesDasAgendas: ReadonlyMap<string, string>; aoAbrir: AoAbrirItem;
}) {
  const f = item.fonte;
  const marcador = <MarcadorDaAgenda cor={item.cor} />;
  if (f.origem === 'ATUALIZACAO') {
    const selo = statusAtualizacaoTreinador(f.atualizacao, hoje);
    // O dia já está no título do cartão: o selo só entra quando diz algo a mais (adiada, atrasada).
    return <LinhaDaLista titulo={item.titulo} metadados="Atualização" inicio={marcador}
      selos={selo.tipo === 'neutro' ? undefined : [{ texto: selo.curto, tipo: selo.tipo }]}
      href={caminhoAtualizacaoTreinador(f.atualizacao, { situacao: 'PROXIMAS', meus })}
      rotulo={`Abrir atualização de ${item.titulo}, ${tituloDoDia(dia, hoje)}${selo.tipo === 'neutro' ? '' : `, ${selo.curto}`}`} />;
  }
  if (f.origem === 'COMPROMISSO') {
    const c = f.compromisso;
    return <LinhaDaLista titulo={item.titulo} metadados={metadadosDoCompromisso(c)} selos={[seloDoCompromisso(c)]} inicio={marcador}
      esmaecido={item.cancelado} aoTocarTextos={() => aoAbrir(item)}
      acoes={<Botao rotulo="Abrir" tipo="secundario" rotuloAcessivel={rotuloDoItem(item, hoje)} aoTocar={() => aoAbrir(item)} />} />;
  }
  const o = f.ocorrencia;
  const partes = ['Evento', o.diaInteiro ? 'Dia inteiro' : `${o.hora ?? ''}–${o.horaFim ?? ''}`, o.local, nomesDasAgendas.get(o.agendaId)]
    .filter((p): p is string => !!p);
  return <LinhaDaLista titulo={item.titulo} metadados={partes.join(' · ')} inicio={marcador}
    aoTocarTextos={() => aoAbrir(item)}
    acoes={<Botao rotulo="Abrir" tipo="secundario" rotuloAcessivel={rotuloDoItem(item, hoje)} aoTocar={() => aoAbrir(item)} />} />;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(3) },
});

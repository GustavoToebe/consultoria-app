import { Ellipsis, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica } from '../../api/avaliacaoFisicaTipos';
import { COMPARAR_MAXIMO, medidasPreenchidas, pesoParaTela } from '../../dominio/avaliacaoFisica';
import { idDaMaisRecente } from '../../dominio/comparacaoDeAvaliacoes';
import { dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';

const LINHAS_INICIAIS = 6;

function metadados(a: AvaliacaoFisica): string {
  const n = medidasPreenchidas(a.medidas);
  return [`${n} ${n === 1 ? 'medida' : 'medidas'}`, a.pesoKg !== null ? `Peso ${pesoParaTela(a.pesoKg)}` : null].filter(Boolean).join(' · ');
}

interface Props {
  avaliacoes: AvaliacaoFisica[];
  /** No Comparar a linha ganha a caixa de marcar (o toque no texto também marca); fora dele, a linha só tem as ações. */
  marcar?: { marcadas: string[]; aoAlternar: (id: string) => void };
  podeGravar: boolean;
  aoEditar: (a: AvaliacaoFisica) => void;
  aoExcluir: (a: AvaliacaoFisica) => void;
}

/**
 * Uma linha por avaliação: data, número de medidas (e o peso do dia), a observação (até duas linhas, como antes) e o selo "Mais recente".
 * Com `ALUNO_SENSIVEL_ALTERAR`, o lápis à vista e o "Excluir" no ⋯ (que confirma num painel). A linha nunca abre e marca ao
 * mesmo tempo: não tem link, e no Comparar o toque marca.
 */
export function HistoricoDeAvaliacoes({ avaliacoes, marcar, podeGravar, aoEditar, aoExcluir }: Props) {
  const [todas, setTodas] = useState(false);
  const [menu, setMenu] = useState<AvaliacaoFisica | null>(null);
  const maisRecente = idDaMaisRecente(avaliacoes);
  const visiveis = todas ? avaliacoes : avaliacoes.slice(0, LINHAS_INICIAIS);
  const cheia = (marcar?.marcadas.length ?? 0) >= COMPARAR_MAXIMO;

  return (
    <View style={estilos.bloco}>
      <Texto variante="secao" nivel={3}>Histórico</Texto>
      <ListaDeLinhas>
        {visiveis.map((a) => {
          const data = dataParaTela(a.data);
          const marcada = !!marcar?.marcadas.includes(a.id);
          const bloqueada = !!marcar && !marcada && cheia;
          const alternar = marcar && !bloqueada ? () => marcar.aoAlternar(a.id) : undefined;
          return (
            <LinhaDaLista
              key={a.id}
              titulo={data}
              metadados={metadados(a)}
              descricao={a.observacao ?? undefined}
              selos={a.id === maisRecente ? [{ texto: 'Mais recente', tipo: 'neutro' }] : undefined}
              marcado={marcada}
              inicio={marcar ? (
                <CaixaDaLinha
                  rotulo={bloqueada ? `Comparar ${data} (máximo de ${COMPARAR_MAXIMO} datas)` : `Comparar ${data}`}
                  marcado={marcada}
                  desabilitado={bloqueada}
                  aoMudar={() => marcar.aoAlternar(a.id)}
                />
              ) : undefined}
              aoTocarTextos={alternar}
              acoesAoLado
              acoes={podeGravar ? (
                <View style={estilos.acoes}>
                  <IconeBotao Icone={Pencil} rotulo={`Editar avaliação de ${data}`} aoTocar={() => aoEditar(a)} />
                  <IconeBotao Icone={Ellipsis} rotulo={`Mais ações da avaliação de ${data}`} aoTocar={() => setMenu(a)} />
                </View>
              ) : undefined}
            />
          );
        })}
      </ListaDeLinhas>
      {avaliacoes.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todas ? 'Mostrar só as últimas' : `Mostrar todas (${avaliacoes.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
      ) : null}
      {menu ? (
        <FolhaDeAcoes
          titulo={`Avaliação de ${dataParaTela(menu.data)}`}
          aoFechar={() => setMenu(null)}
          acoes={[{ rotulo: 'Excluir avaliação', detalhe: 'As medidas saem; o registro de peso continua.', Icone: Trash2, perigo: true, aoTocar: () => aoExcluir(menu) }]}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  acoes: { flexDirection: 'row' },
});

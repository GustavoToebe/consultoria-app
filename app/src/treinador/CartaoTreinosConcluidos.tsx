import { Check, Eye } from 'lucide-react-native';
import { useState } from 'react';

import { desmarcarTreinoVisto, marcarTreinoVisto, sessoesConcluidasDoAlunoParaTreinador } from '../api/rotas';
import type { SessoesConcluidasResponse } from '../api/tipos';
import { dataRelativa } from '../dominio/datasRelativas';
import { hojeIso, somarDias } from '../dominio/formatos';
import { metadadosDoTreino, textoDoTotalDeTreinos, treinosConcluidos } from '../dominio/retornoDoTreinador';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { useCarregar } from '../ui/useCarregar';

/** Dias para trás na lista (hoje incluído): duas semanas, o padrão da rota. */
const DIAS = 14;

/**
 * Treinos que o aluno concluiu nos últimos 14 dias (Engajamento 0.5), com o que ele informou (resultado, duração e, com
 * `ALUNO_SENSIVEL_LER`, o comentário, que a API manda nulo sem ela) e o "Visto" (P4: a única reação, sem texto; com
 * `REGISTRO_REAGIR`). Marcar de novo não duplica; "Visto" de novo desfaz (toque errado). Quem renderiza confere
 * `REGISTRO_LER` e a chave do retorno.
 */
export function CartaoTreinosConcluidos({ alunoId }: { alunoId: string }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const hoje = hojeIso();
  const { dados, erro, recarregar, definir } = useCarregar(`treinos-concluidos:${alunoId}:${hoje}`,
    () => sessoesConcluidasDoAlunoParaTreinador(alunoId, somarDias(hoje, -(DIAS - 1)), hoje));
  const [salvando, setSalvando] = useState<string | null>(null);
  const reagir = pode('REGISTRO_REAGIR');

  const alternar = async (id: string, visto: boolean) => {
    if (!dados) return;
    setSalvando(id);
    try {
      const vistoEm = visto ? (await desmarcarTreinoVisto(alunoId, id), null) : (await marcarTreinoVisto(alunoId, id)).vistoEm;
      definir({ ...dados, sessoes: dados.sessoes.map((s) => (s.id === id ? { ...s, vistoEm } : s)) } satisfies SessoesConcluidasResponse);
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
      recarregar();
    } finally {
      setSalvando(null);
    }
  };

  const lista = dados ? treinosConcluidos(dados.sessoes) : [];
  // Vazio é uma linha só na faixa (guia de 11/11, pág. 33): sem corpo, o cartão fica do tamanho do título.
  const descricao = !dados ? `Últimos ${DIAS} dias.`
    : lista.length ? `Últimos ${DIAS} dias · ${textoDoTotalDeTreinos(dados.totalConcluidos)}`
      : `Nenhum treino concluído nos últimos ${DIAS} dias${dados.totalConcluidos > 0 ? ` · ${textoDoTotalDeTreinos(dados.totalConcluidos)}` : '.'}`;
  return (
    <Cartao titulo="Treinos concluídos" descricao={descricao}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados === undefined && !erro ? <Esqueleto cartoes={1} /> : null}
      {lista.length ? (
        <ListaDeLinhas>
          {lista.map((s) => {
            const visto = !!s.vistoEm;
            const titulo = `${s.sessaoNome ?? 'Treino'} · ${dataRelativa(s.data)}`;
            return (
              <LinhaDaLista key={s.id} titulo={titulo} metadados={metadadosDoTreino(s) || undefined}
                descricao={s.comentario ?? undefined}
                selos={visto && !reagir ? [{ texto: 'Visto', tipo: 'sucesso' }] : undefined}
                acoes={reagir ? (
                  <Botao rotulo={visto ? 'Visto' : 'Marcar como visto'} tipo="secundario" Icone={visto ? Check : Eye}
                    rotuloAcessivel={visto ? `${titulo}: visto. Tocar desfaz.` : `Marcar ${titulo} como visto`}
                    carregando={salvando === s.id} aoTocar={() => void alternar(s.id!, visto)} />
                ) : undefined} />
            );
          })}
        </ListaDeLinhas>
      ) : null}
    </Cartao>
  );
}

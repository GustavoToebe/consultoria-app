import { CircleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import type { View } from 'react-native';

import type { OpcaoRefeicao } from '../../api/tipos';
import { CONTA_NO_TOTAL, kcalDaAba, nomeDaAba, tituloDaOpcao } from '../../dominio/opcoesDaRefeicao';
import { useTema } from '../../tema/TemaProvider';
import { AbasDasOpcoes } from '../../ui/MarcadorDeOpcao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

interface Props {
  /** Nome da lista de abas para o leitor de tela ("Opções de 12:00 · Almoço"). */
  rotulo: string;
  opcoes: OpcaoRefeicao[];
  aberta: string;
  comProblema: ReadonlySet<string>;
  aoAbrir: (uid: string) => void;
  /** No fim da faixa, fora da rolagem e da lista de abas (o "+ Opção"): sempre inteiro à vista. */
  depois: ReactNode;
  /** Logo abaixo das abas, antes da opção aberta (a frase de apoio). */
  apoio?: ReactNode;
  /** Guarda a aba de cada opção, para quem precisa pôr o foco nela (depois de criar ou excluir). */
  registrar: (uid: string, aba: View | null) => void;
  /** A opção aberta (`tabpanel`). */
  children: ReactNode;
}

/**
 * Opções da refeição em abas no editor (19/11; círculo com a letra desde 25/11): a faixa é a `ui/AbasDasOpcoes`, a
 * mesma da dieta do aluno. Aqui entram o que é do editor: "Opção A · 98 kcal" (a kcal em fonte numérica na cor do texto;
 * "vazia" em texto secundário, nunca "0 kcal"), o selo "Conta no total do dia" na primeira e o ícone da aba com erro da
 * validação.
 */
export function AbasDeOpcao({ rotulo, opcoes, aberta, comProblema, aoAbrir, depois, apoio, registrar, children }: Props) {
  const { cores } = useTema();
  return (
    <AbasDasOpcoes rotulo={rotulo} aberta={aberta} aoAbrir={aoAbrir} depois={depois} apoio={apoio} registrar={registrar}
      abas={opcoes.map((o, i) => {
        const problema = comProblema.has(o.uid);
        const vazia = o.itens.length === 0;
        return {
          valor: o.uid,
          letra: o.rotulo,
          titulo: tituloDaOpcao(o),
          rotuloAcessivel: nomeDaAba(o, i === 0, problema),
          antes: problema ? <CircleAlert size={16} color={cores.perigo} strokeWidth={2.5} /> : undefined,
          detalhe: <>
            <Texto variante="suave" aria-hidden>·</Texto>
            <Texto variante="suave" cor={vazia ? undefined : cores.texto} numerico={!vazia}>{kcalDaAba(o)}</Texto>
          </>,
          // O selo da primeira vai na linha de baixo: na mesma linha, a aba aberta passava da faixa em 390 e empurrava a
          // terceira para fora em 1280.
          abaixo: i === 0 ? <Selo texto={CONTA_NO_TOTAL} /> : undefined,
        };
      })}>
      {children}
    </AbasDasOpcoes>
  );
}

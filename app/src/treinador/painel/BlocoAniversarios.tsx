import type { Aniversariante } from '../../dominio/aniversariosDosAlunos';
import { descricaoDaJanela } from '../../dominio/aniversariosDosAlunos';
import { comMaiuscula } from '../../dominio/datasRelativas';
import { Cartao } from '../../ui/Cartao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { FaixaDoPainel } from './FaixaDoPainel';

type ItemDoAniversario = Aniversariante<{ alunoId: string; nome: string; dia: number; mes: number }>;

/**
 * Aniversariantes do Início, no cartão com a faixa dos blocos do painel e uma linha por aluno (abre a ficha). Só nome e dia/mês,
 * nunca idade nem ano (D1). O Início só o monta com `ALUNO_LER` e lista não vazia: sem aniversariante, nada aparece.
 */
// shortcut: fica fora da grade e do "Editar" do painel (sem ordem, tamanho nem Todos/Meus), vira bloco 'aniversarios' em painelBlocos quando pedirem.
export function BlocoAniversarios({ itens, dias }: { itens: readonly ItemDoAniversario[]; dias: number }) {
  return (
    <Cartao cabecalho={<FaixaDoPainel titulo="Aniversários" descricao={descricaoDaJanela(dias)} />}>
      <ListaDeLinhas>
        {itens.map((a) => (
          <LinhaDaLista key={a.alunoId} titulo={a.nome} metadados={`${a.data} · ${comMaiuscula(a.quando)}`} href={`/treinador/alunos/${a.alunoId}`}
            rotulo={`${a.nome}, aniversário ${a.quando}, dia ${a.data}. Abrir a ficha`} />
        ))}
      </ListaDeLinhas>
    </Cartao>
  );
}

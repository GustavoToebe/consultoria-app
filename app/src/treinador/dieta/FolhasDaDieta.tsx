import { criarReceita, salvarPlanoComoReceita } from '../../api/rotas';
import type { Alimento, ConteudoDieta, ErgogenicoDaBiblioteca, Refeicao, SuplementoDaBiblioteca } from '../../api/tipos';
import { aplicarReceitaDeDieta, novoItem, normalizarDieta, trocarAlimentoNasRefeicoes } from '../../dominio/dieta';
import { substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { SEM_DADO } from '../../dominio/formatos';
import { descricaoDaPorcao, linhaDeSuplementacao } from '../../dominio/suplementos';
import { novoUid } from '../../dominio/uid';
import { useAviso } from '../../ui/Aviso';
import { Folha } from '../../ui/Folha';
import { FolhaReceitas } from '../FolhaReceitas';
import { FolhaSalvarReceita } from '../FolhaSalvarReceita';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { OpcaoDeModelo } from '../plano/OpcaoDeModelo';
import { FolhaAlimentos } from './FolhaAlimentos';
import { FolhaErgogenicos } from './FolhaErgogenicos';
import { FolhaListaDeCompras } from './FolhaListaDeCompras';
import { FolhaSuplementos } from './FolhaSuplementos';

export type FolhaDaDieta =
  | { tipo: 'modelos' }
  | { tipo: 'alimento'; refeicao: number; opcao: number }
  /** "Trocar alimento" (C56): o item `uid` da refeição `refeicao` (índice na seção aberta). */
  | { tipo: 'trocar'; refeicao: number; uid: string }
  | { tipo: 'receita' }
  | { tipo: 'suplemento' }
  | { tipo: 'ergogenico' }
  | { tipo: 'salvar' }
  | { tipo: 'refeicao' }
  | { tipo: 'salvarRefeicao'; indice: number }
  | { tipo: 'compras' };

interface Props {
  folha: FolhaDaDieta | null;
  abrir: (f: FolhaDaDieta) => void;
  fechar: () => void;
  conteudo: ConteudoDieta;
  /** Refeições da seção aberta (a variação aberta, ou a dieta toda sem variação): os índices de `alimento` e `salvarRefeicao` são dela. */
  refeicoes: Refeicao[];
  /** Alguma seção tem refeição (com variações a raiz fica vazia). */
  temRefeicao: boolean;
  /** Aplica `fn` às refeições da seção aberta dentro de uma mudança (refeição pronta entra na variação aberta). */
  naSecao: (a: ConteudoDieta, fn: (r: Refeicao[]) => Refeicao[]) => ConteudoDieta;
  /** Título do plano (lista de compras). */
  titulo: string;
  modelo: boolean;
  unica: boolean;
  nomeDoAluno: string | null;
  /** Id do plano (salvar como modelo de dieta). */
  planoId: string | undefined;
  salvar: () => Promise<boolean>;
  alimentos: Alimento[];
  suplementos: SuplementoDaBiblioteca[];
  ergogenicos: ErgogenicoDaBiblioteca[];
  mudar: (parcial: Partial<ConteudoDieta>) => void;
  mudarRefeicoes: (fn: (r: ConteudoDieta['refeicoes']) => ConteudoDieta['refeicoes']) => void;
  /** `refeicaoDaOpcao`: o "Desfazer" aparece na refeição (empilhado), perto do que mudou. */
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta, onde?: { refeicaoDaOpcao?: string }) => void;
  /** Guarda a porção da embalagem do suplemento escolhido (só referência ao escrever a dose). */
  aoPorcao: (uid: string, porcao: string) => void;
}

/**
 * As folhas do editor de dieta: "Modelos prontos" (usar modelo de dieta, acrescentar refeição pronta, salvar como modelo),
 * as escolhas da biblioteca (alimento, suplemento, ergogênico), a lista de compras e os "salvar como modelo".
 */
export function FolhasDaDieta(p: Props) {
  const { avisar } = useAviso();
  const { folha, abrir, fechar, conteudo: c } = p;
  switch (folha?.tipo) {
    case 'modelos':
      return (
        <Folha visivel titulo="Modelos prontos" aoFechar={fechar}>
          <OpcaoDeModelo titulo="Usar modelo de dieta" descricao="Troca as refeições do plano, e as variações por dia, pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer." desabilitado={p.unica} aoEscolher={() => abrir({ tipo: 'receita' })} />
          <OpcaoDeModelo titulo="Adicionar refeição pronta" descricao={c.variacoes.length ? 'Acrescenta à variação aberta as refeições de um modelo de refeição.' : 'Acrescenta ao plano as refeições de um modelo de refeição.'} desabilitado={p.unica} aoEscolher={() => abrir({ tipo: 'refeicao' })} />
          {!p.modelo && p.temRefeicao ? <OpcaoDeModelo titulo={rotuloSalvarComo('PLANO_DIETA')} descricao="Guarda as refeições, opções e itens deste rascunho para reutilizar. O plano continua igual." aoEscolher={() => abrir({ tipo: 'salvar' })} /> : null}
        </Folha>
      );
    case 'compras':
      return <FolhaListaDeCompras conteudo={c} titulo={p.titulo} aluno={p.modelo ? null : p.nomeDoAluno} aoFechar={fechar} />;
    case 'refeicao':
      return <FolhaReceitas tipo="REFEICAO" titulo="Adicionar refeição pronta" aoFechar={fechar} aoUsar={(r) => {
        fechar(); p.comDesfazer('Refeição adicionada.', (a) => p.naSecao(a, (lista) => [...lista, ...aplicarReceitaDeDieta(normalizarDieta(null), r.conteudo).refeicoes]));
      }} />;
    case 'salvarRefeicao':
      return <FolhaSalvarReceita titulo={rotuloSalvarComo('REFEICAO')} aoFechar={fechar} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'REFEICAO', nome, descricao, conteudo: { ...normalizarDieta(null), refeicoes: [p.refeicoes[folha.indice]] } });
        fechar(); avisar(avisoModeloSalvo('REFEICAO'), 'sucesso');
      }} />;
    case 'alimento':
      return (
        <FolhaAlimentos
          alimentos={p.alimentos}
          aoFechar={fechar}
          aoEscolher={(alimento) => {
            const { refeicao: ri, opcao: oi } = folha;
            fechar();
            p.mudarRefeicoes((lista) => {
              const r = lista[ri];
              const o = r?.opcoes[oi];
              if (!o) return lista;
              return substituir(lista, ri, { ...r, opcoes: substituir(r.opcoes, oi, { ...o, itens: [...o.itens, novoItem(alimento)] }) });
            });
          }}
        />
      );
    case 'trocar': {
      const r = p.refeicoes[folha.refeicao];
      const atual = r?.opcoes.flatMap((o) => o.itens).find((i) => i.uid === folha.uid);
      if (!r || !atual) return null;
      return (
        <FolhaAlimentos
          titulo="Trocar alimento"
          explicacao={`No lugar de “${atual.nome}”. A posição, a quantidade e a unidade ficam; os valores são recalculados.`}
          alimentos={p.alimentos.filter((a) => a.id !== atual.alimentoId)}
          vazio="Não há outro alimento na biblioteca para trocar. Cadastre-o na Biblioteca."
          aoFechar={fechar}
          aoEscolher={(alimento) => {
            fechar();
            // Pelo uid, na seção aberta (`naSecao`): vale também dentro de uma variação por dia.
            p.comDesfazer(`“${atual.nome}” trocado por “${alimento.nome}”.`,
              (a) => p.naSecao(a, (lista) => trocarAlimentoNasRefeicoes(lista, folha.uid, alimento)), { refeicaoDaOpcao: r.uid });
          }}
        />
      );
    }
    case 'suplemento':
      return (
        <FolhaSuplementos
          suplementos={p.suplementos}
          aoFechar={fechar}
          aoEscolher={(s) => {
            fechar();
            const linha = linhaDeSuplementacao(s, novoUid());
            const porcao = descricaoDaPorcao(s);
            if (porcao !== SEM_DADO) p.aoPorcao(linha.uid, porcao);
            p.mudar({ suplementacao: [...c.suplementacao, linha] });
          }}
        />
      );
    case 'ergogenico':
      return (
        <FolhaErgogenicos
          itens={p.ergogenicos}
          aoFechar={fechar}
          aoEscolher={(e) => {
            fechar();
            p.mudar({ ergogenicos: [...(c.ergogenicos ?? []), linhaDeErgogenico(e, novoUid())] });
          }}
        />
      );
    case 'receita':
      return (
        <FolhaReceitas
          tipo="PLANO_DIETA"
          titulo="Modelo de dieta"
          explicacao="As refeições do plano, e as variações por dia, são trocadas pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer logo depois."
          aoFechar={fechar}
          aoUsar={(r) => {
            fechar();
            p.comDesfazer(`Modelo “${r.nome}” aplicado.`, (a) => aplicarReceitaDeDieta(a, r.conteudo));
          }}
        />
      );
    case 'salvar': {
      const planoId = p.planoId;
      return planoId ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('PLANO_DIETA')}
          explicacao="Guarda as refeições, opções e itens do rascunho como modelo de dieta no Planejamento. O plano continua igual."
          aoFechar={fechar}
          aoSalvar={async (nome, descricao) => {
            if (!(await p.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('dieta', planoId, nome, descricao);
            fechar();
            avisar(avisoModeloSalvo('PLANO_DIETA'), 'sucesso');
          }}
        />
      ) : null;
    }
    default:
      return null;
  }
}

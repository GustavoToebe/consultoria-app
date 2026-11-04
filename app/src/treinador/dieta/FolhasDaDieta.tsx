import { criarReceita, salvarPlanoComoReceita } from '../../api/rotas';
import type { Alimento, ConteudoDieta, ErgogenicoDaBiblioteca, SuplementoDaBiblioteca } from '../../api/tipos';
import { aplicarReceitaDeDieta, novoItem, normalizarDieta } from '../../dominio/dieta';
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
  comDesfazer: (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => void;
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
          <OpcaoDeModelo titulo="Usar modelo de dieta" descricao="Troca as refeições do plano pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer." desabilitado={p.unica} aoEscolher={() => abrir({ tipo: 'receita' })} />
          <OpcaoDeModelo titulo="Adicionar refeição pronta" descricao="Acrescenta ao plano as refeições de um modelo de refeição." desabilitado={p.unica} aoEscolher={() => abrir({ tipo: 'refeicao' })} />
          {!p.modelo && c.refeicoes.length ? <OpcaoDeModelo titulo={rotuloSalvarComo('PLANO_DIETA')} descricao="Guarda as refeições, opções e itens deste rascunho para reutilizar. O plano continua igual." aoEscolher={() => abrir({ tipo: 'salvar' })} /> : null}
        </Folha>
      );
    case 'compras':
      return <FolhaListaDeCompras conteudo={c} titulo={p.titulo} aluno={p.modelo ? null : p.nomeDoAluno} aoFechar={fechar} />;
    case 'refeicao':
      return <FolhaReceitas tipo="REFEICAO" titulo="Adicionar refeição pronta" aoFechar={fechar} aoUsar={(r) => {
        fechar(); p.comDesfazer('Refeição adicionada.', (a) => ({ ...a, refeicoes: [...a.refeicoes, ...aplicarReceitaDeDieta(normalizarDieta(null), r.conteudo).refeicoes] }));
      }} />;
    case 'salvarRefeicao':
      return <FolhaSalvarReceita titulo={rotuloSalvarComo('REFEICAO')} aoFechar={fechar} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'REFEICAO', nome, descricao, conteudo: { ...normalizarDieta(null), refeicoes: [c.refeicoes[folha.indice]] } });
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
          explicacao="As refeições do plano são trocadas pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer logo depois."
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

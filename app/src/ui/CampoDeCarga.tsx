import type { ComponentProps } from 'react';

import { kgParaTela, mascaraDaCarga, nomeDaUnidade, telaParaKg } from '../dominio/unidadeDeCarga';
import { CampoNumericoGrande } from './Campos';
import { useUnidadeDeCarga } from './unidadeDeCargaEmUso';

type Props = Omit<ComponentProps<typeof CampoNumericoGrande>, 'valor' | 'aoMudar' | 'sufixo' | 'inteiro' | 'mascara'> & {
  /** A carga guardada, sempre em kg. */
  valorKg: number | null;
  /** Recebe kg: o que a pessoa digitou na unidade dela já convertido (em kg, o mesmo número). */
  aoMudarKg: (kg: number | null) => void;
};

/**
 * Campo de carga do aluno: mostra e recebe na unidade dele (kg ou lb) e fala kg com o resto do app. O texto do campo é o
 * mesmo número arredondado que a tela mostra (`kgParaTela`), então digitar 100 lb e ler de volta dá 100 sem o campo
 * reescrever o que a pessoa digita. `rotuloAcessivel` leva só o nome ("Peso da série 2"); a unidade por extenso entra aqui.
 */
export function CampoDeCarga({ valorKg, aoMudarKg, rotuloAcessivel, rotulo, ...resto }: Props) {
  const unidade = useUnidadeDeCarga();
  return (
    <CampoNumericoGrande
      {...resto}
      rotulo={rotulo}
      // Sem rótulo acessível próprio o leitor lê o rótulo visível ("Carga de trabalho do dia"): a unidade vale nos dois.
      rotuloAcessivel={`${rotuloAcessivel ?? rotulo}, em ${nomeDaUnidade(unidade)}`}
      sufixo={unidade}
      mascara={mascaraDaCarga(unidade)}
      valor={kgParaTela(valorKg, unidade)}
      aoMudar={(v) => aoMudarKg(telaParaKg(v, unidade))}
    />
  );
}

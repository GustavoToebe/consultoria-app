import { responsaveisEquipe } from '../../api/rotas';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

/** Treinador responsável na ficha: campo de leitura como os outros do cartão Dados ("—" sem responsável ou sem nome). */
export function ResponsavelAluno({id}:{id:string|null|undefined}) {
  const {dados,erro,recarregar}=useCarregar('responsaveis-ficha',()=>responsaveisEquipe());
  return <><CampoLeitura rotulo="Treinador responsável" valor={dados?.find(r=>r.id===id)?.nome} />{erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}</>;
}

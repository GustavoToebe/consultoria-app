import { responsaveisEquipe } from '../../api/rotas';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
export function ResponsavelAluno({id}:{id:string|null|undefined}) {
  const {dados,erro,recarregar}=useCarregar('responsaveis-ficha',()=>responsaveisEquipe());
  return <><Texto variante="pequeno">Treinador responsável</Texto><Texto>{dados?.find(r=>r.id===id)?.nome??'—'}</Texto>{erro?<MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar}/>:null}</>;
}

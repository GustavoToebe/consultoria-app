import { useEffect, useState } from 'react';
import type { Atualizacao } from '../../api/tipos';
import { useAluno } from '../../offline/AlunoProvider';
import { useAviso } from '../../ui/Aviso';
import { lembretePodeAbrir } from '../../dominio/boasVindas';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { useBoasVindas } from '../SituacaoDasBoasVindas';
import { dispensarExplicacaoLembrete, permitirLembretesAtualizacao, precisaExplicacaoLembrete } from './lembretes';

export function PermissaoLembrete({atualizacao}: {atualizacao:Atualizacao}) {
  const {repositorio}=useAluno();
  const [precisa,setPrecisa]=useState(false);
  const {situacao:boasVindas}=useBoasVindas();
  // O aparelho pode já ter dito que precisa perguntar, mas as boas-vindas vêm primeiro.
  const visivel=precisa && lembretePodeAbrir(boasVindas);
  const [ocupado,setOcupado]=useState(false);
  const {avisar}=useAviso();
  useEffect(()=>{
    let vivo=true;
    precisaExplicacaoLembrete(repositorio.usuarioId).then(devePerguntar=>{if(vivo)setPrecisa(devePerguntar);}).catch(()=>undefined);
    return()=>{vivo=false;};
  },[repositorio.usuarioId]);
  const dispensar=()=>{setPrecisa(false);void dispensarExplicacaoLembrete(repositorio.usuarioId).catch(()=>undefined);};
  const permitir=async()=>{
    setOcupado(true);
    try {
      const concedida=await permitirLembretesAtualizacao(repositorio.usuarioId,atualizacao);
      setPrecisa(false);
      if(!concedida)avisar('Você pode liberar os lembretes nas configurações do aparelho.');
    }catch{avisar('Não foi possível ativar o lembrete neste aparelho.','perigo');}finally{setOcupado(false);}
  };
  return <PainelConfirmacao visivel={visivel} titulo="Quer um lembrete no dia da atualização?"
    mensagem="O aparelho pode lembrar três dias antes, no dia e no dia seguinte se você ainda não tiver enviado. Funciona sem internet."
    rotuloConfirmar="Ativar lembretes" rotuloCancelar="Agora não" carregando={ocupado}
    aoConfirmar={()=>void permitir()} aoCancelar={dispensar} />;
}

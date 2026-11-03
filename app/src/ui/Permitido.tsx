import type { ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { useSessao } from '../sessao/SessaoProvider';
import { moduloDesligadoDaTela, podeAcessarTela } from '../dominio/permissoes';
import { ModuloDesligado, SemPermissao } from './Estados';
import { Tela } from './Tela';

export function Permitido({codigo,children}:{codigo:string;children:ReactNode}) {
  const {pode}=useSessao();return pode(codigo)?<>{children}</>:null;
}
/** Não monta a tela nem suas buscas quando falta permissão. A proteção de dados continua na API. */
export function GuardaDePermissao({children}:{children:ReactNode}) {
  const caminho=usePathname();const {pode,pagamentosHabilitados,perfilEquipe}=useSessao();
  if(!podeAcessarTela(caminho,pode,pagamentosHabilitados,!!perfilEquipe?.acessoTotal)) {
    const inicio = caminho.startsWith('/aluno') ? '/aluno' : '/treinador';
    const acao = { rotulo: 'Voltar ao início', aoTocar: () => router.replace(inicio) };
    // Módulo desligado ganha da permissão: ninguém, nem o administrador, abriria a tela pedindo acesso (C4).
    const desligado = moduloDesligadoDaTela(caminho, pagamentosHabilitados);
    return <Tela>{desligado ? <ModuloDesligado {...desligado} acao={acao} /> : <SemPermissao acao={acao} />}</Tela>;
  }
  return <>{children}</>;
}

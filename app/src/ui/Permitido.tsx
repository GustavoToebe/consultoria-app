import type { ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { useSessao } from '../sessao/SessaoProvider';
import { podeAcessarTela } from '../dominio/permissoes';
import { SemPermissao } from './Estados';
import { Tela } from './Tela';

export function Permitido({codigo,children}:{codigo:string;children:ReactNode}) {
  const {pode}=useSessao();return pode(codigo)?<>{children}</>:null;
}
/** Não monta a tela nem suas buscas quando falta permissão. A proteção de dados continua na API. */
export function GuardaDePermissao({children}:{children:ReactNode}) {
  const caminho=usePathname();const {pode}=useSessao();
  if(!podeAcessarTela(caminho,pode)) {
    const inicio = caminho.startsWith('/aluno') ? '/aluno' : '/treinador';
    return <Tela><SemPermissao acao={{ rotulo: 'Voltar ao início', aoTocar: () => router.replace(inicio) }} /></Tela>;
  }
  return <>{children}</>;
}

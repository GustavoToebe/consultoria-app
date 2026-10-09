import type { ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useSessao } from '../sessao/SessaoProvider';
import { podeAcessarTela } from '../dominio/permissoes';
import { Tela } from './Tela';
import { Texto } from './Texto';

export function Permitido({codigo,children}:{codigo:string;children:ReactNode}) {
  const {pode}=useSessao();return pode(codigo)?<>{children}</>:null;
}
/** Não monta a tela nem suas buscas quando falta permissão. A proteção de dados continua na API. */
export function GuardaDePermissao({children}:{children:ReactNode}) {
  const caminho=usePathname();const {pode}=useSessao();
  if(!podeAcessarTela(caminho,pode)) return <Tela><Texto>Seu perfil não permite acessar esta tela.</Texto></Tela>;
  return <>{children}</>;
}

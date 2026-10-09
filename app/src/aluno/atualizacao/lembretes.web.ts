import type { Atualizacao } from '../../api/tipos';
/** A web só mostra o cartão e o ponto na aba, sem pedir permissão do navegador. */
export function iniciarLembretesAtualizacao(_usuarioId:string) { }
export async function cancelarLembretesAtualizacao(_usuarioId:string) { }
export async function reagendarLembretesAtualizacao(_usuarioId:string,_atualizacao:Atualizacao|null) { }
export async function precisaExplicacaoLembrete(_usuarioId:string) {return false;}
export async function dispensarExplicacaoLembrete(_usuarioId:string) { }
export async function permitirLembretesAtualizacao(_usuarioId:string,_atualizacao:Atualizacao) {return false;}

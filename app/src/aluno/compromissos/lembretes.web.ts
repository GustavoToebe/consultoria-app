import type { CompromissoDoAluno } from '../../api/agendaTipos';
/** A web só mostra o aviso dentro do app (D12), sem pedir permissão do navegador. */
export function iniciarLembretesDeCompromisso(_usuarioId:string) { }
export async function encerrarLembretesDeCompromisso(_usuarioId:string) { }
export async function desligarLembretesDeCompromisso(_usuarioId:string) { }
export async function reagendarLembretesDeCompromisso(_usuarioId:string,_compromissos:readonly CompromissoDoAluno[]|null) { }
export async function lembretesDeCompromissoPermitidos():Promise<boolean|null> {return null;}
export async function pedirPermissaoDeLembretesDeCompromisso():Promise<'concedida'|'negada'|'indisponivel'> {return 'indisponivel';}

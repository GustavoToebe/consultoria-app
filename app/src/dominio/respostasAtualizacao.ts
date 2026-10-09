import type { ModeloAtualizacao, RespostasAtualizacao } from '../api/tipos';

/** Validação para marcar o campo; o servidor sempre valida novamente contra sua versão. */
export function errosRespostasAtualizacao(modelo: ModeloAtualizacao, respostas: RespostasAtualizacao) {
  const erros: Record<string,string> = {};
  const bytes = Array.from(JSON.stringify(respostas)).reduce((total,c) => {
    const codigo=c.codePointAt(0)??0;
    return total+(codigo<128?1:codigo<2048?2:codigo<65536?3:4);
  },0);
  if (bytes > 65536) erros.respostas = 'As respostas ultrapassam o limite de 64 KiB.';
  const nota = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;
  for (const p of modelo.secoes.flatMap(s=>s.perguntas)) {
    if (p.tipo==='FOTOS' || p.tipo==='DATA_AUTOMATICA') continue;
    const v=respostas[p.id];
    if (v==null || (typeof v==='string' && v.trim()==='')) { if (p.obrigatoria) erros[p.id]='Preencha este campo.'; continue; }
    const valido=p.tipo==='NOTA' ? nota(v) : p.tipo==='PESO'
      ? typeof v==='number' && Number.isFinite(v) && v>=20 && v<=400 && Math.abs(v*10-Math.round(v*10))<1e-8
      : p.tipo==='NOTAS_POR_DIA' ? typeof v==='object' && !Array.isArray(v) && Object.entries(v).every(([d,n])=>(p.dias??[]).includes(Number(d)) && (n==null || nota(n)))
      : typeof v==='string' && v.length<=(p.tipo==='TEXTO'?500:2000);
    if (!valido) erros[p.id]='Confira o formato e os limites deste campo.';
  }
  return erros;
}

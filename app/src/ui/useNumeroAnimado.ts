import { useEffect, useRef, useState } from 'react';
import { interpolarNumero } from '../dominio/numeroAnimado';
import { useMovimentoReduzido } from './useMovimentoReduzido';
export function useNumeroAnimado(valor: number | null, { duracao = 300, casas = 0 }: { duracao?: number; casas?: number } = {}) {
 const reduzido = useMovimentoReduzido();
 const [visual, definir] = useState(valor);
 const atual = useRef(valor);
 useEffect(() => {
  const anterior = atual.current;
  const inicio = Date.now();
  let quadro: number;
  const atualizar = () => {
   const passo = reduzido || valor === null || anterior === null || duracao <= 0 ? 1 : (Date.now() - inicio) / duracao;
   const novo = interpolarNumero(anterior, valor, passo, casas);
   atual.current = novo;
   definir(novo);
   if (passo < 1) quadro = requestAnimationFrame(atualizar);
  };
  quadro = requestAnimationFrame(atualizar);
  return () => cancelAnimationFrame(quadro);
 }, [valor, duracao, casas, reduzido]);
 return reduzido || valor === null ? valor : visual;
}

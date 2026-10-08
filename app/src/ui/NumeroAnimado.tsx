import type { ComponentProps } from 'react';
import { numeroParaTela } from '../dominio/formatos';
import { Texto } from './Texto';
import { useNumeroAnimado } from './useNumeroAnimado';
export function NumeroAnimado({ valor, casas = 0, sufixo = '', ...props }: Omit<ComponentProps<typeof Texto>, 'children'> & { valor: number | null; casas?: number; sufixo?: string }) {
 const visual = useNumeroAnimado(valor, {casas});
 return <Texto {...props} numerico>{visual === null ? '—' : numeroParaTela(visual, casas)}{sufixo}</Texto>;
}

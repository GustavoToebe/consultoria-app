import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import type { Configuracao, ExercicioPlano } from '../../api/tipos';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import type { TipoSelo } from '../../ui/Selo';
import { cargaPendente, FALTA_A_CARGA } from './cargaDaSerie';

export interface EstadoDoExercicio {
  tipo: TipoSelo;
  texto: string;
  Icone: LucideIcon;
}

/**
 * Selo do exercício (faixa do cartão e item da lista): "Pronto" (verde), avisos ou "Falta a carga" (âmbar) ou problemas (vermelho), pela
 * validação da publicação. Exercício sem série diz isso em vez de contar o problema.
 */
export function estadoDoExercicio(e: ExercicioPlano, config: Configuracao | null): EstadoDoExercicio {
  const r = validarExercicio(e, config);
  if (e.series.length === 0) return { tipo: 'perigo', texto: e.modalidade === 'CARDIO' ? 'Sem prescrição' : 'Sem séries', Icone: CircleAlert };
  if (r.erros.some((p) => !cargaPendente(e, p.caminho))) return { tipo: 'perigo', texto: r.erros.length === 1 ? '1 problema a corrigir' : `${r.erros.length} problemas a corrigir`, Icone: CircleAlert };
  // Só falta preencher a carga: pendência em âmbar (guia premium págs. 4 e 9); continua impedindo publicar.
  if (r.erros.length) return { tipo: 'atencao', texto: FALTA_A_CARGA, Icone: TriangleAlert };
  if (r.avisos.length) return { tipo: 'atencao', texto: r.avisos.length === 1 ? '1 aviso' : `${r.avisos.length} avisos`, Icone: TriangleAlert };
  return { tipo: 'sucesso', texto: 'Pronto', Icone: CircleCheck };
}

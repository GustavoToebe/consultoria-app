import type { RespostaAtualizacao } from '../api/tipos';
import { LIMITES_QUESTIONARIO, maximoDeFotos } from './questionario';

/**
 * Fotos da atualização: regras puras (sem câmera, arquivo nem rede). Os limites do servidor valem de qualquer forma;
 * aqui o app só evita mandar o que seria recusado.
 */
export const LIMITES_FOTO = {
  /** Maior lado da foto depois de reduzida. */
  ladoMaximo: 1600,
  /** O mesmo teto do servidor (cabe no corpo de 1 MiB junto do restante da requisição). */
  bytesMaximo: 1_000_000,
} as const;

export const TEXTO_FOTOS_INDISPONIVEIS = 'Fotos ainda não disponíveis.';
export const TEXTO_FOTOS_SEM_CONEXAO = 'Conecte-se à internet para anexar fotos.';

/** Tentativas de reduzir a foto até caber em `bytesMaximo`: da melhor para a pior qualidade, nunca ampliando. */
export interface Reducao { lado: number; qualidade: number }

const LADOS = [LIMITES_FOTO.ladoMaximo, 1200, 900, 640];
const QUALIDADES = [0.85, 0.7, 0.55];

/** `lados`: do maior para o menor (a foto de perfil usa os dela, menores). */
export function reducoesDeFoto(largura: number, altura: number, lados: readonly number[] = LADOS): Reducao[] {
  const maior = Math.max(largura, altura);
  // Foto já pequena: o primeiro lado é o dela mesma (só reencoda, o que tira o EXIF).
  const ladosUsados = [...new Set(lados.map((l) => Math.min(l, maior)))].filter((l) => l > 0);
  const tentativas: Reducao[] = [];
  for (const lado of ladosUsados) for (const qualidade of QUALIDADES) tentativas.push({ lado, qualidade });
  return tentativas;
}

/** Ação de redimensionar para o maior lado ficar em `lado` (a outra medida acompanha); `null` se já cabe. */
export function redimensionamento(largura: number, altura: number, lado: number): { width: number } | { height: number } | null {
  if (!(largura > 0) || !(altura > 0) || Math.max(largura, altura) <= lado) return null;
  return largura >= altura ? { width: lado } : { height: lado };
}

/** Ids de fotos enviadas guardados na resposta de uma pergunta FOTOS (qualquer outra coisa vira lista vazia). */
export function idsDeFotos(valor: RespostaAtualizacao | undefined): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

/** Quantas fotos a pergunta ainda aceita (já enviadas + ainda no aparelho contam juntas). */
export function vagasDeFoto(enviadas: number, locais: number, maximo: number = LIMITES_QUESTIONARIO.fotosPorPergunta) {
  return Math.max(0, maximo - enviadas - locais);
}

/**
 * Fotos que a pergunta aceita no aparelho: o `max` dela (`maximoDeFotos`, a mesma regra da validação), nunca acima
 * do teto que o servidor informou. Cada pergunta FOTOS tem o seu (frente, costas e lado com uma foto cada, por exemplo).
 */
export function fotosAceitas(maxDaPergunta: number | undefined, tetoDoServidor: number = LIMITES_QUESTIONARIO.fotosPorPergunta) {
  return Math.max(1, Math.min(maximoDeFotos({ max: maxDaPergunta }), tetoDoServidor));
}

export function contagemDeFotos(total: number, maximo: number) {
  return `${total} de ${maximo} ${maximo === 1 ? 'foto' : 'fotos'}`;
}

/** Guarda ou tira um nome de arquivo local de uma pergunta, sem mexer nas outras. */
export function comFotoLocal(mapa: Record<string, string[]> | undefined, perguntaId: string, nome: string) {
  return { ...mapa, [perguntaId]: [...(mapa?.[perguntaId] ?? []), nome] };
}

export function semFotoLocal(mapa: Record<string, string[]> | undefined, perguntaId: string, nome: string) {
  const resto = (mapa?.[perguntaId] ?? []).filter((n) => n !== nome);
  const novo = { ...mapa };
  if (resto.length) novo[perguntaId] = resto;
  else delete novo[perguntaId];
  return novo;
}

/** Todos os nomes locais do rascunho, para apagar os arquivos. */
export const todasAsFotosLocais = (mapa: Record<string, string[]> | undefined) => Object.values(mapa ?? {}).flat();

/** Texto do erro do envio de foto, no tom do app (a API manda mensagens próprias para os casos que ela conhece). */
export const MENSAGEM_FOTO_NAO_LIDA = 'Não foi possível ler esta foto. Escolha outra.';
export const MENSAGEM_FOTO_GRANDE = 'Esta foto ficou grande demais mesmo depois de reduzida. Escolha outra.';

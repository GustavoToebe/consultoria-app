import { asyncStorage, type ChaveValor } from './armazenamento';
import { abrirRepositorio } from './abrirRepositorio';
import type { RepositorioLocal } from './repositorioLocal';
import { novoUid } from '../dominio/uid';

/**
 * Quem tem fila retida neste aparelho (ids de usuário, sem mais nada). Cada repositório guarda a própria marca com a
 * data; esta lista só diz **quais** abrir para conferir o prazo, porque nenhum deles se abre sozinho: a fila de um
 * usuário que não volta nunca seria apagada. Fica fora do prefixo de qualquer usuário (nada a apaga ao sair).
 */
export const CHAVE_FILAS_RETIDAS = 'treinos:filasRetidas';

interface Dependencias {
  kv?: ChaveValor;
  abrir?: (usuarioId: string) => RepositorioLocal;
  /** Quem acabou de entrar: o `AlunoProvider` dele cuida da própria fila (prazo e retomada), a varredura não mexe. */
  exceto?: string;
}

async function ler(kv: ChaveValor): Promise<string[]> {
  try {
    const texto = await kv.ler(CHAVE_FILAS_RETIDAS);
    const lista: unknown = texto ? JSON.parse(texto) : [];
    return Array.isArray(lista) ? lista.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function gravar(kv: ChaveValor, ids: string[]): Promise<void> {
  if (ids.length) await kv.gravar(CHAVE_FILAS_RETIDAS, JSON.stringify(ids));
  else await kv.apagar([CHAVE_FILAS_RETIDAS]);
}

/** Anota que este usuário deixou fila retida no aparelho (chamado depois de `reterSoAFila`). */
export async function registrarFilaRetida(usuarioId: string, { kv = asyncStorage }: Dependencias = {}): Promise<void> {
  const ids = await ler(kv);
  if (!ids.includes(usuarioId)) await gravar(kv, [...ids, usuarioId]);
}

/**
 * Confere o prazo de todas as filas retidas do aparelho e apaga as vencidas, de qualquer usuário. Nunca envia nada: o
 * envio é só do `Sincronizador` do usuário que está com sessão. Quem já não tem fila (vencida, retomada ou apagada)
 * sai da lista. Falha em um usuário não impede os outros. Devolve quantas filas apagou.
 */
export async function varrerFilasRetidas({ kv = asyncStorage, abrir, exceto }: Dependencias = {}): Promise<number> {
  const abrirDe = abrir ?? ((id: string) => abrirRepositorio(id, novoUid));
  const ids = await ler(kv);
  let apagadas = 0;
  const seguem: string[] = [];
  for (const id of ids) {
    if (id === exceto) {
      seguem.push(id);
      continue;
    }
    const repositorio = abrirDe(id);
    try {
      const situacao = await repositorio.descartarFilaRetidaVencida();
      if (situacao === 'vencida') apagadas++;
      if (situacao === 'retida') seguem.push(id);
    } catch {
      seguem.push(id);
    } finally {
      await repositorio.fechar().catch(() => undefined);
    }
  }
  // Relê antes de gravar: uma recusa que chegou durante a varredura não pode ser desfeita por ela.
  const atuais = await ler(kv);
  const novos = atuais.filter((id) => !ids.includes(id) || seguem.includes(id));
  if (novos.length !== atuais.length) await gravar(kv, novos);
  return apagadas;
}

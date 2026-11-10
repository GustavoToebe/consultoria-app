import type { Papel } from '../api/tipos';

/**
 * Entrada de cada público (`/aluno/entrar`, `/treinador/entrar`; plano `docs/planos/entrada-por-publico.md`). O endereço
 * só diz qual área a pessoa quer: o papel vem do login, e nada aqui vai à API.
 */
export type EntradaDoPublico = '/aluno/entrar' | '/treinador/entrar';

export interface TextosDaEntrada {
  titulo: string;
  subtitulo: string;
  /** "Primeiro acesso": o convite de cada público abre pelo link recebido ou pelo código digitado na própria tela. */
  convite: { href: '/convite' | '/convite-equipe'; texto: string };
  /** A entrada do outro público, com menos destaque que o "Entrar". */
  outra: { href: EntradaDoPublico; texto: string };
}

export const TEXTOS_DA_ENTRADA: Readonly<Record<Papel, TextosDaEntrada>> = {
  ALUNO: {
    titulo: 'Entre na sua área de aluno',
    subtitulo: 'Acesse seus treinos, alimentação e acompanhamento.',
    convite: { href: '/convite', texto: 'Primeiro acesso? Ativar convite' },
    outra: { href: '/treinador/entrar', texto: 'É treinador? Acessar painel da consultoria' },
  },
  TREINADOR: {
    titulo: 'Acesse sua consultoria',
    subtitulo: 'Organize planejamentos e acompanhe seus alunos.',
    convite: { href: '/convite-equipe', texto: 'Primeiro acesso? Ativar convite' },
    outra: { href: '/aluno/entrar', texto: 'É aluno? Acessar minha área' },
  },
};

/** Entrada do público do papel (a guarda da área e o "Sair" levam a ela). */
export function entradaDoPublico(papel: Papel): EntradaDoPublico {
  return papel === 'TREINADOR' ? '/treinador/entrar' : '/aluno/entrar';
}

/**
 * Depois de autenticar por uma entrada que não é a do papel da conta: o aviso que orienta (a área certa abre pelo papel
 * que o servidor devolveu). Antes do login nada distingue as contas: o erro de credencial é o mesmo nas duas entradas.
 */
export function avisoDeEntradaErrada(publico: Papel, papelDaConta: Papel): string | null {
  if (publico === papelDaConta) return null;
  return papelDaConta === 'TREINADOR'
    ? 'Sua conta é do painel da consultoria. Abrimos a área certa.'
    : 'Sua conta é da área do aluno. Abrimos a área certa.';
}

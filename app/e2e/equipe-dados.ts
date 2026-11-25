import type { Page } from '@playwright/test';

import type { MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import { CATALOGO_DE_EXEMPLO } from '../src/dominio/catalogoDePermissoes.exemplo';
import { fixarHoje } from './aluno';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/** Dados fictícios da Equipe na tela larga (`equipe-tela-larga.spec.ts` e as capturas `zz-equipe-capturas.spec.ts`). Hoje fixo em 19/10/2026. */
export const PERMISSOES = [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'USUARIO_ALTERAR', 'PERFIL_ALTERAR'];

export const PERFIS: PerfilEquipe[] = [
  { id: 'p-adm', nome: 'Administrador', descricao: null, acessoTotal: true, sistema: true, ativo: true, permissoes: [], usuarios: 1, versao: 1 },
  { id: 'p-tre', nome: 'Treinador', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER', 'ALUNO_LER'], usuarios: 2, versao: 1 },
  { id: 'p-nut', nome: 'Nutricionista', descricao: 'Monta e ajusta as dietas, revisa as atualizações e responde às anamneses; só lê os alunos e os treinos, sem alterar nada deles. Perfil de exemplo com descrição longa.', acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER', 'ALUNO_LER'], usuarios: 1, versao: 1 },
  { id: 'p-ass', nome: 'Assistente', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: ['PAINEL_VER'], usuarios: 0, versao: 1 },
];

const membro = (id: string, nome: string, perfil: PerfilEquipe, extra: Partial<MembroEquipe> = {}): MembroEquipe => ({
  id, nome, email: `${id}@exemplo.test`, perfilId: perfil.id, perfilNome: perfil.nome, ativo: true, convitePendente: false,
  conviteExpiraEm: null, ultimoAcesso: '2026-10-18T13:00:00Z', limiteDeAlunos: null, ...extra,
});
export const MEMBROS: MembroEquipe[] = [
  membro('m-ana', 'Ana Fictícia', PERFIS[0]),
  membro('m-bia', 'Bia Exemplo', PERFIS[1], { limiteDeAlunos: 30 }),
  membro('m-caio', 'Caio Teste', PERFIS[1], { ativo: false }),
  membro('m-dani', 'Dani Modelo', PERFIS[2]),
];
/** Enviado em 17/10 (vale 7 dias): "há 2 dias" no hoje fixo. */
export const CONVITE = membro('c-eva', 'Eva Amostra', PERFIS[1], { convitePendente: true, conviteExpiraEm: '2026-10-24T15:00:00Z', ultimoAcesso: null });

export async function prepararEquipe(page: Page, largura: number, altura: number, membros: MembroEquipe[], tema = 'ESCURO') {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, prefs);
    } catch { /* quadro sem armazenamento */ }
  }, [TREINADOR.id, JSON.stringify({ tema, larguraConteudo: 'AUTOMATICA' })] as const);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, perfil: { id: 'p-adm', nome: 'Administrador', acessoTotal: true } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /usuarios': { corpo: membros },
    'GET /perfis': { corpo: PERFIS },
    'GET /permissoes/catalogo': { corpo: CATALOGO_DE_EXEMPLO },
    'DELETE /usuarios/convites/{id}': { status: 204 },
  });
}


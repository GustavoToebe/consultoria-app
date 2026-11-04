import { createContext, useContext } from 'react';

import type { UnidadeDeCarga } from '../dominio/unidadeDeCarga';

/**
 * Unidade em que a carga aparece e é digitada. Fica num contexto (padrão kg) como `emPrevia`: só o layout do aluno a
 * provê (`ProvedorDaUnidadeDeCarga`), então o treinador, a prévia "Ver como aluno" e os testes seguem em kg sem tocar em nada.
 */
export const ContextoDaUnidadeDeCarga = createContext<UnidadeDeCarga>('kg');

export const useUnidadeDeCarga = (): UnidadeDeCarga => useContext(ContextoDaUnidadeDeCarga);

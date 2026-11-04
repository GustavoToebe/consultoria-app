import { createContext, useContext } from 'react';

import type { UnidadeDeCarga } from '../dominio/unidadeDeCarga';

/**
 * Unidade em que a carga aparece e é digitada. Fica num contexto (padrão kg) como `emPrevia`: os layouts do aluno e do
 * treinador a proveem (`ProvedorDaUnidadeDeCarga`, cada um com a escolha de quem vê); os testes que não a provêm seguem em kg.
 */
export const ContextoDaUnidadeDeCarga = createContext<UnidadeDeCarga>('kg');

export const useUnidadeDeCarga = (): UnidadeDeCarga => useContext(ContextoDaUnidadeDeCarga);

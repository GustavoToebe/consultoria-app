import { emailValido, telefoneValido } from '@plataforma/web';
import { numeroDoWhatsApp } from './lembretesDeCobranca';

/**
 * Contato da consultoria (N1 de `docs/planos/contato-da-consultoria.md`): os três campos do bloco "Contato" da Marca e o
 * link de "Falar com o treinador" do aluno. A validação do WhatsApp e do nome espelha `MarcaService.conferirContato` (422
 * `MARCA_INVALIDA`; o nome, a regra da biblioteca `EnviadorDeEmail.nomeValido`): mudou uma, mude a outra. O e-mail de resposta
 * não espelha: a API é mais estrita e o 422 dela cai no campo. As mensagens nunca repetem o valor digitado.
 */

export const NOME_DO_REMETENTE_MAXIMO = 60;
export const RESPONDER_PARA_MAXIMO = 254;

/** O que o bloco "Contato" guarda enquanto a pessoa digita (vazio = sem; o `PUT` manda os três sempre, em branco apaga). */
export interface ContatoDaConsultoria {
  whatsapp: string;
  emailRemetenteNome: string;
  emailResponderPara: string;
}

// Controle, `<`, `>`, aspas, barra invertida, os separadores de linha e de parágrafo (U+2028 e U+2029) e a categoria de formatação
// do Unicode (\p{Cf}: bidi, largura zero, BOM): o que o cabeçalho do e-mail não aceita (mesmo conjunto da biblioteca).
const PROIBIDO_NO_NOME = /[\u0000-\u001f\u007f-\u009f<>"\\\u2028\u2029\p{Cf}]/u;

/** Erros por campo, com as chaves do `fieldErrors` da API (`whatsapp`, `emailRemetenteNome`, `emailResponderPara`). Vazio = pode salvar. */
export function problemasDoContato(c: ContatoDaConsultoria): Record<string, string> {
  const erros: Record<string, string> = {};
  const whatsapp = c.whatsapp.trim();
  if (whatsapp && !telefoneValido(whatsapp)) erros.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (45) 99999-8888.';
  const nome = c.emailRemetenteNome.trim();
  if (nome && ([...nome].length > NOME_DO_REMETENTE_MAXIMO || PROIBIDO_NO_NOME.test(nome)))
    erros.emailRemetenteNome = `O nome do remetente pode ter até ${NOME_DO_REMETENTE_MAXIMO} caracteres, sem aspas, barra invertida, < nem >.`;
  // O `emailValido` do `@plataforma/web` é mais permissivo que o da API (que também recusa controle e formatação): o 422 da API cai neste campo.
  const responder = c.emailResponderPara.trim();
  if (responder && (responder.length > RESPONDER_PARA_MAXIMO || !emailValido(responder))) erros.emailResponderPara = 'E-mail inválido.';
  return erros;
}

/**
 * "Falar com o treinador" (C3): `https://wa.me/55<número>`, aberto fora do app, sem token e sem texto pronto. O número vem
 * do `GET /eu` do aluno (`whatsappDaConsultoria`, só dígitos). `null` = a consultoria não tem número: o botão não aparece.
 */
export function linkParaFalarComOTreinador(whatsappDaConsultoria: string | null | undefined): string | null {
  const numero = numeroDoWhatsApp(whatsappDaConsultoria);
  return numero ? `https://wa.me/${numero}` : null;
}

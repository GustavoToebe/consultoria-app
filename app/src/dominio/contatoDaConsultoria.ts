import { emailValido, telefoneValido } from '@plataforma/web';
import { numeroDoWhatsApp } from './lembretesDeCobranca';

/**
 * Contato da consultoria (N1 de `docs/planos/contato-da-consultoria.md`): os três campos do bloco "Contato" da Marca e o
 * link de "Falar com o treinador" do aluno. A validação espelha `MarcaService.conferirContato` (422 `MARCA_INVALIDA`):
 * mudou uma, mude a outra. As mensagens nunca repetem o valor digitado.
 */

export const NOME_DO_REMETENTE_MAXIMO = 60;
export const RESPONDER_PARA_MAXIMO = 254;

/** O que o bloco "Contato" guarda enquanto a pessoa digita (vazio = sem; o `PUT` manda os três sempre, em branco apaga). */
export interface ContatoDaConsultoria {
  whatsapp: string;
  emailRemetenteNome: string;
  emailResponderPara: string;
}

// Controle, `<`, `>`, aspas e os separadores de linha e de parágrafo (0x2028 e 0x2029): o que o cabeçalho do e-mail não aceita.
const PROIBIDO_NO_NOME = new RegExp('[\\x00-\\x1f\\x7f-\\x9f<>"' + String.fromCharCode(0x2028, 0x2029) + ']');

/** Erros por campo, com as chaves do `fieldErrors` da API (`whatsapp`, `emailRemetenteNome`, `emailResponderPara`). Vazio = pode salvar. */
export function problemasDoContato(c: ContatoDaConsultoria): Record<string, string> {
  const erros: Record<string, string> = {};
  const whatsapp = c.whatsapp.trim();
  if (whatsapp && !telefoneValido(whatsapp)) erros.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (45) 99999-8888.';
  const nome = c.emailRemetenteNome.trim();
  if (nome && ([...nome].length > NOME_DO_REMETENTE_MAXIMO || PROIBIDO_NO_NOME.test(nome)))
    erros.emailRemetenteNome = `O nome do remetente pode ter até ${NOME_DO_REMETENTE_MAXIMO} caracteres, sem aspas, < nem >.`;
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

# Fila depois de 01/12

Tudo que o Gustavo mandou entre 27 e 29/11 e que, pelo **plano até 30/11 12h** (congelamento), fica para depois da entrada do primeiro cliente real. Nada daqui entra nas levas 2, 3 e 4, exceto o que o plano autoriza antes de 01/12 (ver "O que entra antes", no fim).

Atualizado em 29/11/2026. Estado local, sem commit. Cada item tem origem e o que falta; antes de começar um, conferir se a decisão continua valendo.

## Telas

| Item | O que falta | Origem |
|---|---|---|
| Recebimento (layout) | Redesenho completo (duas colunas a partir de 1600 px, uma linha por forma, prévia do celular, rodapé único). Está pronto como patch só do layout (`recebimento-redesenho-layout.patch`, 20 arquivos incluindo os specs, mais a pasta `recebimento-redesenho-arquivos` e o `README-recebimento-redesenho.md` com o modo de reaplicar), guardado fora do git em `C:\Users\gusta\Documents\pos-01-12-patches\` (junto com `novos5.mjs`, os 12 textos da Ajuda, e `seletores-antigos.md`); só o item 0 (campo de chave que o Chrome não preenche) vai antes de 01/12. | Gustavo, 28/11 |
| Contato, Marca, Lembretes, Ajuda, Conta, Histórico, Termos (layout) | Os pedidos de tela de 27 e 28/11 à noite que ainda não passaram por render e e2e. As entregas já feitas dos agentes na leva 3 seguem lá, sujeitas à verificação; o que não estiver pronto vem para esta fila. | Plano 28/11 |
| Seletores antigos "Rótulo: valor ⌄" (~45) | Frente própria depois de 01/12: trocar por `ui/EscolhaSuspensa`. Antes só os das telas já tocadas. Lista em `docs/planos/README.md` (Pendências soltas) e no relatório da pasta de 27/11. | Gustavo, 28/11 |
| Painéis de filtro parciais | Biblioteca, Catálogo, Mural, Vídeos, Registros e Progresso mantêm "Aplicar filtros"; aplicar a regra única (chips, De/Até, rodapé Limpar/Cancelar/Mostrar N). | Gustavo, 28/11 |
| Violações da regra 17 (Escolha) | `PreviaDoEmail` (resolvido nos Lembretes), `LateralDosMembros`, `PreviaDaSemana`, `ciclo.tsx` (sintomas): escolha única = `ui/Escolha`; múltipla = chips com `aria-pressed`. | Gustavo, 28/11 |
| Ajuda: textos defasados | Frases que ainda descrevem a tela antiga (Lembretes, Meta do peso, Configurações, Conta, Histórico e Corpo, Dieta, Filtros) e os 12 textos prontos (`scratchpad/novos5.mjs`). | Agente da Ajuda, 28/11; Gustavo, 29/11 |
| Ajuda: itens longos | 11 itens longos a dividir. | Agente da Ajuda |
| Bloco G | Restante do editor de questionário (lista + inspetor com arrastar, "Instruções" no cartão Sobre, campos). | README, Pendências soltas |
| Docs velhos | Textos de docs que ainda citam padrões antigos de chaves (`integracao-central.md`, `pagamentos-infinitepay.md`, `importacao-assistida-ia.md`, `revisao-das-flags-23-11.md`). | Agente das chaves, 28/11 |
| Contratos: duplicar modelo e "uso" | Duplicar e ver onde o modelo é usado. | Gustavo, 28/11 |

## Financeiro e lembretes

| Item | O que falta | Origem |
|---|---|---|
| "Próximos envios" dos Lembretes | Rota `GET /financeiro/lembretes/proximos?dias=7` calculada no servidor (hoje nenhuma rota diz em lote quem desligou lembretes, V041, se o contrato está ativo e qual cobrança leva o e-mail do dia, `LembretesRepositorio.candidatas`). O cartão não aparece até lá. | Agente dos Lembretes, 28/11 |
| Lembrete do e-mail: miniatura da marca | `treinador/marca/MiniaturasDaMarca.tsx` (linha ~139) ainda diz "Veja a cobrança no app, na sua Conta"; trocar pela frase nova "Abra o app para ver como pagar". | Agente dos Lembretes |
| Logo no e-mail e proxy do Gmail | A rota pública da logo permite 300 por IP; conferir se `getRemoteAddr` enxerga o IP real atrás do proxy de produção. | Agente dos Lembretes |
| Troca de e-mail da equipe | Fluxo de troca do e-mail de entrada para a equipe (admin hoje fala com o suporte). | Gustavo, 28/11 |
| E-mail de convite ao aluno | Só depois de `TREINOS_EMAIL_HABILITADO` + Resend configurado; hoje o convite em lote é por link e WhatsApp. | Gustavo, 29/11 |

## Planejamento, regras e ciclo

| Item | O que falta | Origem |
|---|---|---|
| Lembrete diário do ciclo (push) | Plano completo em [lembrete-diario-do-ciclo.md](lembrete-diario-do-ciclo.md) (V198 provisória, rotina das 20:00, `GET\|PUT /aluno/preferencias-de-push`, interruptor). Decisão aberta L7: não auditar a mudança da preferência. | Gustavo, 28/11 (congelado) |
| Prévia das 4 semanas e links das exceções (regras de atenção) | Itens de API dos Regras. | Gustavo, 28/11 |

## Importação

| Item | O que falta | Origem |
|---|---|---|
| Leva 4, se não subir antes de 30/11 10h | Tudo da importação assistida (trava de "Gravar", "Juntar as N partes", origem do nome). Só sobe com `mvn verify` e e2e verdes. | Plano 28/11 |

## O que entra antes de 01/12 (não é fila)

Do bloco D, só estes defeitos: foco do teclado escondido sob rodapé fixo, contorno do campo de Regras a 3:1, botão de suporte em Meus dados (`suporte@overtraining.app`, escondido se o Gustavo não confirmar o e-mail até 30/11) e altura própria do cartão recolhido da dieta. Mais a exceção do **convite de acesso em lote por link e WhatsApp** e o item 0 do Recebimento.

## Decisões abertas

- Auditoria da preferência do lembrete do ciclo (L7): quando a frente descongelar.
- Design system: borda de ação da série aberta (decidido: borda na cor de ação, fundo na cor do tipo; atualizar a nota "um destaque por vez" em `docs/design-e-front.md`).

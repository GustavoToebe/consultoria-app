package br.com.treinos.api.whatsapp;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Como o WhatsApp reconfere um lembrete de cobrança logo antes de enviar, sem ler a cobrança: quem a conhece é o módulo de
 * pagamentos ({@code ArquiteturaTest}: fora de {@code pagamentos/} ninguém lê {@code CobrancaAluno*} nem {@code ContratacaoAluno*}),
 * que implementa esta porta. Roda dentro da consultoria do aviso (o {@code TenantContext} já está aberto) e da transação
 * somente leitura do {@link PreparoDoAviso}. Pagamento atrasado nunca bloqueia nada do aluno: aqui só decide se o lembrete ainda
 * faz sentido.
 */
public interface ConferenciaDoAviso {

    /**
     * O resultado: {@code motivo} preenchido cancela o aviso (a cobrança não está mais aberta, o lembrete deixou de ser devido
     * hoje, a contratação não está ativa...); senão {@code valor} ({@code R$ 1.234,56}) e {@code vencimento} ({@code dd/MM}) são
     * as variáveis 3 e 4 do modelo.
     */
    record Conferido(String motivo, String valor, String vencimento) {

        public static Conferido cancelar(String motivo) {
            return new Conferido(motivo, null, null);
        }

        public static Conferido enviar(String valor, String vencimento) {
            return new Conferido(null, valor, vencimento);
        }

        @Override
        public String toString() {
            return "Conferido[" + (motivo == null ? "enviar" : motivo) + "]";
        }
    }

    Conferido conferirLembrete(UUID cobrancaId, TipoDeAviso tipo, LocalDate hoje);
}

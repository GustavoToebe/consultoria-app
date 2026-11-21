package br.com.treinos.api.whatsapp;

import java.util.List;

/**
 * O texto sugerido de cada modelo e a ordem fixa das variáveis (C17): é o que a tela mostra para o treinador cadastrar o modelo
 * no gerenciador da Meta. A API só envia o nome do modelo e estas variáveis, na ordem; o texto final é o que a Meta aprovou.
 * Lembrete: as mesmas frases do e-mail ({@code TextoDoLembrete}). Compromisso: sem horário nem local, como o push.
 */
final class ModelosDeTexto {

    private static final List<String> VARIAVEIS_DO_LEMBRETE = List.of("Primeiro nome do aluno", "Nome da consultoria", "Valor",
            "Vencimento (dd/mm)");
    private static final List<String> VARIAVEIS_DO_COMPROMISSO = List.of("Nome da consultoria");

    private ModelosDeTexto() {
    }

    static String sugerido(TipoDeAviso tipo) {
        String inicio = "Olá, {{1}}. A mensalidade de {{2}} no valor de {{3}} ";
        return switch (tipo) {
            case ANTES -> inicio + "vence em {{4}}.";
            case NO_DIA -> inicio + "vence hoje ({{4}}).";
            case DEPOIS -> inicio + "venceu em {{4}} e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.";
            case COMPROMISSO_NOVO -> "Seu compromisso com a {{1}} foi marcado. Abra o app para ver.";
            case COMPROMISSO_REMARCADO -> "Seu compromisso com a {{1}} foi remarcado. Abra o app para ver.";
            case COMPROMISSO_CANCELADO -> "Seu compromisso com a {{1}} foi cancelado. Abra o app para ver.";
        };
    }

    static List<String> variaveis(TipoDeAviso tipo) {
        return tipo.ehLembrete() ? VARIAVEIS_DO_LEMBRETE : VARIAVEIS_DO_COMPROMISSO;
    }
}

package br.com.treinos.api.whatsapp;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * A conferência de um aviso reservado, logo antes do envio, numa transação curta somente leitura dentro da consultoria dele
 * (quem chama abre o {@code TenantContext}): o aluno é ativo e não anonimizado, autorizou os avisos e (no lembrete) não os
 * desligou, a consultoria tem conexão e modelo do tipo, há telefone e, se é lembrete, a cobrança ainda faz sentido
 * ({@link ConferenciaDoAviso}, implementada pelos pagamentos). Devolve tudo o que o envio precisa (o token já decifrado) ou o
 * motivo do cancelamento. O telefone só é lido aqui, na hora; o envio fica fora daqui (e de qualquer transação). Nada daqui vai
 * a log.
 */
@Service
class PreparoDoAviso {

    static final String ALUNO_INATIVO = "ALUNO_INATIVO";
    static final String OPT_IN_DESLIGADO = "OPT_IN_DESLIGADO";
    static final String ALUNO_DESLIGOU = "ALUNO_DESLIGOU";
    static final String SEM_CONEXAO = "SEM_CONEXAO";
    static final String SEM_MODELO = "SEM_MODELO";
    static final String SEM_TELEFONE = "SEM_TELEFONE";

    private static final int TAMANHO_MAXIMO_DA_VARIAVEL = 100;

    /**
     * O que enviar ({@code motivo} nulo) ou só o motivo do cancelamento. {@code para} é só dígitos com DDI; {@code token} já
     * decifrado. O {@code toString} não mostra nada além da decisão.
     */
    record Preparo(String phoneNumberId, String token, String modelo, String idioma, String para, List<String> variaveis,
                   String motivo) {

        static Preparo cancelar(String motivo) {
            return new Preparo(null, null, null, null, null, List.of(), motivo);
        }

        boolean enviar() {
            return motivo == null;
        }

        @Override
        public String toString() {
            return "Preparo[" + (motivo == null ? "enviar" : motivo) + "]";
        }
    }

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final WhatsAppConexaoRepository conexoes;
    private final WhatsAppModeloRepository modelos;
    private final CifraDoWhatsApp cifra;
    private final ConferenciaDoAviso conferencia;

    PreparoDoAviso(AlunoRepository alunos, UsuarioRepository usuarios, ConsultoriaRepository consultorias,
                   WhatsAppConexaoRepository conexoes, WhatsAppModeloRepository modelos, CifraDoWhatsApp cifra,
                   ConferenciaDoAviso conferencia) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.conexoes = conexoes;
        this.modelos = modelos;
        this.cifra = cifra;
        this.conferencia = conferencia;
    }

    @Transactional(readOnly = true)
    Preparo preparar(WhatsAppRepositorio.Reservado envio, LocalDate hoje) {
        Optional<Aluno> achado = alunos.findById(envio.alunoId());
        if (achado.isEmpty() || !achado.get().isAtivo() || achado.get().isAnonimizado()) {
            return Preparo.cancelar(ALUNO_INATIVO);
        }
        Aluno aluno = achado.get();
        if (aluno.getWhatsappAvisosAutorizadoEm() == null) {
            return Preparo.cancelar(OPT_IN_DESLIGADO);
        }
        if (envio.tipo().ehLembrete() && aluno.getLembretesCobrancaDesligadosEm() != null) {
            return Preparo.cancelar(ALUNO_DESLIGOU);
        }
        Optional<WhatsAppConexao> conexao = conexoes.findFirstBy();
        if (conexao.isEmpty()) {
            return Preparo.cancelar(SEM_CONEXAO);
        }
        Optional<WhatsAppModelo> modelo = modelos.findByTipo(envio.tipo());
        if (modelo.isEmpty()) {
            return Preparo.cancelar(SEM_MODELO);
        }
        Optional<String> para = aluno.getUsuarioId() == null ? Optional.empty()
                : usuarios.findById(aluno.getUsuarioId()).map(Usuario::getTelefone).flatMap(NumeroDoWhatsApp::de);
        if (para.isEmpty()) {
            return Preparo.cancelar(SEM_TELEFONE);
        }
        String consultoria = consultorias.findById(envio.consultoriaId()).map(Consultoria::getNome).orElse(null);
        List<String> variaveis = new ArrayList<>();
        if (envio.tipo().ehLembrete()) {
            ConferenciaDoAviso.Conferido conferido = conferencia.conferirLembrete(envio.referenciaId(), envio.tipo(), hoje);
            if (conferido.motivo() != null) {
                return Preparo.cancelar(conferido.motivo());
            }
            variaveis.add(umaLinha(primeiroNome(aluno.getNome()), "aluno"));
            variaveis.add(umaLinha(consultoria, "sua consultoria"));
            variaveis.add(umaLinha(conferido.valor(), "-"));
            variaveis.add(umaLinha(conferido.vencimento(), "-"));
        } else {
            variaveis.add(umaLinha(consultoria, "sua consultoria"));
        }
        // O token só é decifrado aqui, para um aviso que vai mesmo sair; a consultoria é a do TenantContext aberto por quem chama.
        String token = cifra.decifrar(TenantContext.get(), conexao.get().getTokenCifrado());
        return new Preparo(conexao.get().getPhoneNumberId(), token, modelo.get().getNome(), modelo.get().getIdioma(), para.get(),
                List.copyOf(variaveis), null);
    }

    /** O primeiro nome; nulo sem nome (o resto do nome não vai a mensagem nenhuma). */
    static String primeiroNome(String nome) {
        if (nome == null || nome.isBlank()) {
            return null;
        }
        return nome.replaceAll("[\\p{Cntrl}\\s]+", " ").trim().split(" ", 2)[0];
    }

    /**
     * A Meta recusa variável vazia e com quebra de linha, tabulação ou vários espaços: tudo vira uma linha só, sem repetição de
     * espaço, com tamanho máximo e, se nada sobrar, o texto de reserva.
     */
    static String umaLinha(String texto, String reserva) {
        String limpo = texto == null ? "" : texto.replaceAll("[\\p{Cntrl}\\s]+", " ").trim();
        if (limpo.isEmpty()) {
            return reserva;
        }
        return limpo.length() > TAMANHO_MAXIMO_DA_VARIAVEL ? limpo.substring(0, TAMANHO_MAXIMO_DA_VARIAVEL) : limpo;
    }
}
